// Import Modules
import parselink from '../lib/parselink.js'

import { GurpsActor } from "./actor.js";
import { GurpsItem } from "./item.js";
import { GurpsItemSheet } from "./item-sheet.js";
import { GurpsActorCombatSheet, GurpsActorSheet, GurpsActorEditorSheet, GurpsActorSimplifiedSheet, GurpsActorNpcSheet } from "./actor-sheet.js";
import { ModifierBucket } from "./modifiers.js";
import { ChangeLogWindow } from "../lib/change-log.js";
import { SemanticVersion } from "../lib/semver.js";
import { d6ify } from '../lib/utilities.js'
import { ThreeD6 } from "../lib/threed6.js";

export const GURPS = {
  LEGAL: undefined,
  BANNER: undefined,
  LastActor: undefined,
  SetLastActor: undefined,
  ModifierBucket: undefined,
  hitlocationRolls: undefined,
  woundModifiers: undefined,
  damageTypeMap: undefined,
  attributepaths: undefined,
  parseDmg: undefined,
  skillTypes: undefined,
  SavedStatusEffects: undefined,
  attributeNames: undefined,
  SJGProductMappings: undefined,
  USER_GUIDE_URL: undefined,
  cleanUpP: undefined,
  extractP: undefined,
  objToString: undefined,
  trim: undefined,
  performAction: undefined,
  attributes: undefined,
  damageChat: undefined,
  findAttack: undefined,
  handleRoll: undefined,
  hookupGurps: undefined,
  chatClickGurpslink: undefined,
  listeqtrecurse: undefined,
  chatClickGmod: undefined,
  handleOnPdf: undefined,
  handlePdf: undefined,
  findSkillSpell: undefined,
	uniqueID: undefined,
	removeKey: undefined
};
window.GURPS = GURPS;		// Make GURPS global!

import GURPSRange from '../lib/ranges.js'
import Initiative from '../lib/initiative.js'
import HitFatPoints from '../lib/hitpoints.js'
import HitLocationEquipmentTooltip from '../lib/hitlocationtooltip.js'
import DamageChat from '../lib/damagemessage.js'

import handlebarHelpers from '../lib/moustachewax.js'
import * as settings from '../lib/miscellaneous-settings.js'
import jqueryHelpers from '../lib/jquery-helper.js'
import { NpcInput } from '../lib/npc-input.js'

jqueryHelpers()
handlebarHelpers()
settings.initializeSettings()

GURPS.BANNER = `   __ ____ _____ _____ _____ _____ ____ __
  / /_____|_____|_____|_____|_____|_____\\ \\
 / /      ____ _   _ ____  ____  ____    \\ \\
 | |     / ___| | | |  _ \\|  _ \\/ ___|    | |
 | |    | |  _| | | | |_) | |_) \\___ \\    | |
 | |    | |_| | |_| |  _ <|  __/ ___) |   | |
 | |     \\____|\\___/|_| \\_\\_|   |____/    | |
  \\ \\ _____ _____ _____ _____ _____ ____ / /
   \\_|_____|_____|_____|_____|_____|____|_/
`;
GURPS.LEGAL = `GURPS is a trademark of Steve Jackson Games, and its rules and art are copyrighted by Steve Jackson Games. All rights are reserved by Steve Jackson Games. This game aid is the original creation of Chris Normand/Nose66 and is released for free distribution, and not for resale, under the permissions granted by http://www.sjgames.com/general/online_policy.html`;


CONFIG.debug.hooks = true;

// Hack to remember the last Actor sheet that was accessed... for the Modifier Bucket to work
GURPS.LastActor = null;
GURPS.SetLastActor = function (actor) {
	GURPS.LastActor = actor;
	GURPS.ModifierBucket.refresh();
	console.log("Last Actor:" + actor.name);
}

// This table is used to display dice rolls and penalties (if they are missing from the import data)
// And to create the HitLocations pulldown menu (skipping any "skip:true" entries)
GURPS.hitlocationRolls = {
	"Eye": { roll: "-", penalty: -9, skip: true },
	"Eyes": { roll: "-", penalty: -9 },																// GCA
	"Skull": { roll: "3-4", penalty: -7 },
	"Skull, from behind": { penalty: -5 },
	"Face": { roll: "5", penalty: -5 },
	"Face, from behind": { penalty: -7 },
	"Nose": { penalty: -7, desc: "front only, *hit chest" },
	"Jaw": { penalty: -6, desc: "front only, *hit chest" },
	"Neck Vein/Artery": { penalty: -8, desc: "*hit neck" },
	"Limb Vein/Artery": { penalty: -5, desc: "*hit limb" },
	"Right Leg": { roll: "6-7", penalty: -2, skip: true },
	"Right Arm": { roll: "8", penalty: -2, skip: true },
	"Right Arm, holding shield": { penalty: -4, skip: true },
	"Arm, holding shield": { penalty: -4 },
	"Arm": { roll: "8 & 12", penalty: -2 },													// GCA
	"Arms": { roll: "8 & 12", penalty: -2, skip: true },													// GCA
	"Torso": { roll: "9-10", penalty: 0 },
	"Vitals": { roll: "-", penalty: -3, desc: "IMP/PI[any] only" },
	"Vitals, Heart": { penalty: -5, desc: "IMP/PI[any] only" },
	"Groin": { roll: "11", penalty: -3 },
	"Left Arm": { roll: "12", penalty: -2, skip: true },
	"Left Arm, holding shield": { penalty: -4, skip: true },
	"Left Leg": { roll: "13-14", penalty: -2, skip: true },
	"Legs": { roll: "6-7&13-14", penalty: -2, skip: true },												// GCA
	"Leg": { roll: "6-7&13-14", penalty: -2 },												// GCA
	"Hand": { roll: "15", penalty: -4 },
	"Hands": { roll: "15", penalty: -4, skip: true },									// GCA
	"Foot": { roll: "16", penalty: -4 },
	"Feet": { roll: "16", penalty: -4, skip: true },															// GCA
	"Neck": { roll: "17-18", penalty: -5 },
	"Chinks in Torso": { penalty: -8, desc: "Halves DR" },
	"Chinks in Other": { penalty: -10, desc: "Halves DR" },
};


GURPS.woundModifiers = {
	"burn": { multiplier: 1, label: 'Burning' },
	"cor": { multiplier: 1, label: 'Corrosive' },
	"cr": { multiplier: 1, label: 'Crushing' },
	"cut": { multiplier: 1.5, label: 'Cutting' },
	"fat": { multiplier: 1, label: 'Fatigue' },
	"imp": { multiplier: 2, label: 'Impaling' },
	"pi-": { multiplier: 0.5, label: 'Small Piercing' },
	"pi": { multiplier: 1, label: 'Piercing' },
	"pi+": { multiplier: 1.5, label: 'Large Piercing' },
	"pi++": { multiplier: 2, label: 'Huge Piercing' },
	"tox": { multiplier: 1, label: 'Toxic' },
	"dmg": { multiplier: 1, label: 'Damage', nodisplay: true }
};

GURPS.damageTypeMap = {
	"burn": "burn",
	"cor": "cor",
	"cr": "cr",
	"cut": "cut",
	"fat": "fat",
	"imp": "imp",
	"pi-": "pi-",
	"pi": "pi",
	"pi+": "pi+",
	"pi++": "pi++",
	"toxic": "tox",
	"burning": "burn",
	"corrosion": "cor",
	"corrosive": "cor",
	"crush": "cr",
	"crushing": "cr",
	"cutting": "cut",
	"fatigue": "fat",
	"impaling": "imp",
	"small piercing": "pi-",
	"piercing": "pi",
	"large piercing": "pi+",
	"huge piercing": "pi++",
};


GURPS.parseDmg = (dmg) => {
 return dmg.replace(/^(\d+)d6?([-+]\d+)?([xX\*]\d+)? ?(\([.\d]+\))?(!)? ?(.*)$/g, "$1~$2~$3~$4~$5~$6")
};		// Allow opt '6' after 1d


GURPS.attributepaths = {
	"ST": "attributes.ST.value",
	"DX": "attributes.DX.value",
	"IQ": "attributes.IQ.value",
	"HT": "attributes.HT.value",
	"WILL": "attributes.WILL.value",
	"Will": "attributes.WILL.value",
	"PER": "attributes.PER.value",
	"Per": "attributes.PER.value"
};


// Map stuff back to translation keys... don't know if useful yet
GURPS.attributes = {
	"ST": "GURPS.attributesST",
	"DX": "GURPS.attributesDX",
	"IQ": "GURPS.attributesIQ",
	"HT": "GURPS.attributesHT",
	"Will": "GURPS.attributesWILL",
	"Per": "GURPS.attributesPER"
};

GURPS.attributeNames = {
	"ST": "GURPS.attributesSTNAME",
	"DX": "GURPS.attributesDXNAME",
	"IQ": "GURPS.attributesIQNAME",
	"HT": "GURPS.attributesHTNAME",
	"Will": "GURPS.attributesWILLNAME",
	"Per": "GURPS.attributesPERNAME"
};

GURPS.skillTypes = {
	"DX/E": "GURPS.SkillDXE",
	"DX/A": "GURPS.SkillDXA",
	"DX/H": "GURPS.SkillDXH",
	"DX/VH": "GURPS.SkillDXVH",

	"IQ/E": "GURPS.SkillIQE",
	"IQ/A": "GURPS.SkillIQA",
	"IQ/H": "GURPS.SkillIQH",
	"IQ/VH": "GURPS.SkillIQVH",

	"HT/E": "GURPS.SkillHTE",
	"HT/A": "GURPS.SkillHTA",
	"HT/H": "GURPS.SkillHTH",
	"HT/VH": "GURPS.SkillHTVH",

	"Will/E": "GURPS.SkillWillE",
	"Will/A": "GURPS.SkillWillA",
	"Will/H": "GURPS.SkillWillH",
	"Will/VH": "GURPS.SkillWillVH",

	"Per/E": "GURPS.SkillPerE",
	"Per/A": "GURPS.SkillPerA",
	"Per/H": "GURPS.SkillPerH",
	"Per/VH": "GURPS.SkillPerVH"
}

GURPS.PARSELINK_MAPPINGS = {
	"Vision": "vision",
	"VISION": "vision",
	"FRIGHTCHECK": "frightcheck",
	"Frightcheck": "frightcheck",
	"Fright check": "frightcheck",
	"Fright Check": "frightcheck",
	"Hearing": "hearing",
	"HEARING": "hearing",
	"TASTESMELL": "tastesmell",
	"Taste Smell": "tastesmell",
	"TASTE SMELL": "tastesmell",
	"TASTE": "tastesmell",
	"SMELL": "tastesmell",
	"Taste": "tastesmell",
	"Smell": "tastesmell",
	"TOUCH": "touch",
	"Touch": "touch",
}


GURPS.SavedStatusEffects = CONFIG.statusEffects;

CONFIG.statusEffects = [
	{
		icon: "systems/gurps/icons/shock1.png",
		id: "shock1",
		label: "EFFECT.StatusShocked"
	},
	{
		icon: "systems/gurps/icons/shock2.png",
		id: "shock2",
		label: "EFFECT.StatusShocked"
	},
	{
		icon: "systems/gurps/icons/shock3.png",
		id: "shock3",
		label: "EFFECT.StatusShocked"
	},
	{
		icon: "systems/gurps/icons/shock4.png",
		id: "shock4",
		label: "EFFECT.StatusShocked"
	},
	{
		icon: "systems/gurps/icons/stunned.png",
		id: "stun",
		label: "EFFECT.StatusStunned"
	},
	{
		icon: "systems/gurps/icons/falling.png",
		id: "prone",
		label: "EFFECT.StatusProne"
	},
	{
		icon: "systems/gurps/icons/kneeling.png",
		id: "kneel",
		label: "GURPS.STATUSKneel"
	},
	{
		icon: "systems/gurps/icons/leapfrog.png",
		id: "crouch",
		label: "GURPS.STATUSCrouch"
	},
	{
		icon: "systems/gurps/icons/wooden-chair.png",
		id: "sit",
		label: "GURPS.STATUSSit"
	},
	{
		icon: "systems/gurps/icons/euphoria.png",
		id: "euphoria",
		label: "GURPS.STATUSEuphoria"
	},
	{
		icon: "systems/gurps/icons/coughing.png",
		id: "coughing",
		label: "GURPS.STATUSCoughing"
	},
	{
		icon: "systems/gurps/icons/drowsy.png",
		id: "drowsy",
		label: "GURPS.STATUSDrowsy"
	},
	{
		icon: "systems/gurps/icons/drunk.png",
		id: "drunk",
		label: "GURPS.STATUSDrunk"
	},
	{
		icon: "systems/gurps/icons/tipsy.png",
		id: "tipsy",
		label: "GURPS.STATUSTipsy"
	},
	{
		icon: "systems/gurps/icons/nauseated.png",
		id: "nauseated",
		label: "GURPS.STATUSNauseated"
	},
	{
		icon: "systems/gurps/icons/moderate.png",
		id: "moderate",
		label: "GURPS.STATUSModerate"
	},
	{
		icon: "systems/gurps/icons/severe.png",
		id: "severe",
		label: "GURPS.STATUSSevere"
	},
	{
		icon: "systems/gurps/icons/terrible.png",
		id: "terrible",
		label: "GURPS.STATUSTerrible"
	},
	{
		icon: "systems/gurps/icons/vomiting.png",
		id: "retching",
		label: "GURPS.STATUSRetching"
	}
];

GURPS.SJGProductMappings = {
	"ACT1": "http://www.warehouse23.com/products/gurps-action-1-heroes",
	"ACT3": "http://www.warehouse23.com/products/gurps-action-3-furious-fists",
	"B": "http://www.warehouse23.com/products/gurps-basic-set-characters-and-campaigns",
	"BS": "http://www.warehouse23.com/products/gurps-banestorm",
	"DF1": "http://www.warehouse23.com/products/gurps-dungeon-fantasy-1-adventurers-1",
	"DF3": "http://www.warehouse23.com/products/gurps-dungeon-fantasy-3-the-next-level-1",
	"DF4": "http://www.warehouse23.com/products/gurps-dungeon-fantasy-4-sages-1",
	"DF8": "http://www.warehouse23.com/products/gurps-dungeon-fantasy-8-treasure-tables",
	"DF11": "http://www.warehouse23.com/products/gurps-dungeon-fantasy-11-power-ups",
	"DF12": "http://www.warehouse23.com/products/gurps-dungeon-fantasy-12-ninja",
	"DF13": "http://www.warehouse23.com/products/gurps-dungeon-fantasy-13-loadouts",
	"DF14": "http://www.warehouse23.com/products/gurps-dungeon-fantasy-14-psi",
	"DFM1": "http://www.warehouse23.com/products/gurps-dungeon-fantasy-monsters-1",
	"DFA": "http://www.warehouse23.com/products/dungeon-fantasy-roleplaying-game",
	"DFM": "http://www.warehouse23.com/products/dungeon-fantasy-roleplaying-game",
	"DFS": "http://www.warehouse23.com/products/dungeon-fantasy-roleplaying-game",
	"DFE": "http://www.warehouse23.com/products/dungeon-fantasy-roleplaying-game",
	"DR": "http://www.warehouse23.com/products/gurps-dragons-1",
	"F": "http://www.warehouse23.com/products/gurps-fantasy",
	"GUL": "https://www.gamesdiner.com/gulliver/",
	"H": "http://www.warehouse23.com/products/gurps-horror-1",
	"HF": "http://www.mygurps.com/historical_folks_4e.pdf",
	"HT": "http://www.warehouse23.com/products/gurps-high-tech-2",
	"IW": "http://www.warehouse23.com/products/gurps-infinite-worlds-1",
	"LT": "http://www.warehouse23.com/products/gurps-fourth-edition-low-tech",
	"LTC1": "http://www.warehouse23.com/products/gurps-low-tech-companion-1-philosophers-and-kings",
	"LTIA": "http://www.warehouse23.com/products/gurps-low-tech-instant-armor",
	"LITE": "http://www.warehouse23.com/products/SJG31-0004",
	"M": "http://www.warehouse23.com/products/gurps-magic-5",
	"MPS": "http://www.warehouse23.com/products/gurps-magic-plant-spells",
	"MA": "http://www.warehouse23.com/products/gurps-martial-arts",
	"MAFCCS": "http://www.warehouse23.com/products/gurps-martial-arts-fairbairn-close-combat-systems",
	"MATG": "http://www.warehouse23.com/products/gurps-martial-arts-technical-grappling",
	"MH1": "http://www.warehouse23.com/products/gurps-monster-hunters-1-champions",
	"MYST": "http://www.warehouse23.com/products/gurps-mysteries-1",
	"MYTH": "http://www.sjgames.com/gurps/books/myth/",
	"P": "http://www.warehouse23.com/products/gurps-powers",
	"PDF": "http://www.warehouse23.com/products/gurps-powers-divine-favor",
	"PSI": "http://www.warehouse23.com/products/gurps-psionic-powers",
	"PU1": "http://www.warehouse23.com/products/gurps-power-ups-1-imbuements-1",
	"PU2": "http://www.warehouse23.com/products/gurps-power-ups-2-perks",
	"PU3": "http://www.warehouse23.com/products/gurps-power-ups-3-talents",
	"PY#": "http://www.warehouse23.com/products?utf8=%E2%9C%93&keywords=pyramid+magazine&x=0&y=0",
	"RSWL": "http://www.warehouse23.com/products/gurps-reign-of-steel-will-to-live",
	"SU": "http://www.warehouse23.com/products/gurps-supers-3",
	"TMS": "http://www.warehouse23.com/products/gurps-thaumatology-magical-styles",
	"TRPM": "http://www.warehouse23.com/products/gurps-thaumatology-ritual-path-magic",
	"TS": "http://www.warehouse23.com/products/gurps-tactical-shooting",
	"TSOR": "http://www.warehouse23.com/products/gurps-thaumatology-sorcery",
	"UT": "http://www.warehouse23.com/products/gurps-ultra-tech",
	"VOR": "http://www.warehouse23.com/products/vorkosigan-saga-sourcebook-and-roleplaying-game"
}

GURPS.USER_GUIDE_URL = "https://bit.ly/2JaSlQd";


// This is an ugly hack to clean up the "formatted text" output from GCS FG XML.
// First we have to remove non-printing characters, and then we want to replace
// all <p>...</p> with .../n before we try to convert to JSON.   Also, for some reason,
// the DOMParser doesn't like some of the stuff in the formatted text sections, so
// we will base64 encode it, and the decode it in the Named subclass setNotes()
function cleanUpP(xml) {
	// First, remove non-ascii characters
	xml = xml.replace(/[^ -~]+/g, "");

	// Now try to remove any lone " & " in names, etc.  Will only occur in GCA output
	xml = xml.replace(/ & /g, " &amp; ");
	const swap = (xml, tagin, tagout) => {
		let s = xml.indexOf(tagin);
		while (s > 0) {
			const e = xml.indexOf(tagout, s);
			if (e > s) {
				const t1 = xml.substring(0, s);
				let t2 = xml.substring(s + 3, e);
				t2 = "@@@@" + btoa(t2) + "\n";
				const t3 = xml.substr(e + 4);
				xml = t1 + t2 + t3;
				s = xml.indexOf(tagin, s + t2.length);
			}
		}
		return xml;
	}
	xml = swap(xml, "&lt;p&gt;", "&lt;/p&gt;");
	xml = swap(xml, "<p>", "</p>");
	xml = xml.replace(/<br>/g, "\n");
	return xml;
}
GURPS.cleanUpP = cleanUpP;

function extractP(str) {
	let v = "";
	if (str) {
		const s = str.split("\n");
		for (let b of s) {
			if (b) {
				if (b.startsWith("@@@@")) {
					b = b.substr(4);
					v += atob(b) + "\n";
				} else
					v += b + "\n";
			}
		}
	}
	return v;
}
GURPS.extractP = extractP;


/*
	A utility function to "deep" print an object
*/
function objToString(obj, ndeep) {
	if (obj == null) {
 return String(obj);
}
	if (ndeep > 10) return "(stopping due to depth): " + obj.toString();
	switch (typeof obj) {
		case "string": return '"' + obj + '"';
		case "function": return obj.name || obj.toString();
		case "object":
			var indent = Array(ndeep || 1).join('\t'), isArray = Array.isArray(obj);
			return '{['[+isArray] + Object.keys(obj).map(function (key) {
				return '\n\t' + indent + key + ': ' + objToString(obj[key], (ndeep || 1) + 1);
			}).join(',') + '\n' + indent + '}]'[+isArray];
		default: return obj.toString();
	}
}
GURPS.objToString = objToString;

function trim(s) {
	return s.replace(/^\s*$(?:\r\n?|\n)/gm, "").trim();         // /^\s*[\r\n]/gm
}
GURPS.trim = trim;

//	"modifier", "attribute", "selfcontrol", "roll", "damage", "skill", "pdf"
function performAction(action, actor, event) {
	if (!action) return;
	const actordata = actor?.data;
	let prefix = "";
	let thing = "";
	let target = -1;	// There will be a roll
	let formula = "";
	const targetmods = []; 		// Should get this from the ModifierBucket someday
	const opt = {
		blind: action.blindroll,
		event: event
	};		// Ok, I am slowly learning this Javascrip thing ;-)

	if (action.type === "pdf") {
		GURPS.handlePdf(action.link);
		return;
	}

	if (action.type === "modifier") {
		const mod = parseInt(action.mod);
		GURPS.ModifierBucket.addModifier(mod, action.desc);
		return;
	}
	if (action.type === "attribute")
		if (actor) {
			prefix = "Roll vs ";
			thing = this.i18n(action.path);
			formula = "3d6";
			target = action.target;
			if (!target) target = this.resolve(action.path, actordata.data);
			target = parseInt(target);
			if (action.mod)
				targetmods.push(GURPS.ModifierBucket.makeModifier(action.mod, action.desc));
			else if (action.desc)
				opt.text = "<br>&nbsp;<span style='font-size:85%'>(" + action.desc + ")</span>";
		} else
			ui.notifications.warn("You must have a character selected");
	if (action.type === "selfcontrol") {
		prefix = "Self Control ";
		thing = action.desc;
		formula = "3d6";
		target = parseInt(action.target);
	}
	if (action.type === "roll") {
		prefix = "Rolling " + action.formula + " " + action.desc;
		formula = d6ify(action.formula);
	}
	if (action.type === "damage") {
		GURPS.damageChat.create(actor || game.user, action.formula, action.damagetype, event);
		return;
	}
	if (action.type === "deriveddamage")
		if (actor) {
			const df = (action.derivedformula == "SW" ? actordata.data.swing : actordata.data.thrust)
			formula = df + action.formula;
			GURPS.damageChat.create(actor || game.user, formula, action.damagetype, event, action.derivedformula + action.formula);
			return;
		} else
			ui.notifications.warn("You must have a character selected");
	if (action.type === "derivedroll")
		if (actor) {
			const df = (action.derivedformula == "SW" ? actordata.data.swing : actordata.data.thrust)
			formula = d6ify(df + action.formula);
			prefix = "Rolling " + action.derivedformula + action.formula + " " + action.desc;
		} else
			ui.notifications.warn("You must have a character selected");
	if (action.type === "skill-spell")
		if (actor) {
			let skill = null;
			prefix = "";  // "Attempting ";
			thing = action.name;
			skill = GURPS.findSkillSpell(actordata, thing);
			if (!skill) {
				ui.notifications.warn("No skill or spell named '" + action.name + "' found on " + actor.name);
				return;
			}
			thing = skill.name;
			target = parseInt(skill.level);
			formula = "3d6";
			if (action.mod) targetmods.push(GURPS.ModifierBucket.makeModifier(action.mod, action.desc));
		} else
			ui.notifications.warn("You must have a character selected");

	if (action.type === "attack")
		if (actor) {
			let att = null;
			prefix = "";
			thing = action.name;
			att = GURPS.findAttack(actordata, thing);
			if (!att) {
				ui.notifications.warn("No melee or ranged attack named '" + action.name + "' found on " + actor.name);
				return;
			}
			thing = att.name;
			target = parseInt(att.level);
			formula = "3d6";
			if (action.mod) targetmods.push(GURPS.ModifierBucket.makeModifier(action.mod, action.desc));
			if (att.mode)
				opt.text = "<br>&nbsp;<span style='font-size:85%'>(" + att.mode + ")</span>";
		} else
			ui.notifications.warn("You must have a character selected");

	if (action.type === "dodge")
		if (actor) {
			target = parseInt(actor.getCurrentDodge());
			formula = "3d6";
			thing = "Dodge";
		} else
			ui.notifications.warn("You must have a character selected");

	if (action.type === "mapped")
		if (actor) {
			target = actordata.data[action.path];
			formula = "3d6";
			thing = action.desc;
		} else
			ui.notifications.warn("You must have a character selected");

	if (action.type === "block-parry")
		if (actor) {
			thing = action.desc;
			if (!action.melee) target = actordata.data[action.path];		// Is there a basic parry or block stored, and we didn't try to identify a melee
			Object.values(actordata.data.melee).forEach(e => {
				if (!target || target < 0) {
					if (e[action.path]) {
						if (action.melee) {
							if (e.name.startsWith(action.melee)) {
								target = e[action.path];
								thing += " for " + e.name;
							}
						} else {
							target = e[action.path];
							thing += " for " + e.name;
						}
					}
				}
			});
			target = parseInt(target);
			if (target)
				formula = "3d6";
			else
				ui.notifications.warn("Unable to find a " + action.desc + " to roll");
		} else
			ui.notifications.warn("You must have a character selected");



	if (formula) doRoll(actor, formula, targetmods, prefix, thing, target, opt);
}
GURPS.performAction = performAction;

function findSkillSpell(actor, sname) {
	sname = sname.split("*").join(".*");
	let t = actor.data.skills?.findInProperties(s => s.name.match(sname));
	if (!t) t = actor.data.spells?.findInProperties(s => s.name.match(sname));
	return t;
}
GURPS.findSkillSpell = findSkillSpell;

function findAttack(actor, sname) {
	sname = sname.split("*").join(".*").replace(/\(/g, "\\(").replace(/\)/g, "\\)");  // Make string into a RegEx pattern
	let t = actor.data.melee?.findInProperties(a => (a.name + (a.mode ? " (" + a.mode + ")" : "")).match(sname));
	if (!t) t = actor.data.ranged?.findInProperties(a => (a.name + (a.mode ? " (" + a.mode + ")" : "")).match(sname));
	return t;
}
GURPS.findAttack = findAttack;

/*
	The user clicked on a field that would allow a dice roll.
	Use the element information to try to determine what type of roll.
*/
async function handleRoll(event, actor) {
	event.preventDefault();
	let formula = "";
	const targetmods = null;
	const element = event.currentTarget;
	let prefix = "";
	let thing = "";
	const opt = { event: event };
	let target = 0;		// -1 == damage roll, target = 0 is NO ROLL.

	if ("path" in element.dataset) {
		prefix = "Roll vs ";
		thing = this.i18n(element.dataset.path);
		formula = "3d6";
		target = parseInt(element.innerText);
	}
	if ("name" in element.dataset) {
		prefix = ""; // "Attempting ";
		const text = element.dataset.name.replace(/ \(\)$/g, "");  // sent as "name (mode)", and mode is empty
		thing = text.replace(/(.*?)\(.*\)/g, "$1");
		opt.text = text.replace(/.*?\((.*)\)/g, "<br>&nbsp;<span style='font-size:85%'>($1)</span>");
		if (opt.text === text) opt.text = "";
		if (element.dataset.key) opt.obj = GURPS.decode(actor.data, element.dataset.key);   // During the roll, we may want to extract something from the object
		formula = "3d6";
		let t = element.innerText;
		if (t) {
			t = t.trim();
			if (t)
				target = parseInt(t);
			if (isNaN(target)) target = 0;		// Can't roll against a non-integer
		}
	}
	if ("damage" in element.dataset) {
		// expect text like '2d+1 cut'
		let formula = element.innerText.trim();
		let dtype = ''

		const i = formula.lastIndexOf(' ');
		if (i > 0) {
			dtype = formula.substr(i + 1).trim();
			formula = formula.substring(0, i);
		}
		GURPS.damageChat.create(actor, formula, dtype, event)
		return
	}
	if ("roll" in element.dataset) {
		target = -1;   // Set flag to indicate a non-targeted roll
		formula = element.innerText;
		prefix = "Rolling " + formula;
		formula = d6ify(formula);
	}

	this.doRoll(actor, formula, targetmods, prefix, thing, target, opt);
}
GURPS.handleRoll = handleRoll;


// If the desc contains *Cost ?FP or *Max:9 then perform action
function applyModifierDesc(actor, desc) {
	let parse = desc.replace(/.*\* ?Costs? (\d+) ?FP.*/g, "$1");
	if (parse != desc && !!actor) {
		let fp = parseInt(parse);
		fp = actor.data.data.FP.value - fp;
		actor.update({ "data.FP.value": fp });
	}
	parse = desc.replace(/.*\*Max: ?(\d+).*/g, "$1");
	if (parse != desc) {
		return parseInt(parse);
	}
	return null;		// indicating no overriding MAX value
}
GURPS.applyModifierDesc = applyModifierDesc;


/*
	This is the BIG method that does the roll and prepares the chat message.
	unfortunately, it has a lot fo hard coded junk in it.
	*/
// formula="3d6", targetmods="[{ desc:"", mod:+-1 }]", thing="Roll vs 'thing'" or damagetype 'burn', target=skill level or -1=damage roll
async function doRoll(actor, formula, targetmods, prefix, thing, origtarget, optionalArgs) {

	if (origtarget == 0 || isNaN(origtarget)) return;	// Target == 0, so no roll.  Target == -1 for non-targetted rolls (roll, damage)
	const isTargeted = (origtarget > 0 && !!thing);		// Roll "against" something (true), or just a roll (false)

	// Is Dice So Nice enabled ?
	let niceDice = false;
	try {
 niceDice = game.settings.get('dice-so-nice', 'settings').enabled;
} catch { }

	// TODO Code below is duplicated in damagemessage.mjs (DamageChat) -- make sure it is updated in both places
	// Lets collect up the modifiers, they are used differently depending on the type of roll
	let modscontent = "";
	let modifier = 0;
	let maxtarget = null;			// If not null, then the target cannot be any higher than this.

	targetmods = await GURPS.ModifierBucket.applyMods(targetmods);		// append any global mods

	if (targetmods.length > 0) {
		modscontent = "<i>";
		for (const m of targetmods) {
			modifier += m.modint;
			modscontent += "<br> &nbsp;<span style='font-size:85%'>" + m.mod;
			if (m.desc) {
				modscontent += " : " + m.desc;
				maxtarget = GURPS.applyModifierDesc(actor, m.desc);
			}
			modscontent += "</span>";
		}
	}

	let chatcontent = "";
	let roll = null;  // Will be the Roll
	if (isTargeted) {		// This is a roll "against a target number", e.g. roll vs skill/attack/attribute/etc.
		let finaltarget = parseInt(origtarget) + modifier;
		if (!!maxtarget && finaltarget > maxtarget) finaltarget = maxtarget;
		roll = Roll.create(formula);		// The formula will always be "3d6" for a "targetted" roll
		roll.roll();
		const rtotal = roll.total;
		let results = "<div><span class='fa fa-dice'/>&nbsp;<span class='fa fa-long-arrow-alt-right'/> <b style='font-size: 140%;'>" + rtotal + "</b>";
		if (modscontent) modscontent += "</i><br>New Target: (" + finaltarget + ")";  // If we had modifiers, the target will have changed.

		// Actually, you aren't allowed to roll if the target is < 3... except for active defenses.   So we will just allow it and let the GM decide.
		const isCritSuccess = (rtotal <= 4) || (rtotal == 5 && finaltarget >= 15) || (rtotal == 6 && finaltarget >= 16);
		const isCritFailure = (rtotal >= 18) || (rtotal == 17 && finaltarget <= 15) || (rtotal - finaltarget >= 10 && finaltarget > 0);

		const margin = finaltarget - rtotal;

		if (isCritSuccess)
			results += " <span style='color:green; text-shadow: 1px 1px black; font-size: 130%;'><b>Critical Success!</b></span> ";
		else if (isCritFailure)
			results += " <span style='color:red; text-shadow: 1px 1px black; font-size: 120%;'><b>Critical Failure!</b></span> ";
		else if (margin >= 0)
			results += " <span style='color:green; font-size: 110%;'><b>Success!</b></span> ";
		else
			results += " <span style='color:red;font-size: 100%;'><i>Failure.</i></span> ";

		let rdesc = " <span style='font-size: 100%; font-weight: normal'>";
		if (margin == 0) rdesc += "just made it";
		if (margin > 0) rdesc += "made it by " + margin;
		if (margin < 0) rdesc += "missed it by " + (-margin);
		rdesc += "</span></div>";
		if (margin > 0 && !!optionalArgs.obj && !!optionalArgs.obj.rcl) {		// if the attached obj (see handleRoll()) as Recoil information, do the additional math
			let rofrcl = Math.floor(margin / parseInt(optionalArgs.obj.rcl)) + 1;
			if (optionalArgs.obj.rof) rofrcl = Math.min(rofrcl, parseInt(optionalArgs.obj.rof));
			if (rofrcl > 1) rdesc += `<div style='text-align: start'><span class='fa fa-bullseye'/>&nbsp;<i style='font-size:100%; font-weight: normal'>Total possible hits due to RoF/Rcl: </i><b style='font-size: 120%;'>${rofrcl}</b></div>`;
		}
		const optlabel = optionalArgs.text || "";
		chatcontent = prefix + thing + " (" + origtarget + ")" + optlabel + modscontent + "<br>" + "<div class='gurps-results'>" + results + rdesc + "</div>";
	} else {	// This is non-targeted, non-damage roll where the modifier is added to the roll, not the target
		// NOTE:   Damage rolls have been moved to damagemessage.js/DamageChat

		let min = 0
		if (formula.slice(-1) === '!') {
			formula = formula.slice(0, -1)
			min = 1
		}

		roll = Roll.create(formula + `+${modifier}`);
		roll.roll();
		let rtotal = roll.total;
		if (rtotal < min) {
			rtotal = min;
		}

		const results = "<i class='fa fa-dice'/> <i class='fa fa-long-arrow-alt-right'/> <b style='font-size: 140%;'>" + rtotal + "</b>";
		if (rtotal == 1) thing = thing.replace("points", "point");
		chatcontent = prefix + modscontent + "<br>" + results + thing;
	}

	actor = actor || game.user;
	const speaker = { alias: actor.name, _id: actor._id, actor: actor }
	const messageData = {
		user: game.user._id,
		speaker: speaker,
		content: "<div>" + chatcontent + "</div>", // wrap in HTML to trick Foundry
		type: CONST.CHAT_MESSAGE_TYPES.ROLL,
		roll: roll
	};
	let whoCanSeeDice = null;
	if (optionalArgs.event?.shiftKey) {
		whoCanSeeDice = [game.user._id];
		messageData.whisper = [game.user._id];
	}
	if (optionalArgs.blind) {
		messageData.whisper = ChatMessage.getWhisperRecipients("GM");
		messageData.blind = true;
	}

	messageData.sound = CONFIG.sounds.dice;
	CONFIG.ChatMessage.entityClass.create(messageData, {});

}
GURPS.doRoll = doRoll;

// Return html for text, parsing GURPS "links" into <span class="gurplink">XXX</span>
function gurpslink(str, clrdmods = true) {
	if (str === undefined)
		return "!!UNDEFINED";
	let found = -1;
	let output = "";
	for (let i = 0; i < str.length; i++) {
		if (str[i] == "[")
			found = ++i;
		if (str[i] == "]" && found >= 0) {
			output += str.substring(0, found - 1);
			const action = parselink(str.substring(found, i), "", clrdmods);
			if (!action.action) output += "[";
			output += action.text;
			if (!action.action) output += "]";
			str = str.substr(i + 1);
			i = 0;
			found = -1;
		}
	}
	output += str;
	return output;
}
GURPS.gurpslink = gurpslink;

// Convert GCS page refs into PDFoundry book & page.   Special handling for refs like "PU8:12"
function handleOnPdf(event) {
	event.preventDefault();
	GURPS.handlePdf(event.currentTarget.innerText);
}
GURPS.handleOnPdf = handleOnPdf;

function handlePdf(link) {
	const t = link.trim();
	const i = t.indexOf(":");
	let book = "";
	let page = 0;
	if (i > 0) {
		book = t.substring(0, i).trim();
		page = parseInt(t.substr(i + 1));
	} else {
		book = t.replace(/[0-9]*/g, "").trim();
		page = parseInt(t.replace(/[a-zA-Z]*/g, ""));
	}
	// Special case for Separate Basic Set PDFs
	if (book === "B") {
		const s = game.settings.get(settings.SYSTEM_NAME, settings.SETTING_BASICSET_PDF);
		if (page > 336)
			if (s === "Separate") {
				book = "BX";
				page = page - 335;
			} else
				page += 2;
	}
	if (ui.PDFoundry) {
		const pdf = ui.PDFoundry.findPDFDataByCode(book);
		if (pdf === undefined) {
			let url = game.GURPS.SJGProductMappings[book];
			if (!url) url = "http://www.warehouse23.com/products?taxons%5B%5D=558398545-sb";		// The main GURPS page
			window.open(url, '_blank');
		} else
			ui.PDFoundry.openPDF(pdf, { page });
	} else {
		ui.notifications.warn('PDFoundry must be installed to use links.');
	}
}
GURPS.handlePdf = handlePdf;


// Return the i18n string for this data path (note en.json must match up to the data paths).
// special case, drop ".value" from end of path (and append "NAME"), usually used for attributes
function i18n(path, suffix) {
	const i = path.indexOf(".value");
	if (i >= 0) {
		path = path.substr(0, i) + "NAME";	// used for the attributes
	}

	path = path.replace(/\./g, "");	// remove periods
	return game.i18n.localize("GURPS." + path);
}
GURPS.i18n = i18n;

// Given a string path "x.y.z", use it to resolve down an object heiracrhy
function resolve(path, obj = self, separator = '.') {
	const properties = Array.isArray(path) ? path : path.split(separator)
	return properties.reduce((prev, curr) => prev && prev[curr], obj)
}
GURPS.resolve = resolve;

/*
	A user has clicked on a "gurpslink", so we can assume that it previously qualified as a "gurpslink"
	and followed the On-the-Fly formulas.   As such, we may already have an action block (base 64 encoded so we can handle
	any text).  If not, we will just re-parse the text looking for the action block.
*/
function handleGurpslink(event, actor, desc) {
	event.preventDefault();
	const element = event.currentTarget;
	let action = element.dataset.action;		// If we have already parsed
	if (action)
		action = JSON.parse(atob(action));
	else
		action = parselink(element.innerText, desc).action;
	this.performAction(action, actor, event);
}
GURPS.handleGurpslink = handleGurpslink;


/* You may be asking yourself, why the hell is he generating fake keys to fit in an object
	when he could have just used an array.   Well, I had TONs of problems with the handlebars and Foundry
	trying to deal with an array.   While is "should" be possible to use it, and some people claim
	that they could... everything I tried did something wonky.   So the 2am fix was just make everything an
	object with fake indexes.   Handlebars deals with this just fine using {{#each someobject}}
	and if you really did just want to modify a single entry, you could use {{#each somobject as | obj key |}}
	which will give you the object, and also the key, such that you could execute somebject.key to get the
	correct instance.   */
function genkey(index) {
	let k = "";
	if (index < 10)
		k += "0";
	if (index < 100)
		k += "0";
	if (index < 1000)
		k += "0";
	if (index < 10000)
		k += "0";
	return k + index;
}
GURPS.genkey = genkey;

function put(obj, value, index = -1) {
	if (index == -1) {
		index = 0;
		while (obj.hasOwnProperty(this.genkey(index))) index++;
	}
	const k = this.genkey(index);
	obj[k] = value;
	return k;
}
GURPS.put = put;

// Convolutions to remove a key from an object and fill in the gaps, necessary because the default add behavior just looks for the first open gap
async function removeKey(actor, path) {
	let i = path.lastIndexOf(".");
	const objpath = path.substring(0, i);
	let key = path.substr(i + 1);
	i = objpath.lastIndexOf(".");
	const parentpath = objpath.substring(0, i);
	const objkey = objpath.substr(i + 1);
	const object = GURPS.decode(actor.data, objpath);
	const t = parentpath + ".-=" + objkey;
	await actor.update({ [t]: null });		// Delete the whole object
	delete object[key];
	i = parseInt(key);

	i = i + 1;
	while (object.hasOwnProperty(this.genkey(i))) {
		const k = this.genkey(i);
		object[key] = object[k];
		delete object[k];
		key = k;
		i++;
	}
	const sorted = Object.keys(object).sort().reduce((a, v) => {
 a[v] = object[v]; return a;
}, {});  // Enforced key order
	await actor.update({ [objpath]: sorted });
}
GURPS.removeKey = removeKey;

// Because the DB just merges keys, the best way to insert is to delete the whole colleciton object, fix it up, and then re-add it.
async function insertBeforeKey(actor, path, newobj) {
	let i = path.lastIndexOf(".");
	const objpath = path.substring(0, i);
	const key = path.substr(i + 1);
	i = objpath.lastIndexOf(".");
	const parentpath = objpath.substring(0, i);
	const objkey = objpath.substr(i + 1);
	const object = GURPS.decode(actor.data, objpath);
	const t = parentpath + ".-=" + objkey;
	await actor.update({ [t]: null });		// Delete the whole object
	const start = parseInt(key);

	i = start + 1;
	while (object.hasOwnProperty(this.genkey(i))) i++;
	i = i - 1;
	for (let z = i; z >= start; z--) {
		object[genkey(z + 1)] = object[genkey(z)];
	}
	object[key] = newobj;
	const sorted = Object.keys(object).sort().reduce((a, v) => {
 a[v] = object[v]; return a;
}, {});  // Enforced key order
	await actor.update({ [objpath]: sorted });
}
GURPS.insertBeforeKey = insertBeforeKey;

function decode(obj, path, all = true) {
	const p = path.split(".");
	let end = p.length;
	if (!all) end = end - 1;
	for (let i = 0; i < end; i++) {
		const q = p[i];
		obj = obj[q];
	}
	return obj;
}
GURPS.decode = decode;

/*  Funky helper function to be able to list hierarchical equipment in a linear list (with appropriate keys for editing)
*/
function listeqtrecurse(eqts, options, level, data, parentkey = "") {
	if (!eqts) return "";
	let ret = "";
	const i = 0;
	for (const key in eqts) {
		const eqt = eqts[key];
		if (data) {
			data.indent = level;
			data.key = parentkey + key;
		}
		ret = ret + options.fn(eqt, { data: data });
		ret = ret + GURPS.listeqtrecurse(eqt.contains, options, level + 1, data, parentkey + key + ".contains.");
	}
	return ret;
}
GURPS.listeqtrecurse = listeqtrecurse;

// Given a jquery html, attach all of our listeners to it.  No need to call bind(), since they don't use "this"
function hookupGurps(html) {
	html.find(".gurpslink").click(GURPS.chatClickGurpslink);
	html.find(".gmod").click(GURPS.chatClickGmod);
	html.find(".glinkmod").click(GURPS.chatClickGmod);
	html.find(".glinkmodplus").click(GURPS.chatClickGmod);
	html.find(".glinkmodminus").click(GURPS.chatClickGmod);
	html.find(".pdflink").click(GURPS.handleOnPdf);
}
GURPS.hookupGurps = hookupGurps;


function chatClickGurpslink(event) {
	game.GURPS.handleGurpslink(event, game.GURPS.LastActor);
}
GURPS.chatClickGurpslink = chatClickGurpslink;


function chatClickGmod(event) {
	const element = event.currentTarget;
	const desc = element.dataset.name;
	game.GURPS.handleGurpslink(event, game.GURPS.LastActor, desc);
}
GURPS.chatClickGmod = chatClickGmod;

GURPS.rangeObject = new GURPSRange()
GURPS.initiative = new Initiative()
GURPS.hitpoints = new HitFatPoints()
GURPS.hitLocationTooltip = new HitLocationEquipmentTooltip()
GURPS.damageChat = new DamageChat()

// Modifier Bucket must be defined after hit locations
GURPS.ModifierBucket = new ModifierBucket({
	"popOut": false,
	"minimizable": false,
	"resizable": false,
	"id": "ModifierBucket",
	"template": "systems/gurps/templates/modifier-bucket.html",
	"classes": [],
});

GURPS.ThreeD6 = new ThreeD6({
	"popOut": false,
	"minimizable": false,
	"resizable": false,
	"id": "ThreeD6",
	"template": "systems/gurps/templates/threed6.html",
	"classes": [],
});



/*********************  HACK WARNING!!!! *************************/
/* The following method has been secretly added to the Object class/prototype to
	 make it work like an Array.
*/
Object.defineProperty(Object.prototype, 'findInProperties', {
	value: function (expression) {
		return Object.values(this).find(expression);
	}
});

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */
Hooks.once("init", async function () {
	console.log(GURPS.BANNER);
	console.log(`Initializing GURPS 4e Game Aid`);
	console.log(GURPS.LEGAL);
	game.GURPS = GURPS;
	CONFIG.GURPS = GURPS;

	// Define custom Entity classes
	CONFIG.Actor.entityClass = GurpsActor;
	CONFIG.Item.entityClass = GurpsItem;

	// preload drag-and-drop image
	const img = new Image();
	img.src = 'systems/gurps/icons/blood-splatter-clipart-small.png'
	GURPS.damageDragImage = img

	// Register sheet application classes
	Actors.unregisterSheet("core", ActorSheet);
	Actors.registerSheet("gurps", GurpsActorSheet, { label: "Full (GCS)", makeDefault: true });
	Actors.registerSheet("gurps", GurpsActorCombatSheet, { label: "Combat", makeDefault: false });
	Actors.registerSheet("gurps", GurpsActorEditorSheet, { label: "Editor", makeDefault: false });
	Actors.registerSheet("gurps", GurpsActorSimplifiedSheet, { label: "Simple", makeDefault: false });
	Actors.registerSheet("gurps", GurpsActorNpcSheet, { label: "NPC/mini", makeDefault: false });

	Items.unregisterSheet("core", ItemSheet);
	Items.registerSheet("gurps", GurpsItemSheet, { makeDefault: true });

	Hooks.on('chatMessage', (log, content, data) => {
		if (content === "/help" || content === "!help") {
			let c = "<a href='" + GURPS.USER_GUIDE_URL + "'>GURPS 4e Game Aid USERS GUIDE</a><br>/help - this message";
			if (game.user.isGM) c += "<br>/mook - Open Mook Generator";
			ChatMessage.create({
				content: c,
				user: game.user._id,
				type: CONST.CHAT_MESSAGE_TYPES.OTHER
			});
			return false;
		}
		if (content === "/mook" && game.user.isGM) {
			new NpcInput().render(true);
			return false;
		}
		const re = /^(\/r|\/roll) \[([^\]]+)\]/;
		let found = false;
		content.split("\n").forEach(e => {		// Handle multiline chat messages (mostly from macros)
			const m = e.match(re);
			if (!!m && !!m[2]) {
				const action = parselink(m[2]);
				if (action.action) {
					GURPS.performAction(action.action, GURPS.LastActor);
					found = true;
				}
			}
		});
		if (found) return false;

	});

	// Look for blind messages with .message-results and remove them
	/*	Hooks.on("renderChatMessage", (log, content, data) => {
		if (!!data.message.blind) {
				if (data.author?.isSelf && !data.author.isGm) {		// We are rendering the chat message for the sender (and they are not the GM)
					$(content).find(".gurps-results").html("...");  // Replace gurps-results with "...".  Does nothing if not there.
				}
			}
		});  */

	// Add the "for" attribute to a collapsible panel label. This is needed
	// because the server in 0.7.8 strips the "for" attribute in an attempt
	// to guard against weird security hacks. When "for" is whitelisted as
	// a valid attribute (future) we can remove this.
	Hooks.on('renderChatMessage', (app, html, msg) => {
		// this is a fucking hack
		const wrapper = html.find('.collapsible-wrapper')
		if (wrapper.length > 0) {
			console.log($(wrapper).html())
			const input = $(wrapper).find('input.toggle')[0]
			const label = $(input).siblings('label.label-toggle')[0]
			const id = input.id
			const labelFor = $(label).attr('for')
			if (labelFor !== id) {
				$(label).attr('for', id)
			}
			console.log($(wrapper).html())
		}
	})


	ui.modifierbucket = GURPS.ModifierBucket;
	ui.modifierbucket.render(true);
});

Hooks.once("ready", async function () {
	GURPS.ModifierBucket.clear();
	GURPS.ThreeD6.refresh();

	// Show changelog
	const v = game.settings.get(settings.SYSTEM_NAME, settings.SETTING_CHANGELOG_VERSION) || "0.0.1";
	const changelogVersion = SemanticVersion.fromString(v);
	const curVersion = SemanticVersion.fromString(game.system.data.version);

	if (curVersion.isHigherThan(changelogVersion)) {
		if ($(ui.chat.element).find("#GURPS-LEGAL").length == 0)    // If it isn't already in the chat log somewhere
			ChatMessage.create({
				content: `<div id="GURPS-LEGAL" style='font-size:85%'>${game.system.data.title}</div><hr><div style='font-size:70%'>${GURPS.LEGAL}</div>`,
				type: CONST.CHAT_MESSAGE_TYPES.WHISPER,
				whisper: [game.user]
			});
		if (game.settings.get(settings.SYSTEM_NAME, settings.SETTING_SHOW_CHANGELOG)) {
			const app = new ChangeLogWindow(changelogVersion);
			app.render(true);
			game.settings.set(settings.SYSTEM_NAME, settings.SETTING_CHANGELOG_VERSION, curVersion.toString());
		}
	}

	Hooks.on('renderCombatTracker', function (a, html, c) {
		// use class 'bound' to know if the drop event is already bound
		if (!html.hasClass('bound')) {
			html.addClass('bound')
			html.on('drop', function (ev) {
				console.log('Haandle drop event on combatTracker')
				ev.preventDefault()
				ev.stopPropagation()
				const elementMouseIsOver = document.elementFromPoint(ev.clientX, ev.clientY)

				const combatant = $(elementMouseIsOver).parents(".combatant").attr("data-combatant-id")
				const target = game.combat.combatants.filter(c => c._id === combatant)[0]

				const event = ev.originalEvent
				const dropData = JSON.parse(event.dataTransfer.getData("text/plain"));
				if (dropData.type === 'damageItem') {
					target.actor.handleDamageDrop(dropData.payload)
				}
			})
		}
	})

	// This hook is currently only used for the GM Push feature of the Modifier Bucket.    Of course, we can add more later.
	Hooks.on('updateUser', (...args) => {
		if (args) {
			if (args.length >= 4) {
				const source = args[3];
				const target = args[1]._id;
				//				console.log("Update for: " + game.users.get(target).name + " from: " + game.users.get(source).name);
				if (target == game.user.id) {
					if (source != target) {		// Someone else (a GM) is updating your data.
						const date = args[1].flags?.gurps?.modifierchanged;			// Just look for the "modifierchanged" data (which will be a date in ms... something that won't be the same)
						if (date) game.GURPS.ModifierBucket.updateDisplay(date);
					}
				}
			}
		}
	});

	Hooks.on('createActiveEffect', (...args) => {
		if (!!args && args.length >= 4)
			GURPS.SetLastActor(args[0]);
	});

	// Keep track of which token has been activated, so we can determine the last actor for the Modifier Bucket (only when args[1] is true)
	Hooks.on("controlToken", (...args) => {
		if (args.length > 1 && args[1]) {
			const a = args[0]?.actor;
			if (a) game.GURPS.SetLastActor(a);
		}
	});

	Hooks.on('preCreateChatMessage', (data, options, userId) => {
		const c = data.content;
		try {
			const html = $(c);
			const rt = html.find(".result-text");		// Ugly hack to find results of a roll table to see if an OtF should be "rolled" /r /roll
			const re = /^(\/r|\/roll) \[([^\]]+)\]/;
			const t = rt[0]?.innerText;
			if (t) {
				t.split("\n").forEach(e => {
					const m = e.match(re);
					if (!!m && !!m[2]) {
						const action = parselink(m[2]);
						if (action.action) {
							GURPS.performAction(action.action, GURPS.LastActor);
							//					return false;	// Return false if we don't want the rolltable chat message displayed.  But I think we want to display the rolltable result.
						}
					}
				});
			}
		} catch (e) { }	// a dangerous game... but limited to GURPs /roll OtF
		data.content = game.GURPS.gurpslink(c);
	});

	Hooks.on('renderChatMessage', (app, html, msg) => {
		GURPS.hookupGurps(html);
	});

	Hooks.on('renderJournalSheet', (app, html, opts) => {
		const h = html.find(".editor-content");
		if (h) {
			h.html(GURPS.gurpslink(h[0].innerHTML));
			GURPS.hookupGurps(html);
		}
	});

	/**
	 * Add a listener to handle damage being dropped on a token.
	 */
	Hooks.on('dropCanvasData', function (canvas, dropData) {
		const grid_size = canvas.scene.data.grid

		const numberTargets = canvas.tokens.targetObjects({
			x: dropData.x - grid_size / 2,
			y: dropData.y - grid_size / 2,
			height: grid_size,
			width: grid_size,
			releaseOthers: true
		})

		// actual targets are stored in game.user.targets
		if (game.user.targets.size === 1) {
			const keys = game.user.targets.keys()
			const first = keys.next()
			if (dropData.type === 'damageItem') {
				first.value.actor.handleDamageDrop(dropData.payload)
			}
		}
	})

	// define Handlebars partials for ADD:
	const __dirname = 'systems/gurps/templates'
	loadTemplates([
		__dirname + '/apply-damage/effect-blunttrauma.html',
		__dirname + '/apply-damage/effect-crippling.html',
		__dirname + '/apply-damage/effect-headvitalshit.html',
		__dirname + '/apply-damage/effect-knockback.html',
		__dirname + '/apply-damage/effect-majorwound.html',
		__dirname + '/apply-damage/effect-shock.html',
	])
});

