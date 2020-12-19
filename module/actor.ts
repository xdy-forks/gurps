import { xmlTextToJson } from '../lib/utilities.js'
import ApplyDamageDialog from '../lib/applydamage.js'
import {GURPS} from "./gurps";

export class GurpsActor extends Actor {
	public data: any;
	public update: any;

	/** @override */
	getRollData() {
		const data = super.getRollData();
		return data;
	}

	prepareData() {
		super.prepareData();
	}

	/** @override */
	_onUpdate(data, options, userId, context) {
		super._onUpdate(data, options, userId, context);
		game.GURPS.ModifierBucket.refresh();		// Update the bucket, in case the actor's status effects have changed
	}


	// First attempt at import GCS FG XML export data.
	async importFromGCSv1(xml, importname, importpath) {
		// need to remove <p> and replace </p> with newlines from "formatted text"
		let x = game.GURPS.cleanUpP(xml);
		x = xmlTextToJson(x);
		let r = x.root;
		if (!r) {
			if (xml[0] == "{" && importname.endsWith(".gcs"))
				ui.notifications.error("We cannot import a GCS file directly.   You must export the file using the Foundry VTT output template.");
			else
				ui.notifications.error("No <root> object found.  Are you importing the correct XML file?");
			return;
		}

		let parsererror = r.parsererror;
		if (!!parsererror) {
			ui.notifications.error("Error parsing XML: " + this.textFrom(parsererror.div));
			return;
		}

		let ra = r["@attributes"];
		const isFoundryGCS = (!!ra && ra.release == "Foundry" && ra.version == "1");
		const isFoundryGCA = (!!ra && ra.release == "Foundry" && ra.version == "GCA");
		if (!(isFoundryGCS || isFoundryGCA)) {
			ui.notifications.error("We no longer support the Fantasy Ground import.   Please check the Users Guide (see Chat log).");
			ChatMessage.create({ content: "<a href='" + GURPS.USER_GUIDE_URL + "'>GURPS 4e Game Aid USERS GUIDE</a>", user: game.user._id, type: CONST.CHAT_MESSAGE_TYPES.OTHER });
			return;
		}

		// The character object starts here
		let c = r.character;
		if (!c) {
			ui.notifications.warn("Unable to detect the 'character' format.   Most likely you are trying to import the 'npc' format.");
			return;
		}
		let nm = this.textFrom(c.name);
		console.log("Importing '" + nm + "'");
		// this is how you have to update the domain object so that it is synchronized.

		let commit = {}
		commit = { ...commit, ...{ "name": nm } };
		commit = { ...commit, ...{ "data.lastImport": (new Date()).toString().split(' ').splice(1,4).join(' ') } };
		commit = { ...commit, ...{ "token.name": nm } };
		let ar = this.data.data.additionalresources || {};
		ar.importname = importname;
		ar.importpath = importpath;
		commit = { ...commit, ...{ "data.additionalresources": ar } };

		try {
			// This is going to get ugly, so break out various data into different methods
			commit = { ...commit, ... await this.importAttributesFromCGSv1(c.attributes) };
			commit = { ...commit, ...this.importSkillsFromGCSv1(c.abilities?.skilllist, isFoundryGCS) };
			commit = { ...commit, ...this.importTraitsfromGCSv1(c.traits) };
			commit = { ...commit, ...this.importCombatMeleeFromGCSv1(c.combat?.meleecombatlist, isFoundryGCS) };
			commit = { ...commit, ...this.importCombatRangedFromGCSv1(c.combat?.rangedcombatlist, isFoundryGCS) };
			commit = { ...commit, ...this.importSpellsFromGCSv1(c.abilities?.spelllist, isFoundryGCS) };
			if (isFoundryGCS) {
				commit = { ...commit, ...this.importAdsFromGCSv2(c.traits?.adslist) };
				commit = { ...commit, ...this.importReactionsFromGCSv2(c.reactions) };
			}
			if (isFoundryGCA) {
				commit = { ...commit, ...this.importAdsFromGCA(c.traits?.adslist, c.traits?.disadslist) };
				commit = { ...commit, ...this.importReactionsFromGCA(c.traits?.reactionmodifiers) };
			}
			commit = { ...commit, ...this.importEncumbranceFromGCSv1(c.encumbrance) };
			commit = { ...commit, ...this.importPointTotalsFromGCSv1(c.pointtotals) };
			commit = { ...commit, ...this.importNotesFromGCSv1(c.description, c.notelist) };
			commit = { ...commit, ...this.importEquipmentFromGCSv1(c.inventorylist, isFoundryGCS) };
			commit = { ...commit, ...this.importProtectionFromGCSv1(c.combat?.protectionlist) };
		} catch (err) {
			let msg = "An error occured while importing " + nm + ", " + err.name + ":" + err.message;
			ui.notifications.warn(msg);
			let chatData = {
				user: game.user._id,
				type: CONST.CHAT_MESSAGE_TYPES.WHISPER,
				content: msg,
				whisper: [game.user._id]
			}
			CONFIG.ChatMessage.entityClass.create(chatData, {});
		}
		console.log("Starting commit");

		let deletes = Object.fromEntries(Object.entries(commit).filter(([key, value]) => key.includes(".-=")));
		let adds = Object.fromEntries(Object.entries(commit).filter(([key, value]) => !key.includes(".-=")));

		await this.update(deletes);
		await this.update(adds);

		console.log("Done importing.  You can inspect the character data below:");
		console.log(this);
	}

	// hack to get to private text element created by xml->json method.
	textFrom(o) {
		if (!o) return "";
		let t = o["#text"];
		if (!t) return "";
		return t.trim();
	}

	// similar hack to get text as integer.
	intFrom(o) {
		if (!o) return 0;
		let i = o["#text"];
		if (!i) return 0;
		return parseInt(i);
	}

	floatFrom(o) {
		if (!o) return 0;
		let f = o["#text"];
		if (!f) return 0;
		return parseFloat(f);
	}

	importReactionsFromGCSv2(json) {
		if (!json) return;
		let t = this.textFrom;
		let rs = {};
		let index = 0;
		for (let key in json) {
			if (key.startsWith("id-")) {	// Allows us to skip over junk elements created by xml->json code, and only select the skills.
				let j = json[key];
				let r = new Reaction();
				r.modifier = t(j.modifier);
				r.situation = t(j.situation);
				game.GURPS.put(rs, r, index++);
			}
		}
		return {
			"data.-=reactions": null,
			"data.reactions": rs
		};
	}

	importReactionsFromGCA(json) {
		if (!json) return;
		let text = this.textFrom(json);
		let a = text.split(",");
		let rs = {};
		let index = 0;
		a.forEach(m => {
			if (!!m) {
				let t = m.trim();
				let i = t.indexOf(" ");
				let mod = t.substring(0, i);
				let sit = t.substr(i + 1);
				let r = new Reaction(mod, sit);
				game.GURPS.put(rs, r, index++);
			}
		});
		return {
			"data.-=reactions": null,
			"data.reactions": rs
		};
	}

	importPointTotalsFromGCSv1(json) {
		if (!json) return;

		let i = this.intFrom;
		return {
			"data.totalpoints.attributes": i(json.attributes),
			"data.totalpoints.ads": i(json.ads),
			"data.totalpoints.disads": i(json.disads),
			"data.totalpoints.quirks": i(json.quirks),
			"data.totalpoints.skills": i(json.skills),
			"data.totalpoints.spells": i(json.spells),
			"data.totalpoints.unspent": i(json.unspentpoints),
			"data.totalpoints.total": i(json.totalpoints),
			"data.totalpoints.race": i(json.race)
		};
	}

	importNotesFromGCSv1(descjson, json) {
		if (!json) return;
		let t = this.textFrom;
		let ns = {};
		let index = 0;
		if (!!descjson) {  // support for GCA description
			let n = new Note();
			n.notes = t(descjson).replace(/\\r/g, "\n");
			game.GURPS.put(ns, n, index++);
		}
		for (let key in json) {
			if (key.startsWith("id-")) {	// Allows us to skip over junk elements created by xml->json code, and only select the skills.
				let j = json[key];
				let n = new Note();
				//n.setNotes(t(j.text));
				n.notes = t(j.name);
				let txt = t(j.text);
				if (!!txt) n.notes = n.notes + "\n" + txt.replace(/\\r/g, "\n");
				game.GURPS.put(ns, n, index++);
			}
		}
		return {
			"data.-=notes": null,
			"data.notes": ns
		};
	}

	importProtectionFromGCSv1(json) {
		if (!json) return;
		let t = this.textFrom;
		let prot = {};
		let index = 0;
		for (let key in json) {
			if (key.startsWith("id-")) {	// Allows us to skip over junk elements created by xml->json code, and only select the skills.
				let j = json[key];
				let hl = new HitLocation();
				hl.where = t(j.location);
				hl.dr = t(j.dr);
				hl.penalty = t(j.db);
				hl.setEquipment(t(j.text));
				game.GURPS.put(prot, hl, index++);
			}
		}
		return {
			"data.-=hitlocations": null,
			"data.hitlocations": prot
		};

	}

	importEquipmentFromGCSv1(json, isFoundryGCS) {
		if (!json) return;
		let t = this.textFrom;
		let i = this.intFrom;
		let f = this.floatFrom;

		let temp = [];
		for (let key in json) {
			if (key.startsWith("id-")) {	// Allows us to skip over junk elements created by xml->json code, and only select the skills.
				let j = json[key];
				let eqt = new Equipment();
				eqt.name = t(j.name);
				eqt.count = i(j.count);
				eqt.cost = t(j.cost);
				eqt.weight = f(j.weight);
				eqt.costsum = t(j.costsum);
				eqt.weightsum = t(j.weightsum);
				eqt.location = t(j.location);
				let cstatus = i(j.carried);
				eqt.carried = (cstatus >= 1);
				eqt.equipped = (cstatus == 2);
				eqt.techlevel = t(j.tl);
				eqt.legalityclass = t(j.lc);
				eqt.categories = t(j.type);
				if (isFoundryGCS) {
					eqt.notes = t(j.notes);
					eqt.pageref = t(j.pageref);
				} else
					eqt.setNotes(t(j.notes));
				if (!!j.pageref)
					eqt.pageref = t(j.pageref).split(",").splice(0, 1);
				temp.push(eqt);
			}
		}

		// Put everything in it container (if found), otherwise at the top level
		temp.forEach(eqt => {
			if (!!eqt.location) {
				let parent = null;
				parent = temp.find(e => e.name === eqt.location);
				if (!!parent)
					game.GURPS.put(parent.contains, eqt);
				else
					eqt.location = "";	// Can't find a parent, so put it in the top list
			}
		});

		let equipment = {
			"carried": {},
			"other": {}
		};
		let cindex = 0;
		let oindex = 0;

		temp.forEach(eqt => {
			if (!eqt.location) {
				if (eqt.carried)
					game.GURPS.put(equipment.carried, eqt, cindex++);
				else
					game.GURPS.put(equipment.other, eqt, oindex++);
			}
		});
		return {
			"data.-=equipment": null,
			"data.equipment": equipment
		};
	}

	importEncumbranceFromGCSv1(json) {
		if (!json) return;
		let t = this.textFrom;
		let es = {};
		let index = 0;
		for (let i = 0; i < 5; i++) {
			let e = new Encumbrance();
			e.level = i;
			let k = "enc_" + i;
			let c = t(json[k]);
			e.current = (c === "1");
			k = "enc" + i;
			e.key = k;
			let k2 = k + "_weight";
			e.weight = t(json[k2]);
			k2 = k + "_move";
			e.move = t(json[k2]);
			k2 = k + "_dodge";
			e.dodge = t(json[k2]);
			game.GURPS.put(es, e, index++);
		}
		return {
			"data.-=encumbrance": null,
			"data.encumbrance": es
		};
	}

	importCombatMeleeFromGCSv1(json, isFoundryGCS) {
		if (!json) return;
		let t = this.textFrom;
		let melee = {};
		let index = 0;
		for (let key in json) {
			if (key.startsWith("id-")) {	// Allows us to skip over junk elements created by xml->json code, and only select the skills.
				let j = json[key];
				for (let k2 in j.meleemodelist) {
					if (k2.startsWith("id-")) {
						let j2 = j.meleemodelist[k2];
						let m = new Melee();
						m.name = t(j.name);
						m.st = t(j.st);
						m.weight = t(j.weight);
						m.techlevel = t(j.tl);
						m.cost = t(j.cost);
						if (isFoundryGCS) {
							m.notes = t(j.notes);
							m.pageref = t(j.pageref);
						} else
							try {
								m.setNotes(t(j.text));
							} catch {
								console.log(m);
								console.log(t(j.text));
							}
						m.mode = t(j2.name);
						m.level = t(j2.level);
						m.damage = t(j2.damage);
						m.reach = t(j2.reach);
						m.parry = t(j2.parry);
						m.block = t(j2.block);
						game.GURPS.put(melee, m, index++);
					}
				}
			}
		}
		return {
			"data.-=melee": null,
			"data.melee": melee
		};
	}

	importCombatRangedFromGCSv1(json, isFoundryGCS) {
		if (!json) return;
		let t = this.textFrom;
		let ranged = {};
		let index = 0;
		for (let key in json) {
			if (key.startsWith("id-")) {	// Allows us to skip over junk elements created by xml->json code, and only select the skills.
				let j = json[key];
				for (let k2 in j.rangedmodelist) {
					if (k2.startsWith("id-")) {
						let j2 = j.rangedmodelist[k2];
						let r = new Ranged();
						r.name = t(j.name);
						r.st = t(j.st);
						r.bulk = t(j.bulk);
						r.legalityclass = t(j.lc);
						r.ammo = t(j.ammo);
						if (isFoundryGCS) {
							r.notes = t(j.notes);
							r.pageref = t(j.pageref);
						} else
							try {
								r.setNotes(t(j.text));
							} catch {
								console.log(r);
								console.log(t(j.text));
							}
						r.mode = t(j2.name);
						r.level = t(j2.level);
						r.damage = t(j2.damage);
						r.acc = t(j2.acc);
						r.rof = t(j2.rof);
						r.shots = t(j2.shots);
						r.rcl = t(j2.rcl);
						game.GURPS.put(ranged, r, index++);
					}
				}
			}
		}
		return {
			"data.-=ranged": null,
			"data.ranged": ranged
		};
	}

	importTraitsfromGCSv1(json) {
		if (!json) return;
		let t = this.textFrom;
		let ts: { race: any; height: any; weight: any; age: any; title: any; player: any; createdon: any; modifiedon: any; religion: any; birthday: any; hand: any; sizemod: any; techlevel: any; appearance: any; gender: any; eyes: any; hair: any; skin: any; };
		ts.race = t(json.race);
		ts.height = t(json.height);
		ts.weight = t(json.weight);
		ts.age = t(json.age);
		ts.title = t(json.title);
		ts.player = t(json.player);
		ts.createdon = t(json.createdon);
		ts.modifiedon = t(json.modifiedon);
		ts.religion = t(json.religion);
		ts.birthday = t(json.birthday);
		ts.hand = t(json.hand);
		ts.sizemod = t(json.sizemodifier);
		ts.techlevel = t(json.tl);
		// <appearance type="string">@GENDER, Eyes: @EYES, Hair: @HAIR, Skin: @SKIN</appearance>
		let a = t(json.appearance);
		ts.appearance = a;
		try {
			let x = a.indexOf(", Eyes: ");
			if (x >= 0) {
				ts.gender = a.substring(0, x);
				let y = a.indexOf(", Hair: ");
				ts.eyes = a.substring(x + 8, y);
				x = a.indexOf(", Skin: ")
				ts.hair = a.substring(y + 8, x);
				ts.skin = a.substr(x + 8);
			}
		} catch {
			console.log("Unable to parse appearance traits for ");
			console.log(this);
		}
		return {
			"data.-=traits": null,
			"data.traits": ts
		};
	}

	// Import the <attributes> section of the GCS FG XML file.
	async importAttributesFromCGSv1(json) {
		if (!json) return;
		let i = this.intFrom;		// shortcut to make code smaller
		let t = this.textFrom;
		let data = this.data.data;
		let att = data.attributes;

		att.ST.value = i(json.strength);
		att.ST.points = i(json.strength_points);
		att.DX.value = i(json.dexterity);
		att.DX.points = i(json.dexterity_points);
		att.IQ.value = i(json.intelligence);
		att.IQ.points = i(json.intelligence_points);
		att.HT.value = i(json.health);
		att.HT.points = i(json.health_points);
		att.WILL.value = i(json.will);
		att.WILL.points = i(json.will_points);
		att.PER.value = i(json.perception);
		att.PER.points = i(json.perception_points);

		data.HP.max = i(json.hitpoints);
		data.HP.points = i(json.hitpoints_points);
		data.FP.max = i(json.fatiguepoints);
		data.FP.points = i(json.fatiguepoints_points);
		let hp = i(json.hps);
		let fp = i(json.fps);
		let saveCurrent = false;
		if (!!data.lastImport && (data.HP.value != hp || data.FP.value != fp)) {
			saveCurrent = await new Promise((resolve, reject) => {
				let d = new Dialog({
		      title: "Current HP & FP",
		      content: `Do you want to <br><br><b>Save</b> the current HP (${data.HP.value}) & FP (${data.FP.value}) values (default) or <br><br><b>Overwrite</b> it with the import data, HP (${hp}) & FP (${fp})?<br><br>&nbsp;`,
				  buttons: {
				    save: {
				     icon: '<i class="far fa-square"></i>',
				     label: "Save",
				     callback: () => resolve(true)
				    },
				    overwrite: {
				     icon: '<i class="fas fa-edit"></i>',
				     label: "Overwrite",
				     callback: () => resolve(true)
				    }
				  },
				 default: "save",
				 close: () => resolve(false) // just assume overwrite.   Error handling would be too much work right now.
		    });
				d.render(true);
			});
		}
		if (!saveCurrent) {
			data.HP.value = hp;
			data.FP.value = fp;
		}

		let lm: { basiclift: any; carryonback: any; onehandedlift: any; runningshove: any; shiftslightly: any; shove: any; twohandedlift: any; };
		lm.basiclift = t(json.basiclift);
		lm.carryonback = t(json.carryonback);
		lm.onehandedlift = t(json.onehandedlift);
		lm.runningshove = t(json.runningshove);
		lm.shiftslightly = t(json.shiftslightly);
		lm.shove = t(json.shove);
		lm.twohandedlift = t(json.twohandedlift);


		data.basicmove.value = t(json.basicmove);
		data.basicmove.points = i(json.basicmove_points);
		data.basicspeed.value = t(json.basicspeed);
		data.basicspeed.points = i(json.basicspeed_points);
		data.thrust = t(json.thrust);
		data.swing = t(json.swing);
		data.currentmove = t(json.move);
		data.frightcheck = i(json.frightcheck);

		data.hearing = i(json.hearing);
		data.tastesmell = i(json.tastesmell);
		data.touch = i(json.touch);
		data.vision = i(json.vision);

		return {
			"data.attributes": att,
			"data.HP": data.HP,
			"data.FP": data.FP,
			"data.basiclift": data.basiclift,
			"data.basicmove": data.basicmove,
			"data.basicspeed": data.basicspeed,
			"data.thrust": data.thrust,
			"data.swing": data.swing,
			"data.currentmove": data.currentmove,
			"data.frightcheck": data.frightcheck,
			"data.hearing": data.hearing,
			"data.tastesmell": data.tastesmell,
			"data.touch": data.touch,
			"data.vision": data.vision,
			"data.liftingmoving": lm
		};
	}

	// create/update the skills.
	// NOTE:  For the update to work correctly, no two skills can have the same name.
	// When reading data, use "this.data.data.skills", however, when updating, use "data.skills".
	importSkillsFromGCSv1(json, isFoundryGCS) {
		if (!json) return;
		let skills = {};
		let index = 0;
		let t = this.textFrom;		/// shortcut to make code smaller
		for (let key in json) {
			if (key.startsWith("id-")) {	// Allows us to skip over junk elements created by xml->json code, and only select the skills.
				let j = json[key];
				let sk = new Skill();
				sk.name = t(j.name);
				sk.type = t(j.type);
				sk.level = this.intFrom(j.level);
				sk.points = this.intFrom(j.points);
				sk.relativelevel = t(j.relativelevel);
				if (isFoundryGCS) {
					sk.notes = t(j.notes);
					sk.pageref = t(j.pageref);
				} else
					sk.setNotes(t(j.text));
				if (!!j.pageref)
					sk.pageref = t(j.pageref).split(",").splice(0, 1);
				game.GURPS.put(skills, sk, index++);
			}
		}
		return {
			"data.-=skills": null,
			"data.skills": skills
		};
	}

	// create/update the spells.
	// NOTE:  For the update to work correctly, no two spells can have the same name.
	// When reading data, use "this.data.data.spells", however, when updating, use "data.spells".
	importSpellsFromGCSv1(json, isFoundryGCS) {
		if (!json) return;
		let spells = {};
		let index = 0;
		let t = this.textFrom;		/// shortcut to make code smaller
		for (let key in json) {
			if (key.startsWith("id-")) {	// Allows us to skip over junk elements created by xml->json code, and only select the skills.
				let j = json[key];
				let sp = new Spell();
				sp.name = t(j.name);
				sp.class = t(j.class);
				sp.college = t(j.college);
				if (isFoundryGCS) {
					sp.cost = t(j.cost);
					sp.maintain = t(j.maintain);
					sp.difficulty = t(j.difficulty);
					sp.notes = t(j.notes);
					sp.pageref = t(j.pageref);
				} else {
					let cm = t(j.costmaintain);
					let i = cm.indexOf('/');
					if (i >= 0) {
						sp.cost = cm.substring(0, i);
						sp.maintain = cm.substr(i + 1);
					} else {
						sp.cost = cm;
					}
					sp.setNotes(t(j.text));
					if (!!j.pageref)
						sp.pageref = t(j.pageref).split(",").splice(0, 1);
				}
				sp.duration = t(j.duration);
				sp.points = t(j.points);
				sp.casttime = t(j.time);
				sp.level = parseInt(t(j.level));
				sp.duration = t(j.duration);
				game.GURPS.put(spells, sp, index++);
			}
		}
		return {
			"data.-=spells": null,
			"data.spells": spells
		};
	}

	importAdsFromGCA(adsjson, disadsjson) {
		let list;
		let index = 0;
		index = this.importBaseAdvantages(list, adsjson, index);
		this.importBaseAdvantages(list, disadsjson, index);
		return {
			"data.-=ads": null,
			"data.ads": list
		};
	}

	importBaseAdvantages(datalist, json:any, index:number) {
		if (!json) return;
		let t = this.textFrom;		/// shortcut to make code smaller
		for (let key in json) {
			if (key.startsWith("id-")) {	// Allows us to skip over junk elements created by xml->json code, and only select the skills.
				let j = json[key];
				let a = new Advantage();
				a.name = t(j.name);
				a.points = this.intFrom(j.points);
				a.setNotes(t(j.text));
				if (!!j.pageref)
					a.pageref = t(j.pageref).split(",").splice(0, 1);
				game.GURPS.put(datalist, a, index++);
			}
		}
		return index;
	}

	// In the new GCS import, all ads/disad/quirks/perks are in one list.
	importAdsFromGCSv2(json) {
		let list = {};
		let index = 0;
		let t = this.textFrom;		/// shortcut to make code smaller
		for (let key in json) {
			if (key.startsWith("id-")) {	// Allows us to skip over junk elements created by xml->json code, and only select the skills.
				let j = json[key];
				let a = new Advantage();
				a.name = t(j.name);
				a.points = this.intFrom(j.points);
				a.note = t(j.notes);
				a.userdesc = t(j.userdesc);
				a.notes = "";
				if (!!a.note && !!a.userdesc)
					a.notes = a.note + "\n" + a.userdesc;
				else if (!!a.note)
					a.notes = a.note;
				else if (!!a.userdesc)
					a.notes = a.userdesc;
				a.pageref = t(j.pageref);
				game.GURPS.put(list, a, index++);
			}
		}
		return {
			"data.-=ads": null,
			"data.ads": list
		};
	}

	// --- Functions to handle events on actor ---

	handleDamageDrop(damageData) {
		new ApplyDamageDialog(this, damageData).render(true)
	}

	// This function merges the 'where' and 'dr' properties of this actor's hitlocations
	// with the roll value from the global GURPS.hitlocationRolls object, converting the
	// roll from a string to an array of numbers (see the _convertRollStringToArrayOfInt
	// function).
	//
	// return value is an object with the following structure:
	// 	{
	//  	where: string value from the hitlocations table,
	//  	dr: int DR value from the hitlocations table,
	//  	rollText: string value of the roll from the hitlocations table (examples: '5', '6-9', '-')
	//  	roll: array of int of the values that match rollText (examples: [5], [6,7,8,9], [])
	// 	}
	get hitLocationsWithDR() {
		let myhitlocations = []
		for (const [key, value] of Object.entries(this.data.data.hitlocations)) {
			myhitlocations.push({
				where: value.where,
				dr: parseInt(value.dr),
				roll: this._convertRollStringToArrayOfInt(
					GURPS.hitlocationRolls[value.where].roll
				),
				rollText: GURPS.hitlocationRolls[value.where].roll
			})
		}
		return myhitlocations
	}

	// Take a string like "", "-", "3", "4-5" and convert it into an array of int.
	// The resulting array will contain all ints between the first number and the last.
	// E.g, if the input is '2-5' the result will be [2,3,4,5]. Non-numeric inputs
	// result in the empty array.
	_convertRollStringToArrayOfInt(text) {
		let elements = text.split('-')
		let range = elements.map(it => parseInt(it))

		if (range.length === 0) return []

		for (let i = 0; i < range.length; i++) {
			if (typeof range[i] === 'undefined' || isNaN(range[i]))
				return []
		}

		let results = []
		for (let i = range[0]; i <= range[range.length - 1]; i++)
			results.push(i)

		return results
	}

	// Return the 'where' value of the default hit location, or 'Random'
	// NOTE: could also return 'Large-Area'?
	get defaultHitLocation() {
		// TODO implement a system setting but (potentially) allow it to be overridden
		return game.settings.get('gurps', 'default-hitlocation')
	}

	getCurrentDodge() {
		if (!this.data.data.encumbrance) return 0;
		let enc = Object.values(this.data.data.encumbrance).find(e => e.current);
		return (!!enc) ? enc.dodge : 0;
	}

	getCurrentMove() {
    if (!this.data.data.encumbrance) return 0;
		let enc = Object.values(this.data.data.encumbrance).find(e => e.current);
		return (!!enc) ? enc.move : 0;
	}

	getTorsoDr() {
    if (!this.data.data.hitlocations) return 0;
		let hl = Object.values(this.data.data.hitlocations).find(h => h.penalty == 0);
		return (!!hl) ? hl.dr : 0;
	}
}

export class Named {
	constructor(n1) {
		this.name = n1;
	}
	name = "";
	notes = "";
	pageref = "";

	// This is an ugly hack to parse the GCS FG Formatted Text entries.   See the method cleanUpP() above.
	setNotes(n) {
		if (!!n) {
			let v = game.GURPS.extractP(n);
			let k = "Page Ref: ";
			let i = v.indexOf(k);
			if (i >= 0) {
				this.notes = v.substr(0, i).trim();
				// Find the "Page Ref" and store it separately (to hopefully someday be used with PDF Foundry)
				this.pageref = v.substr(i + k.length).trim();
			} else {
				this.notes = v.trim();
				this.pageref = "";
			}
		}
	}
}

export class NamedCost extends Named {
	points = 0;
}

export class Leveled extends NamedCost {
	constructor(n1, lvl) {
    super(n1);
    this.level = lvl;
  }

	level = 1;
}

export class Skill extends Leveled {
	type = "";    // "DX/E";
	relativelevel = "";   // "DX+1";

}

export class Spell extends Leveled {
	class = "";
	college = "";
	cost = "";
	maintain = "";
	duration = "";
	resist = "";
	casttime = "";
	difficulty = "";
}

export class Advantage extends NamedCost {
	userdesc = "";
	note = "";
}

export class Attack extends Named {
	st = "";
	mode = "";
	level = "";
	damage = "";
  constructor(n1, lvl, dmg) {
    super(n1);
    this.level = lvl;
    this.damage = dmg;
  }
}

export class Melee extends Attack {
	weight = "";
	techlevel = "";
	cost = "";
	reach = "";
	parry = "";
	block = "";
}

export class Ranged extends Attack {
	public halfd: any;
	public max: any;
	bulk = "";
	legalityclass = "";
	ammo = "";
	acc = "";
	range = "";
	rof = "";
	shots = "";
	rcl = "";
	checkRange() {
		if (!!this.halfd)
			this.range = this.halfd;
		if (!!this.max)
			this.range = this.max;
		if (!!this.halfd && !!this.max)
			this.range = this.halfd + "/" + this.max;
	}
}

export class Encumbrance {
	key = "";
	level = 0;
	dodge = 9;
	weight = "";
	move = "";
	current = false;
}

export class Note extends Named {
	constructor(n?) {
		super();
		this.notes = n;
	}
}

export class Equipment extends Named {
	equipped = false;
	carried = false;
	count = 0;
	cost = 0;
	weight = 0;
	location = "";
	techlevel = "";
	legalityclass = "";
	categories = "";
	contains = {};
	costsum = "";
	weightsum = "";
}

export class HitLocation {
	dr = "";
	equipment = "";
	penalty = "";
	roll = "";
	where = "";

	setEquipment(frmttext) {
		let e = game.GURPS.extractP(frmttext);
		this.equipment = e.trim().replace("\n", ", ");
	}
}

export class Reaction {
	modifier = "";
	situation = "";
	constructor(m?, s?) {
		this.modifier = m;
		this.situation = s;
	}
}
