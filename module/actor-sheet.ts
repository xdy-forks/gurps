import { GURPS } from "./gurps.js";
import { isNiceDiceEnabled } from '../lib/utilities.js'
import { Melee, Reaction, Ranged, Advantage, Skill, Spell, Equipment, Note } from './actor.js';
import parselink from '../lib/parselink.js';
/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class GurpsActorSheet extends ActorSheet {
	public actor: any;
	public element: any;
	public options: any;

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["gurps", "sheet", "actor"],
      template: "systems/gurps/templates/actor-sheet-gcs.html",
      width: 800,
      height: 800,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      scrollY: [".gurpsactorsheet #advantages #reactions #melee #ranged #skills #spells #equipment #other_equipment #notes"],
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
    });
  }

  /* -------------------------------------------- */

  flt(str) {
    return str ? parseFloat(str) : 0;
  }

  sum(dict, type) {
    if (!dict) return 0.0;
    let sum = 0;
    for (const k in dict) {
      const e = dict[k];
      const c = this.flt(e.count);
      const t = this.flt(e[type])
      sum += c * t;
      sum += this.sum(e.contains, type);
    }
    return parseInt(sum * 100) / 100;
  }

  /** @override */
  getData() {
    const sheetData = super.getData();
    sheetData.ranges = game.GURPS.rangeObject.ranges;
    game.GURPS.SetLastActor(this.actor);
    const eqt = this.actor.data.data.equipment || {};
    sheetData.eqtsummary = {
      eqtcost: this.sum(eqt.carried, "cost"),
      eqtlbs: this.sum(eqt.carried, "weight"),
      othercost: this.sum(eqt.other, "cost")
    };
    return sheetData;
  }

  /* -------------------------------------------- */


  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    html.find(".gurpsactorsheet").each((i, li) => {
 li.addEventListener('mousedown', ev => this._onfocus(ev), false)
});
    html.find(".gurpsactorsheet").each((i, li) => {
 li.addEventListener('focus', ev => this._onfocus(ev), false)
});
    html.find(".rollable").click(this._onClickRoll.bind(this));
    GURPS.hookupGurps(html);
    html.find(".gurpslink").contextmenu(this._onRightClickGurpslink.bind(this));
    html.find(".glinkmod").contextmenu(this._onRightClickGurpslink.bind(this));
    html.find("[data-otf]").contextmenu(this._onRightClickOtf.bind(this));
    html.find(".gmod").contextmenu(this._onRightClickGmod.bind(this));
    html.find(".pdflink").contextmenu(this._onRightClickPdf.bind(this));


    html.find(".dblclksort").dblclick(this._onDblclickSort.bind(this));
    html.find(".enc").click(this._onClickEnc.bind(this));

    html.find(".eqtdraggable").each((i, li) => {
      li.setAttribute("draggable", true);
      li.addEventListener("dragstart", ev => {
        return ev.dataTransfer.setData("text/plain", JSON.stringify({ "type": "equipment", "key": ev.currentTarget.dataset.key }))
      })
    });

    html.find(".adsdraggable").each((i, li) => {
      li.setAttribute("draggable", true);
      li.addEventListener("dragstart", ev => {
        return ev.dataTransfer.setData("text/plain", JSON.stringify({ "type": "advantage", "key": ev.currentTarget.dataset.key }))
      })
    });

    html.find(".skldraggable").each((i, li) => {
      li.setAttribute("draggable", true);
      li.addEventListener("dragstart", ev => {
        return ev.dataTransfer.setData("text/plain", JSON.stringify({ "type": "skill", "key": ev.currentTarget.dataset.key }))
      })
    });

    html.find(".spldraggable").each((i, li) => {
      li.setAttribute("draggable", true);
      li.addEventListener("dragstart", ev => {
        return ev.dataTransfer.setData("text/plain", JSON.stringify({ "type": "spell", "key": ev.currentTarget.dataset.key }))
      })
    });
  }

  async _onDblclickSort(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const key = element.dataset.key;
    const self = this;

    const d = new Dialog({
      title: "Sort list",
      buttons: {
        one: {
          icon: '<i class="fas fa-sort-alpha-up"></i>',
          label: "Ascending",
          callback: async () => {
            const i = key.lastIndexOf(".");
            const parentpath = key.substring(0, i);
            const objkey = key.substr(i + 1);
            const object = GURPS.decode(this.actor.data, key);
            const t = parentpath + ".-=" + objkey;
            await self.actor.update({ [t]: null });		// Delete the whole object
            const sortedobj = {};
            let index = 0;
            Object.values(object).sort((a, b) => a.name.localeCompare(b.name)).forEach(o => game.GURPS.put(sortedobj, o, index++));
            await self.actor.update({ [key]: sortedobj });
          }
        },
        two: {
          icon: '<i class="fas fa-sort-alpha-down"></i>',
          label: "Descending",
          callback: async () => {
            const i = key.lastIndexOf(".");
            const parentpath = key.substring(0, i);
            const objkey = key.substr(i + 1);
            const object = GURPS.decode(this.actor.data, key);
            const t = parentpath + ".-=" + objkey;
            await self.actor.update({ [t]: null });		// Delete the whole object
            const sortedobj = {};
            let index = 0;
            Object.values(object).sort((a, b) => b.name.localeCompare(a.name)).forEach(o => game.GURPS.put(sortedobj, o, index++));
            await self.actor.update({ [key]: sortedobj });
          }
        }
      },
      default: "one",
    });
    d.render(true);
  }


  /* -------------------------------------------- */

  /** @override */
  async _onDrop(event) {
    const dragData = JSON.parse(event.dataTransfer.getData("text/plain"));

    if (dragData.type === 'damageItem') {
      this.actor.handleDamageDrop(dragData.payload)
    }

    this.handleDragFor(event, dragData, "advantage", "adsdraggable");
    this.handleDragFor(event, dragData, "skill", "skldraggable");
    this.handleDragFor(event, dragData, "spell", "spldraggable");

    if (dragData.type === 'equipment') {
      const element = event.target;
      const classes = $(element).attr('class') || "";
      if (!classes.includes('eqtdraggable') && !classes.includes('eqtdragtarget')) return;
      const targetkey = element.dataset.key;
      if (targetkey) {
        const srckey = dragData.key;

        if (srckey.includes(targetkey) || targetkey.includes(srckey)) {
          ui.notifications.error("Unable to drag and drop withing the same hierarchy.   Try moving it elsewhere first.");
          return;
        }
        const object = GURPS.decode(this.actor.data, srckey);
        // Because we may be modifing the same list, we have to check the order of the keys and
        // apply the operation that occurs later in the list, first (to keep the indexes the same)
        const srca = srckey.split(".");
        srca.splice(0, 3);
        const tara = targetkey.split(".");
        tara.splice(0, 3);
        const max = Math.min(srca.length, tara.length);
        let isSrcFirst = false;
        for (let i = 0; i < max; i++) {
          if (parseInt(srca[i]) < parseInt(tara[i])) isSrcFirst = true;
        }
        if (targetkey.endsWith(".other") || targetkey.endsWith(".carried")) {
          const target = GURPS.decode(this.actor.data, targetkey);
          if (!isSrcFirst) await GURPS.removeKey(this.actor, srckey);
          GURPS.put(target, object);
          await this.actor.update({ [targetkey]: target });
          if (isSrcFirst) await GURPS.removeKey(this.actor, srckey);
        } else {
          const d = new Dialog({
            title: object.name,
            content: "<p>Where do you want to drop this?</p>",
            buttons: {
              one: {
                icon: '<i class="fas fa-level-up-alt"></i>',
                label: "Before",
                callback: async () => {
                  if (!isSrcFirst) await GURPS.removeKey(this.actor, srckey);
                  await GURPS.insertBeforeKey(this.actor, targetkey, object);
                  if (isSrcFirst) await GURPS.removeKey(this.actor, srckey);
                }
              },
              two: {
                icon: '<i class="fas fa-sign-in-alt"></i>',
                label: "In",
                callback: async () => {
                  if (!isSrcFirst) await GURPS.removeKey(this.actor, srckey);
                  await GURPS.insertBeforeKey(this.actor, targetkey + ".contains." + GURPS.genkey(0), object);
                  if (isSrcFirst) await GURPS.removeKey(this.actor, srckey);
                }
              }
            },
            default: "one",
          });
          d.render(true);
        }
      }
    }
  }


  async handleDragFor(event, dragData, type, cls) {
    if (dragData.type === type) {
      const element = event.target;
      const classes = $(element).attr('class') || "";
      if (!classes.includes(cls)) return;
      const targetkey = element.dataset.key;
      if (targetkey) {
        const srckey = dragData.key;
        if (srckey.includes(targetkey) || targetkey.includes(srckey)) {
          ui.notifications.error("Unable to drag and drop withing the same hierarchy.   Try moving it elsewhere first.");
          return;
        }
        const object = GURPS.decode(this.actor.data, srckey);
        // Because we may be modifing the same list, we have to check the order of the keys and
        // apply the operation that occurs later in the list, first (to keep the indexes the same)
        const srca = srckey.split(".");
        srca.splice(0, 3);
        const tara = targetkey.split(".");
        tara.splice(0, 3);
        const max = Math.min(srca.length, tara.length);
        let isSrcFirst = false;
        for (let i = 0; i < max; i++) {
          if (parseInt(srca[i]) < parseInt(tara[i])) isSrcFirst = true;
        }
        if (!isSrcFirst) await GURPS.removeKey(this.actor, srckey);
        await GURPS.insertBeforeKey(this.actor, targetkey, object);
        if (isSrcFirst) await GURPS.removeKey(this.actor, srckey);
      }
    }

  }


  _onfocus(ev) {
    game.GURPS.SetLastActor(this.actor);
  }

  /** @override */
  setPosition(options = {}) {
    const position = super.setPosition(options);
    const sheetBody = this.element.find(".sheet-body");
    const bodyHeight = position.height - 192;
    sheetBody.css("height", bodyHeight);
    return position;
  }

  get title() {
    const t = this.actor.name;
    const sheet = this.actor.getFlag("core", "sheetClass");
    return (sheet === "gurps.GurpsActorEditorSheet") ? "**** Editing: " + t + " ****" : t;
  }

  _getHeaderButtons() {
    let buttons = super._getHeaderButtons();

    const sheet = this.actor.getFlag("core", "sheetClass");
    const isFull = sheet === undefined || sheet === "gurps.GurpsActorSheet";
    const isEditor = sheet === "gurps.GurpsActorEditorSheet";

    // Token Configuration
    const canConfigure = game.user.isGM || this.actor.owner;
    if (this.options.editable && canConfigure) {
      const b = [
        {
          label: isFull ? "Combat View" : "Full View",
          class: "toggle",
          icon: "fas fa-exchange-alt",
          onclick: ev => this._onToggleSheet(ev)
        },
        {
          label: "Import",
          class: "import",
          icon: "fas fa-file-import",
          onclick: ev => this._onFileImport(ev)
        }
      ];
      if (!isEditor) {
        b.push(
          {
            label: "Editor",
            class: "edit",
            icon: "fas fa-edit",
            onclick: ev => this._onOpenEditor(ev)
          });
      }
      buttons = b.concat(buttons);
    }
    return buttons
  }

  async _onFileImport(event) {
    event.preventDefault();
    const element = event.currentTarget;
    new Dialog({
      title: `Import character data for: ${this.actor.name}`,
      content: await renderTemplate("systems/gurps/templates/import-gcs-v1-data.html", { name: '"' + this.actor.name + '"' }),
      buttons: {
        import: {
          icon: '<i class="fas fa-file-import"></i>',
          label: "Import",
          callback: html => {
            const form = html.find("form")[0];
            const files = form.data.files;
            let file = null;
            if (!files.length) {
              return ui.notifications.error("You did not upload a data file!");
            } else {
              file = files[0];
              readTextFromFile(file).then(text => this.actor.importFromGCSv1(text, file.name, file.path));
            }
          }
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "import"
    }, {
      width: 400
    }).render(true);
  }

  async _onToggleSheet(event) {
    event.preventDefault()
    let newSheet = "gurps.GurpsActorCombatSheet"

    const original = this.actor.getFlag("core", "sheetClass") || Object.values(CONFIG.Actor.sheetClasses["character"]).filter(s => s.default)[0].id;
    console.log("original: " + original)

    if (original != "gurps.GurpsActorSheet") newSheet = "gurps.GurpsActorSheet";
    if (event.shiftKey)   // Hold down the shift key for Simplified
      newSheet = "gurps.GurpsActorSimplifiedSheet";
    if (event.ctrlKey || event.metaKey)   // Hold down the Ctrl key (Command on Mac) for Simplified
      newSheet = "gurps.GurpsActorNpcSheet";

    await this.actor.sheet.close()

    // Update the Entity-specific override
    await this.actor.setFlag("core", "sheetClass", newSheet)

    // Re-draw the updated sheet
    const updated = this.actor.getFlag("core", "sheetClass")
    console.log("updated: " + updated)
    this.actor.sheet.render(true)
  }

  async _onOpenEditor(event) {
    event.preventDefault();
    await this.actor.sheet.close();
    await this.actor.setFlag("core", "sheetClass", "gurps.GurpsActorEditorSheet");
    this.actor.sheet.render(true)
  }

  async _onRightClickGurpslink(event) {
    event.preventDefault();
    const el = event.currentTarget;
    let action = el.dataset.action;
    if (action) {
      action = JSON.parse(atob(action));
      this.whisperOtfToOwner(action.orig, event, (action.hasOwnProperty("blindroll") && !action.blindroll));  // only offer blind rolls for things that can be blind, No need to offer blind roll if it is already blind
    }
  }

  async _onRightClickPdf(event) {
    event.preventDefault();
    const el = event.currentTarget;
    this.whisperOtfToOwner("PDF:" + el.innerText, event);
  }

  async _onRightClickGmod(event) {
    event.preventDefault();
    const el = event.currentTarget;
    const n = el.dataset.name;
    const t = el.innerText;
    this.whisperOtfToOwner(t + " " + n, event);
  }

  async _onRightClickOtf(event) {
    event.preventDefault();
    const el = event.currentTarget;
    this.whisperOtfToOwner(event.currentTarget.dataset.otf, event, !el.dataset.hasOwnProperty("damage"));    // Can't blind roll damages (yet)
  }

  async whisperOtfToOwner(otf, event, canblind?) {
    if (!game.user.isGM) return;
    if (otf) {
      otf = otf.replace(/ \(\)/g, "");  // sent as "name (mode)", and mode is empty (only necessary for attacks)
      const users = this.actor.getUsers(CONST.ENTITY_PERMISSIONS.OWNER, true).filter(u => !u.isGM);
      const botf = "[!" + otf + "]"
      otf = "[" + otf + "]";
      const buttons = {};
      buttons.one = {
        icon: '<i class="fas fa-users"></i>',
        label: "To Everyone",
        callback: () => this.sendOtfMessage(otf, false)
      }
      if (canblind)
        buttons.two = {
          icon: '<i class="fas fa-users-slash"></i>',
          label: "Blindroll to Everyone",
          callback: () => this.sendOtfMessage(botf, true)
        };
      if (users.length > 0) {
        const nms = users.map(u => u.name).join(' ');
        buttons.three = {
          icon: '<i class="fas fa-user"></i>',
          label: "Whisper to " + nms,
          callback: () => this.sendOtfMessage(otf, false, users)
        }
        if (canblind)
          buttons.four = {
            icon: '<i class="fas fa-user-slash"></i>',
            label: "Whisper Blindroll to " + nms,
            callback: () => this.sendOtfMessage(botf, true, users)
          }
      }

      const d = new Dialog({
        title: "GM 'Send Formula'",
        content: `<div style='text-align:center'>How would you like to send the formula:<br><br><div style='font-weight:700'>${otf}<br>&nbsp;</div>`,
        buttons: buttons,
        default: "four"
      });
      d.render(true);
    }
  }

  sendOtfMessage(content, blindroll, users?) {
    const msgData = {
      content: content,
      user: game.user._id,
      blind: blindroll
    }
    if (users) {
      msgData.type = CONST.CHAT_MESSAGE_TYPES.WHISPER;
      msgData.whisper = users.map(it => it._id);
    } else {
      msgData.type = CONST.CHAT_MESSAGE_TYPES.OOC;
    }
    ChatMessage.create(msgData);
  }

  async _onClickRoll(event) {
    game.GURPS.handleRoll(event, this.actor);
  }

  async _onClickEnc(ev) {
    ev.preventDefault();
    const element = ev.currentTarget;
    const key = element.dataset.key;
    const encs = this.actor.data.data.encumbrance;
    if (encs[key].current) return;  // already selected
    for (const enckey in encs) {
      const enc = encs[enckey];
      const t = "data.encumbrance." + enckey + ".current";
      if (enc.current) {
        await this.actor.update({ [t]: false });
      }
      if (key === enckey) {
        await this.actor.update({ [t]: true });
      }
    }
  }


  /* -------------------------------------------- */

  /** @override */
  _updateObject(event, formData) {

    return super._updateObject(event, formData);
  }
}

export class GurpsActorCombatSheet extends GurpsActorSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["gurps", "sheet", "actor"],
      template: "systems/gurps/templates/combat-sheet.html",
      width: 550,
      height: 275,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
    });
  }
}

export class GurpsActorEditorSheet extends GurpsActorSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["gurps", "gurpsactorsheet", "sheet", "actor"],
      template: "systems/gurps/templates/actor-sheet-gcs-editor.html",
      scrollY: [".gurpsactorsheet #advantages #reactions #melee #ranged #skills #spells #equipment #other_equipment #notes"],
      width: 800,
      height: 800,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
    });
  }

  makeAddDeleteMenu(html, cssclass, obj) {
    new ContextMenu(html, cssclass, this.addDeleteMenu(obj));
  }

  addDeleteMenu(obj) {
    return [
      {
        name: "Add Before",
        icon: "<i class='fas fa-edit'></i>",
        callback: e => {
          GURPS.insertBeforeKey(this.actor, e[0].dataset.key, duplicate(obj));
        }
      },
      {
        name: "Delete",
        icon: "<i class='fas fa-trash'></i>",
        callback: e => {
          GURPS.removeKey(this.actor, e[0].dataset.key);
        }
      },
      {
        name: "Add at the end",
        icon: "<i class='fas fa-edit'></i>",
        callback: e => {
          const p = e[0].dataset.key;
          const i = p.lastIndexOf(".");
          const objpath = p.substring(0, i);
          const o = GURPS.decode(this.actor.data, objpath);
          GURPS.put(o, duplicate(obj));
          this.actor.update({ [objpath]: o });
        }
      }
    ];
  }

  headerMenu(name, obj, path) {
    return [{
      name: "Add " + name + " at the end",
      icon: "<i class='fas fa-edit'></i>",
      callback: e => {
        const o = GURPS.decode(this.actor.data, path);
        GURPS.put(o, duplicate(obj));
        this.actor.update({ [path]: o });
      }
    }
    ];
  }

  makeHeaderMenu(html, cssclass, name, obj, path) {
    new ContextMenu(html, cssclass, this.headerMenu(name, obj, path));
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".changeequip").click(this._onClickEquip.bind(this));

    this.makeHeaderMenu(html, ".reacthead", "Reaction", new Reaction("+0", "from ..."), "data.reactions");
    this.makeAddDeleteMenu(html, ".reactmenu", new Reaction("+0", "from ..."));

    this.makeHeaderMenu(html, ".meleehead", "Melee Attack", new Melee("New Attack"), "data.melee");
    this.makeAddDeleteMenu(html, ".meleemenu", new Melee("New Attack"));

    this.makeHeaderMenu(html, ".rangedhead", "Ranged Attack", new Ranged("New Attack"), "data.ranged");
    this.makeAddDeleteMenu(html, ".rangedmenu", new Ranged("New Attack"));

    let opts = this.headerMenu("Advantage", new Advantage("New Advantage"), "data.ads").concat(
      this.headerMenu("Disadvantage", new Advantage("New Disadvantage"), "data.disads"));
    new ContextMenu(html, ".adshead", opts);
    this.makeAddDeleteMenu(html, ".adsmenu", new Advantage("New Advantage"));
    this.makeAddDeleteMenu(html, ".disadsmenu", new Advantage("New Disadvantage"));

    this.makeHeaderMenu(html, ".skillhead", "Skill", new Skill("New Skill"), "data.skills");
    this.makeAddDeleteMenu(html, ".skillmenu", new Skill("New Skill"));

    this.makeHeaderMenu(html, ".spellhead", "Spell", new Spell("New Spell"), "data.spells");
    this.makeAddDeleteMenu(html, ".spellmenu", new Spell("New Spell"));

    this.makeHeaderMenu(html, ".notehead", "Note", new Note("New Note"), "data.notes");
    this.makeAddDeleteMenu(html, ".notemenu", new Note("New Note"));

    this.makeHeaderMenu(html, ".carhead", "Carried Equipment", new Equipment("New Equipment"), "data.equipment.carried");
    this.makeHeaderMenu(html, ".othhead", "Other Equipment", new Equipment("New Equipment"), "data.equipment.other");

    opts = this.addDeleteMenu(new Equipment("New Equipment"));
    opts.push({
      name: "Add In (new Equipment will be contained by this)",
      icon: "<i class='fas fa-edit'></i>",
      callback: e => {
        const k = e[0].dataset.key + ".contains";
        const o = GURPS.decode(this.actor.data, k) || {};
        GURPS.put(o, duplicate(new Equipment("New Equipment")));
        this.actor.update({ [k]: o });
      }
    });
    new ContextMenu(html, ".carmenu", opts);
    new ContextMenu(html, ".othmenu", opts);
  }

  async _onClickEquip(ev) {
    ev.preventDefault();
    const element = ev.currentTarget;
    const key = element.dataset.key;
    const eqt = GURPS.decode(this.actor.data, key);
    eqt.equipped = !eqt.equipped;
    await this.actor.update({ [key]: eqt });
  }
}

export class GurpsActorSimplifiedSheet extends GurpsActorSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["gurps", "sheet", "actor"],
      template: "systems/gurps/templates/simplified.html",
      width: 820,
      height: 900,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
    });
  }

  getData() {
    const data = super.getData();
    data.dodge = this.actor.getCurrentDodge();
    data.defense = this.actor.getTorsoDr();
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".rollableicon").click(this._onClickRollableIcon.bind(this));

  }

  async _onClickRollableIcon(ev) {
    ev.preventDefault();
    const element = ev.currentTarget;
    const val = element.dataset.value;
    const parsed = parselink(val);
    GURPS.performAction(parsed.action, this.actor, ev);
  }
}

export class GurpsActorNpcSheet extends GurpsActorSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["npc-sheet", "sheet", "actor"],
      template: "systems/gurps/templates/npc-sheet.html",
      width: 650,
      height: 400,
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
    });
  }

  getData() {
    const data = super.getData();
    data.dodge = this.actor.getCurrentDodge();
    data.defense = this.actor.getTorsoDr();
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".rollableicon").click(this._onClickRollableIcon.bind(this));

  }

  async _onClickRollableIcon(ev) {
    ev.preventDefault();
    const element = ev.currentTarget;
    const val = element.dataset.value;
    const parsed = parselink(val);
    GURPS.performAction(parsed.action, this.actor, ev);
  }
}

