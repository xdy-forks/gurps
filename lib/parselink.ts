/* Here is where we do all the work to try to parse the text inbetween [ ].
 Supported formats:
  +N <desc>
  -N <desc>
    add a modifier to the stack, using text as the description
  ST/IQ/DX[+-]N <desc>
    attribute roll with optional add/subtract
  CR: N <desc>
    Self control roll
  "Skill*" +/-N
    Roll vs skill (with option +/- mod)
  "ST12"
  "SW+1"/"THR-1"
  "PDF:B102"
  	
  "modifier", "attribute", "selfcontrol", "damage", "roll", "skill", "pdf"
*/
export default function parselink(str, htmldesc?, clrdmods = false) {
  if (str.length < 2)
    return { "text": str };
    
  // Modifiers
  if (str[0] === "+" || str[0] === "-") {
    let sign = str[0];
    let rest = str.substr(1);
    let parse = rest.replace(/^([0-9]+)+( .*)?/g, "$1~$2");
    if (parse != rest) {
      let a = parse.split("~");
      let desc = a[1].trim();
      if (!desc) desc = htmldesc || "";
      let action = {
        "orig": str,
        "type": "modifier",
        "mod": sign + a[0],
        "desc": desc
      };
      return {
        "text": gmspan(str, action, sign == "+", clrdmods),
        "action": action
      }
    }
  }

	let blindroll = false;
  let brtxt = "";
	if (str[0] === "!") {
		blindroll = true;
		str = str.substr(1);
    brtxt = "&lt;Blind Roll&gt; ";
	}

  // Attributes "ST+2 desc, Per"
  let parse = str.replace(/^(\w+)([+-]\d+)?(.*)$/g, "$1~$2~$3")
  let a = parse.split("~");
  let path = GURPS.attributepaths[a[0]];
  if (!!path) {
		let action = {
        "orig": str,     
        "type": "attribute",
        "attribute": a[0],
        "path": path,
        "desc": a[2].trim(),		
        "mod": a[1],
				"blindroll" : blindroll
      };
    return {
      "text": gspan(str, action, brtxt),
      "action": action
    }
  }

  // Special case where they are makeing a targeted roll, NOT using their own attributes.  ST26.  Does not support mod (no ST26+2)
  parse = str.replace(/^([a-zA-Z]+)(\d+)(.*)$/g, "$1~$2~$3")
  if (parse != str) {
    a = parse.split("~");
    path = GURPS.attributepaths[a[0]];
    if (!!path) {
      let n = parseInt(a[1]);
      if (n) {
				let action = {
            "orig": str,
            "type": "attribute",
            "target": n,
            "desc": a[2].trim(),  // Action description, not modifier desc
            "path": path,
						"blindroll" : blindroll
          };
			 return {
          "text": gspan(str, action, brtxt),
          "action": action
        }
      }
    }
  }

  // Self control roll CR: N
  let two = str.substr(0, 2);
  if (two === "CR" && str.length > 2 && str[2] === ":") {
    let rest = str.substr(3).trim();
    let num = rest.replace(/([0-9]+).*/g, "$1");
    let desc = rest.replace(/[0-9]+ *(.*)/g, "$1");
    let action = {
      "orig": str,
      "type": "selfcontrol",
      "target": parseInt(num),
      "desc": desc
    };
    return {
      "text": gspan(str, action),
      "action": action
    }
  }

  // Straight roll 4d, 2d-1, etc.   Is "damage" if it includes a damage type.  Allows "!" suffix to indicate minimum of 1.
  // Supports:  2d+1x3(5), 4dX2(0.5), etc
//  parse = str.replace(/^(\d+)d([-+]\d+)?([xX\*]\d+)? ?(\([.\d]+\))?(!)? ?(.*)$/g, "$1~$2~$3~$4~$5~$6")
	parse = GURPS.parseDmg(str);
  if (parse != str) {
    let a = parse.split("~");
    let d = a[5].trim();
    let m = GURPS.woundModifiers[d];
    if (!m) {		// Not one of the recognized damage types.   Ignore Armor divisor, but allow multiplier.  must convert to '*' for Foundry
			let mult = a[2];
			if (!!mult && "Xx".includes(mult[0])) mult = "*" + mult.substr(1);
      let action = {
        "orig": str,
        "type": "roll",
        "formula": a[0] + "d" + a[1] + mult + a[4],       
        "desc": d     // Action description
      };
      return {
        "text": gspan(str, action),
        "action": action
      }
    } else {	// Damage roll 1d+2 cut.   Not allowed an action desc
      let action = {
        "orig": str,
        "type": "damage",
        "formula": a[0] + "d" + a[1] + a[2] + a[3] +a[4],       
        "damagetype": d
      };
      return {
        "text": gspan(str, action),
        "action": action
      }
    }
  }


  // for PDF link
  parse = str.replace(/^PDF: */g, "");
  if (parse != str) {
    return { 
			"text": "<span class='pdflink'>" + parse + "</span>", 
			"action": { 
				"type": "pdf", 
				"link": parse } };  // Just get rid of the "[PDF:" and allow the pdflink css class to do most of the work
  }


  // SW and THR damage
  parse = str.replace(/^(SW|THR)([-+]\d+)?(!)?( .*)?$/g, "$1~$2~$3~$4")
  if (parse != str) {
    let a = parse.split("~");
    let d = a[3].trim();
    let m = GURPS.woundModifiers[d];
    if (!!m) {
      let action = {
        "orig": str,
        "type": "deriveddamage",
        "derivedformula": a[0],
        "formula": a[1] + a[2],
        "damagetype": d
      };
      return {
        "text": gspan(str, action),
        "action": action
      }
    } else {
      let action = {
        "orig": str,
        "type": "derivedroll",
        "derivedformula": a[0],
        "formula": a[1] + a[2],
        "desc": d
      };
      return {
        "text": gspan(str, action),
        "action": action
			}
    }
  }


	// Simple, no-spaces, no quotes skill/spell name (with optional *)
	parse = str.replace(/^S:([^ "+-]+\*?)([-+]\d+)? ?(.*)/g, "$1~$2~$3");
  if (parse == str) {
		// Use quotes to capture skill/spell name (with as many * as they want to embed)
		parse = str.replace(/^S:"([^"]+)"([-+]\d+)? ?(.*)/g, "$1~$2~$3");
	}
	if (parse != str) {
    let a = parse.split("~");
    let n = a[0].trim();				// semi-regex pattern of skill/spell name (minus quotes)
    if (!!n) {
			let spantext = n;					// What we show in the highlighted span (yellow)
			let moddesc = "";
			let comment = a[2];
			if (!!a[1]) {							// If there is a +-mod, then the comment is the desc of the modifier
					spantext += a[1] + " " + a[2];
					moddesc = a[2];
					comment = "";
			}
			let action = {
        "orig": str,
        "type": "skill-spell",
        "name": n,
        "mod": a[1],
        "desc": moddesc,
				"blindroll" : blindroll
			};
		 return {
        "text": gspan(spantext, action, brtxt + "<b>S:</b>", comment),
        "action": action
      }
    }
  }

	// Simple, no-spaces, no quotes melee/ranged name (with optional *s)
	parse = str.replace(/^A:([^ "+-]+\*?)([-+]\d+)? ?(.*)/g, "$1~$2~$3");
  if (parse == str) {
		// Use quotes to capture skill/spell name (with optional *s)
		parse = str.replace(/^A:"([^"]+)"([-+]\d+)? ?(.*)/g, "$1~$2~$3");
	}
	if (parse != str) {
    let a = parse.split("~");
    let n = a[0].trim();				// semi-regex pattern of skill/spell name (minus quotes)
    if (!!n) {
			let spantext = n;					// What we show in the highlighted span (yellow)
			let moddesc = "";
			let comment = a[2];
			if (!!a[1]) {							// If there is a +-mod, then the comment is the desc of the modifier
					spantext += a[1] + " " + a[2];
					moddesc = a[2];
					comment = "";
			}
			let action = {
          "orig": str,
          "type": "attack",
          "name": n,
          "mod": a[1],
          "desc": moddesc,
					"blindroll" : blindroll
				};
 		  return {
        "text": gspan(spantext, action, brtxt + "<b>A:</b>", comment),
        "action": action
      }
    }
  }

  if (str === "Dodge" || str === "DODGE") {
    let action = {
      "orig": str,
      "type": "dodge",
      "blindroll" : blindroll
    };
    return {
      "text": gspan(str, action, brtxt),
      "action": action    
    }
  }

  parse = GURPS.PARSELINK_MAPPINGS[str];
	if (!!parse) {
		let action = {
      "orig": str,
      "type": "mapped",
      "desc": str,
      "path" : parse,  
      "blindroll" : blindroll
		};
		return {
      "text": gspan(str, action, brtxt),
      "action": action			
		}
	}
	
	parse = str.split(":");				// Block or Parry
	if (["Block", "BLOCK", "Parry", "PARRY"].includes(parse[0])) {
		let action = {
      "orig": str,
      "type": "block-parry",
      "desc": parse[0],
			"melee" : parse[1],			// optional melee name to match
      "path" : parse[0].toLowerCase(),  
      "blindroll" : blindroll
		};
		return {
      "text": gspan(str, action, brtxt),
      "action": action			
		}
	}

  return { "text": str };
}


function gmspan(str, action, plus, clrdmods) {
  let a = (!!action) ? " data-action='" + btoa(JSON.stringify(action)) + "'" : "";
  let s = `<span class='glinkmod'${a}>${str}`;
  if (clrdmods) {
    if (plus)
      s = `<span class='glinkmodplus'${a}>${str}`;
    else
      s = `<span class='glinkmodminus'${a}>${str}`;
  }
  return s + "</span>";
}

function gspan(str, action, prefix?, comment?) {
  let s = "<span class='gurpslink'";
	if (!!action) s += " data-action='" + btoa(JSON.stringify(action)) + "'";
	s += ">" + (!!prefix ? prefix : "") + str.trim() + "</span>";
	if (!!comment)
		s += " " + comment;
	return s;
}
