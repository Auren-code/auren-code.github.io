// Backend base URL resolution:
// - If `window.API_BASE` is set in the page, use that
// - Else if URL has `?api_base=...` query param, use that
// - Else use relative paths (empty string)
const API_BASE = (window.API_BASE && window.API_BASE.trim()) || new URLSearchParams(location.search).get('api_base') || '';
const socket = API_BASE ? io(API_BASE) : io();
let characters = [];
let currentId = null;
let editBuffer = null;  // Stores pending changes; only synced to character on Save

function $(sel) { return document.querySelector(sel); }

async function fetchChars(){
  const res = await fetch((API_BASE || '') + '/api/characters');
  characters = await res.json();
  renderList();
}

function renderList(){
  const list = $('#list');
  list.innerHTML = '';
  characters.forEach(c => {
    const el = document.createElement('div');
    el.className = 'char-item' + (c.id===currentId? ' active':'');
    el.textContent = (c.name || 'Unnamed') + ' — ' + (c.archetype || c.class || '');
    el.onclick = ()=> { currentId = c.id; renderEditor(); renderList(); };
    list.appendChild(el);
  });
}

function computeMod(score){ return Math.floor((Number(score) - 10)/2); }

function computeProficiency(level){
  const l = Number(level) || 1;
  if (l >= 17) return 6;
  if (l >= 13) return 5;
  if (l >= 9) return 4;
  if (l >= 5) return 3;
  return 2;
}

function computeModifiers(baseAbilities, appliedFeats, archetype, level) {
  // Compute final abilities by summing base + all active ASI bonuses
  const abilities = { ...baseAbilities };
  const feats = featsByArchetype[archetype] || {};
  
  // Get active ASI keys at current level
  const activeASIKeys = [];
  for (let lvl = 1; lvl <= Number(level); lvl++) {
    if (feats[lvl]) {
      feats[lvl].forEach((feat, idx) => {
        if (feat.includes('(ASI)')) {
          activeASIKeys.push(lvl + '-asi-' + idx);
        }
      });
    }
  }
  
  // Apply only active ASI bonuses
  activeASIKeys.forEach(asiKey => {
    if (appliedFeats && appliedFeats[asiKey]) {
      const selection = appliedFeats[asiKey];
      if (selection.type === '+2' && selection.ability) {
        abilities[selection.ability] += 2;
      } else if (selection.type === '+1' && Array.isArray(selection.abilities)) {
        selection.abilities.forEach(ab => { if (ab) abilities[ab] += 1; });
      }
    }
  });
  
  // Cap abilities at 20
  Object.keys(abilities).forEach(key => {
    if (abilities[key] > 20) abilities[key] = 20;
  });
  return abilities;
}

const featsByArchetype = {
  'Warrior': {
    1: [
      'Bonus Proficiency (Saving Throw): Choose STR, DEX, or CON',
      'Bonus Proficiency (Skills): Choose 3 from Acrobatics, Animal Handling, Athletics, Intimidation, Nature, Perception, Survival',
      'Bonus Proficiency (Weapons & Armor): All armor, shields, simple and martial weapons',
      'Second Wind: Bonus action to regain 1d10 + level HP. 2x between rests (3x at 18th level)'
    ],
    2: ['Danger Sense: Advantage on DEX saves vs visible effects (not if incapacitated)'],
    3: ['Improved Critical: Attack rolls crit on 19 or 20'],
    4: ['Ability Score Improvement (ASI)'],
    5: ['Extra Attack: Attack twice when taking Attack action (3x at 11th, 4x at 20th)'],
    6: ['Ability Score Improvement (ASI)'],
    7: ['Battle Readiness: Advantage on initiative rolls'],
    8: ['Ability Score Improvement (ASI)'],
    9: ['Indomitable: Reroll a failed save (1x per rest, 2x at 13th, 3x at 17th)'],
    10: ['Improved Defense: AC +1'],
    12: ['Ability Score Improvement (ASI)'],
    14: ['Ability Score Improvement (ASI)'],
    15: ['Superior Critical: Attack rolls crit on 18, 19, or 20'],
    16: ['Ability Score Improvement (ASI)'],
    19: ['Ability Score Improvement (ASI)']
  },
  'Expert': {
    1: [
      'Bonus proficiency: At 1st level, gain proficiency in a Saving Throw of your choice - DEX, INT, or CHA.',
      'Bonus proficiency: At 1st level, pick 5 skills from the skill list.',
      'Gain proficiency with light armor, simple weapons, and two tools.',
      'Expertise: At 1st level, choose two skills you have proficiency in - proficiency bonus is doubled for ability checks made with those skills.',
      'Helpful: You can take the Help action as a Bonus Action.'
    ],
    2: ['Cunning Action: Starting at 2nd level, you can take the actions Hide, Disengage, and Dash as a Bonus Action.'],
    3: ['Jack of Many Trades: Beginning at 3rd level, you can add half of your proficiency bonus to any ability check made with a skill you don\'t have proficiency in.'],
    4: ['Ability Score Improvement (ASI)'],
    5: ['Extra Attack: At 5th level, you gain the ability to attack twice whenever you take the attack action.'],
    7: ['Evasion: At 7th level, whenever you can make a Dexterity saving throw to take only half damage, instead you take no damage if you succeed, and half damage on a failure. You cannot benefit from this feature while incapacitated.'],
    8: ['Ability Score Improvement (ASI)'],
    9: ['Inspiring Help: At 9th level, when you use Help as a Bonus Action, the target of the Help action also gains a 1d6 bonus to the d20 roll. If that roll is an attack roll, they can forgo adding the bonus to it and instead, add the bonus to the attack\'s damage roll against one target if it succeeds.'],
    11: ['Reliable Talent: At 11th level, whenever you make an ability check that includes its whole proficiency bonus, it can treat a d20 roll of 9 or lower as a 10.'],
    12: ['Ability Score Improvement (ASI)'],
    13: ['Bonus proficiency: At 13th level, gain one skill and proficiency with another tool.'],
    14: ['Ability Score Improvement (ASI)'],
    15: ['Sharp Mind: At 15th level, you gain proficiency in INT, WIS, or CHA saving throws (choose one).'],
    16: ['Ability Score Improvement (ASI)'],
    17: ['Expertise: At 17th level, choose another skill for this feat.'],
    18: ['Inspiring Help: At 18th level, the bonus increases to 2d6.'],
    19: ['Ability Score Improvement (ASI)'],
    20: ['Stroke of Luck: At 20th level, if your attack misses a target within range, you can turn the miss into a hit. Alternatively, if you fail an ability check, you can treat the d20 roll as a 20. Once you use this feature, you can\'t use it again until you finish a short or long rest.']
  },
  'Spellcaster': {
    1: [
      'Bonus proficiencies: At 1st level, gain proficiency in a Saving Throw of your choice: WIS, INT, or CHA.',
      'Bonus proficiencies: At 1st level, pick three skills: Arcana, History, Insight, Investigation, Medicine, Performance, Persuasion, and Religion.',
      'Bonus proficiencies: At 1st level, gain proficiency with simple weapons and light armor.',
      'Spellcasting: At 1st level, choose a class: bard, cleric, druid, sorcerer, warlock, or wizard.'
    ],
    2: ['Magical Recovery: At 2nd level, gain the ability to recover expended spell slots every short rest. The spell slots can have a combined level equal to or less than half your level in this class, rounded up, and none of the spell slots recovered in this way can be 6th level or higher. Once you use this feature, you can\'t use it again until you finish a long rest.'],
    4: ['Ability Score Improvement (ASI)'],
    6: ['Potent Cantrips: At 6th level, you can add your spellcasting ability modifier to the damage you deal with any cantrip.'],
    8: ['Ability Score Improvement (ASI)'],
    10: ['Empowered Spells: At 10th level, choose one school of magic - Abjuration, Conjuration, Divination, Enchanting, Evocation, Illusion, Necromancy, or Transmutation. Whenever you cast a spell of that school by expending a spell slot, you can add your spellcasting ability modifier to the spell\'s damage roll or healing roll, if any.'],
    12: ['Ability Score Improvement (ASI)'],
    14: ['Focused Casting: At 14th level, you have advantage on any Constitution saving throw made to maintain concentration on a spell.'],
    16: ['Ability Score Improvement (ASI)'],
    19: ['Ability Score Improvement (ASI)'],
    20: ['Signature Spells: At 20th level, choose two spells that you know. Two spells must be of 1st, 2nd, or 3rd level, in any combination. You can cast each spell once at 3rd level without expending a spell slot. Once cast this way, you can\'t use this feature to cast that spell again until after a short or long rest.']
  }
};

const spellcastingAbilityMap = {
  bard: 'CHA',
  cleric: 'WIS',
  druid: 'WIS',
  sorcerer: 'CHA',
  warlock: 'CHA',
  wizard: 'INT'
};

const spellSlotChart = {
  1: [3,2,0,0,0,0,0,0,0,0],
  2: [3,3,0,0,0,0,0,0,0,0],
  3: [4,4,2,0,0,0,0,0,0,0],
  4: [5,4,3,0,0,0,0,0,0,0],
  5: [6,4,3,2,0,0,0,0,0,0],
  6: [7,4,3,3,0,0,0,0,0,0],
  7: [8,4,3,3,1,0,0,0,0,0],
  8: [9,4,3,3,2,0,0,0,0,0],
  9: [10,4,3,3,3,1,0,0,0,0],
  10: [11,4,3,3,3,2,0,0,0,0],
  11: [12,4,3,3,3,2,1,0,0,0],
  12: [12,4,3,3,3,2,1,0,0,0],
  13: [13,4,3,3,3,2,1,1,0,0],
  14: [13,4,3,3,3,2,1,1,0,0],
  15: [14,4,3,3,3,2,1,1,1,0],
  16: [14,4,3,3,3,2,1,1,1,0],
  17: [15,4,3,3,3,2,1,1,1,1],
  18: [15,4,3,3,3,3,1,1,1,1],
  19: [16,4,3,3,3,3,2,1,1,1],
  20: [16,4,3,3,3,3,2,2,1,1]
};

function getFeatsForArchetype(archetype, level) {
  const feats = featsByArchetype[archetype] || {};
  const result = [];
  for (let lvl = 1; lvl <= Number(level); lvl++) {
    if (feats[lvl]) {
      feats[lvl].forEach(feat => {
        if (typeof feat === 'string' && feat.includes('(ASI)')) {
          result.push({ level: lvl, name: feat, feat: feat });
        } else if (typeof feat === 'object' && feat.name && feat.name.includes('(ASI)')) {
          result.push(feat);
        } else {
          result.push(feat);
        }
      });
    }
  }
  return result;
}

function renderEditor(){
  const editor = $('#editor');
  const c = characters.find(x=>x.id===currentId) || null;
  if(!c){ editor.innerHTML = '<p>Select a character or create a new one.</p>'; editBuffer = null; return; }
  // Initialize edit buffer if switching characters
  if (!editBuffer || editBuffer.id !== c.id) {
    editBuffer = JSON.parse(JSON.stringify(c));
    if (!editBuffer.appliedFeats) editBuffer.appliedFeats = {};
    if (!editBuffer.campaign) editBuffer.campaign = '';
    if (editBuffer.archetype === 'Spellcaster') {
      if (!editBuffer.spellcastingClass) editBuffer.spellcastingClass = '';
      if (!editBuffer.spellSlots) editBuffer.spellSlots = {};
      if (!editBuffer.signatureSpells || !Array.isArray(editBuffer.signatureSpells)) {
        editBuffer.signatureSpells = [{ name: '', used: false }, { name: '', used: false }];
      }
    }
  }

  // Compute final abilities with ASI bonuses
  const computedAbilities = computeModifiers(editBuffer.abilities, editBuffer.appliedFeats, editBuffer.archetype, editBuffer.level);

  editor.innerHTML = '';
  const campaign = document.createElement('input'); campaign.type = 'text'; campaign.value = editBuffer.campaign||''; campaign.onchange = e => editBuffer.campaign = e.target.value;
  editor.appendChild(labelled('Campaign', campaign));

  const name = document.createElement('input'); name.value = editBuffer.name||''; name.onchange = e=> editBuffer.name = e.target.value;
  editor.appendChild(labelled('Name', name));

  const race = document.createElement('input'); race.value = editBuffer.race||''; race.onchange = e=> editBuffer.race = e.target.value;
  editor.appendChild(labelled('Race', race));

  const physical = document.createElement('textarea'); physical.value = editBuffer.physicalFeatures||''; physical.onchange = e=> editBuffer.physicalFeatures = e.target.value; physical.rows = 2; physical.style.height = '3em';
  editor.appendChild(labelled('Physical Features', physical));

  const arche = document.createElement('div'); arche.textContent = (editBuffer.archetype || editBuffer.class || '');
  editor.appendChild(labelled('Archetype', arche));

  const flavor = document.createElement('textarea'); flavor.value = editBuffer.flavor||''; flavor.onchange = e=> editBuffer.flavor = e.target.value;
  editor.appendChild(labelled('Flavor / Notes', flavor));

  if (editBuffer.archetype === 'Spellcaster') {
    const spellClassSelect = document.createElement('select');
    ['','bard','cleric','druid','sorcerer','warlock','wizard'].forEach(sc => {
      const opt = document.createElement('option');
      opt.value = sc;
      opt.textContent = sc ? sc.charAt(0).toUpperCase() + sc.slice(1) : '-- Select spellcasting class --';
      opt.selected = editBuffer.spellcastingClass === sc;
      spellClassSelect.appendChild(opt);
    });
    spellClassSelect.onchange = e => {
      editBuffer.spellcastingClass = e.target.value;
      renderEditor();
    };
    editor.appendChild(labelled('Spellcasting Class', spellClassSelect));

    const spellAbility = spellcastingAbilityMap[editBuffer.spellcastingClass];
    const abilityDisplay = document.createElement('div');
    if (spellAbility) {
      const mod = computeMod(computedAbilities[spellAbility]);
      abilityDisplay.textContent = `${spellAbility} (${mod >= 0 ? '+' : ''}${mod})`;
    } else {
      abilityDisplay.textContent = 'Choose a spellcasting class to see ability.';
    }
    editor.appendChild(labelled('Spellcasting Ability', abilityDisplay));

    const cantripsKnown = editBuffer.level >= 10 ? 5 : editBuffer.level >= 4 ? 4 : 3;
    editor.appendChild(labelled('Cantrips Known', document.createTextNode(cantripsKnown)));

    const slotRow = spellSlotChart[editBuffer.level] || [0,0,0,0,0,0,0,0,0,0];
    const spellKnownCount = slotRow[0] || 0;
    editor.appendChild(labelled('Spells Known', document.createTextNode(spellKnownCount)));

    if (spellAbility) {
      const profBonus = computeProficiency(editBuffer.level);
      const spellAbilityMod = computeMod(computedAbilities[spellAbility]);
      editor.appendChild(labelled('Spell Save DC', document.createTextNode('8 + ' + profBonus + ' + ' + spellAbilityMod + ' = ' + (8 + profBonus + spellAbilityMod))));
      editor.appendChild(labelled('Spell Attack Modifier', document.createTextNode('+' + (profBonus + spellAbilityMod))));
    }

    const slotsDiv = document.createElement('div');
    slotsDiv.style.marginTop = '8px';
    slotsDiv.innerHTML = '<strong>Spell Slots</strong>';
    for (let slotLevel = 1; slotLevel <= 9; slotLevel++) {
      const count = slotRow[slotLevel] || 0;
      if (!count) continue;
      if (!editBuffer.spellSlots) editBuffer.spellSlots = {};
      const selections = editBuffer.spellSlots[slotLevel] || [];
      while (selections.length < count) selections.push(false);
      if (selections.length > count) selections.length = count;
      editBuffer.spellSlots[slotLevel] = selections;

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '6px';
      const label = document.createElement('span');
      label.textContent = `${slotLevel} level slots:`;
      row.appendChild(label);
      for (let i = 0; i < count; i++) {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selections[i] || false;
        cb.onchange = () => {
          editBuffer.spellSlots[slotLevel][i] = cb.checked;
        };
        row.appendChild(cb);
      }
      slotsDiv.appendChild(row);
    }
    editor.appendChild(slotsDiv);

    if (editBuffer.level >= 20) {
      if (!Array.isArray(editBuffer.signatureSpells)) {
        editBuffer.signatureSpells = [{ name: '', used: false }, { name: '', used: false }];
      }
      editBuffer.signatureSpells = editBuffer.signatureSpells.slice(0, 2);
      while (editBuffer.signatureSpells.length < 2) {
        editBuffer.signatureSpells.push({ name: '', used: false });
      }

      const sigDiv = document.createElement('div');
      sigDiv.style.marginTop = '8px';
      sigDiv.innerHTML = '<strong>Signature Spells</strong>';
      editBuffer.signatureSpells.forEach((spell, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '6px';
        row.style.marginTop = '4px';

        const usedCheckbox = document.createElement('input');
        usedCheckbox.type = 'checkbox';
        usedCheckbox.checked = Boolean(spell.used);
        usedCheckbox.onchange = () => { spell.used = usedCheckbox.checked; };

        const spellInput = document.createElement('input');
        spellInput.type = 'text';
        spellInput.placeholder = 'Signature spell ' + (idx + 1);
        spellInput.value = spell.name || '';
        spellInput.onchange = e => { spell.name = e.target.value; };
        spellInput.style.flex = '1';

        row.appendChild(usedCheckbox);
        row.appendChild(spellInput);
        sigDiv.appendChild(row);
      });
      editor.appendChild(sigDiv);
    }
  }

  const abWrap = document.createElement('div'); abWrap.className='abilities';
  // Display computed abilities (base + ASI bonuses)
  Object.keys(computedAbilities).forEach(key=>{
    const box = document.createElement('div'); box.className='ability';
    const val = document.createElement('div'); val.className='ability-val'; val.textContent = computedAbilities[key];
    const mod = document.createElement('div'); mod.textContent = (computeMod(computedAbilities[key])>=0?'+':'') + computeMod(computedAbilities[key]);
    box.innerHTML = `<strong>${key}</strong>`;
    box.appendChild(val); box.appendChild(mod); abWrap.appendChild(box);
  });
  editor.appendChild(labelled('Abilities', abWrap));

  // Level and Proficiency display
  if (!editBuffer.level) editBuffer.level = 1;
  const levelWrap = document.createElement('div'); levelWrap.className='level-wrap';
  const lvlLabel = document.createElement('div'); lvlLabel.textContent = 'Level: ' + editBuffer.level;
  const profValue = computeProficiency(editBuffer.level);
  const profDiv = document.createElement('div'); profDiv.textContent = 'Proficiency Bonus: +' + profValue;
  const up = document.createElement('button'); up.textContent = '+'; up.onclick = ()=>{ if(editBuffer.level<20){ editBuffer.level++; renderEditor(); } };
  const down = document.createElement('button'); down.textContent = '-'; down.onclick = ()=>{ 
    if(editBuffer.level>1){ 
      editBuffer.level--; 
      // Clean up appliedFeats that are no longer valid at the new level
      const feats = featsByArchetype[editBuffer.archetype] || {};
      const validASIKeys = [];
      for (let lvl = 1; lvl <= editBuffer.level; lvl++) {
        if (feats[lvl]) {
          feats[lvl].forEach((feat, idx) => {
            if (feat.includes('(ASI)')) {
              validASIKeys.push(lvl + '-asi-' + idx);
            }
          });
        }
      }
      if (editBuffer.appliedFeats) {
        Object.keys(editBuffer.appliedFeats).forEach(key => {
          if (!validASIKeys.includes(key)) {
            delete editBuffer.appliedFeats[key];
          }
        });
      }
      if (editBuffer.archetype === 'Spellcaster' && editBuffer.spellSlots) {
        const validSlots = spellSlotChart[editBuffer.level] || [0,0,0,0,0,0,0,0,0,0];
        Object.keys(editBuffer.spellSlots).forEach(key => {
          const slotLevel = Number(key);
          const maxCount = validSlots[slotLevel] || 0;
          if (maxCount === 0) {
            delete editBuffer.spellSlots[key];
          } else {
            editBuffer.spellSlots[key] = (editBuffer.spellSlots[key] || []).slice(0, maxCount);
          }
        });
      }
      renderEditor(); 
    } 
  };
  levelWrap.appendChild(down); levelWrap.appendChild(lvlLabel); levelWrap.appendChild(up); levelWrap.appendChild(profDiv);
  editor.appendChild(labelled('Level & Proficiency', levelWrap));

  const prof = document.createElement('div');
  prof.innerHTML = '<strong>Skills & Saves</strong>';
  Object.keys(editBuffer.skills).forEach(skill => {
    const s = editBuffer.skills[skill];
    const row = document.createElement('div');
    const chk = document.createElement('input'); chk.type='checkbox'; chk.checked = s.proficient; chk.onchange = e=> { s.proficient = e.target.checked; };
    const span = document.createElement('span');
    const profBonus = computeProficiency(editBuffer.level);
    const mod = computeMod(computedAbilities[s.ability]) + (s.proficient? profBonus:0);
    span.textContent = ` ${skill} (${s.ability}) ` + (mod>=0? '+':'') + mod;
    row.appendChild(chk); row.appendChild(span); prof.appendChild(row);
  });
  editor.appendChild(prof);

  const equip = document.createElement('textarea'); equip.value = (editBuffer.equipment||[]).join(', '); equip.onchange = e=> editBuffer.equipment = e.target.value.split(',').map(s=>s.trim()).filter(Boolean);
  editor.appendChild(labelled('Equipment (comma-separated)', equip));

  // Feats & Abilities section
  const featsDiv = document.createElement('div');
  featsDiv.innerHTML = '<strong>Feats & Abilities</strong>';
  const feats = getFeatsForArchetype(editBuffer.archetype, editBuffer.level);
  const appliedFeats = editBuffer.appliedFeats || {};
  const abilityList = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  
  // Separate ASI and non-ASI feats by level
  const asiByLevel = {};
  const otherFeats = [];
  
  feats.forEach(feat => {
    if (typeof feat === 'object' && feat.name && feat.name.includes('(ASI)')) {
      if (!asiByLevel[feat.level]) asiByLevel[feat.level] = [];
      asiByLevel[feat.level].push(feat);
    } else {
      otherFeats.push(feat);
    }
  });
  
  if (feats.length === 0) {
    featsDiv.innerHTML += '<p style="font-size:12px; color:#666;">No feats at level 1.</p>';
  } else {
    // Show ASI selectors with dropdowns (keyed by level and index within level)
    Object.keys(asiByLevel).forEach(lvl => {
      asiByLevel[lvl].forEach((feat, levelIdx) => {
        const asiKey = lvl + '-asi-' + levelIdx;
        const selection = appliedFeats[asiKey] || {};
        const asiEl = document.createElement('div');
        asiEl.style.fontSize = '12px';
        asiEl.style.marginTop = '6px';
        asiEl.style.padding = '6px';
        asiEl.style.background = '#fff3cd';
        asiEl.style.borderRadius = '4px';
        asiEl.innerHTML = '• Level ' + lvl + ': Ability Score Improvement';
        
        // Type selector dropdown
        const typeSelect = document.createElement('select');
        typeSelect.style.margin = '4px 0 4px 0';
        typeSelect.style.padding = '4px';
        typeSelect.style.fontSize = '11px';
        [{ val: '', label: '-- Select --' }, { val: '+2', label: '+2 to one ability' }, { val: '+1', label: '+1 to two abilities' }].forEach(opt => {
          const o = document.createElement('option');
          o.value = opt.val;
          o.textContent = opt.label;
          o.selected = selection.type === opt.val;
          typeSelect.appendChild(o);
        });
        
        typeSelect.onchange = () => {
          const type = typeSelect.value;
          if (type) {
            if (!editBuffer.appliedFeats) editBuffer.appliedFeats = {};
            // Reset to just type, clearing old ability selections
            editBuffer.appliedFeats[asiKey] = { type };
          } else {
            delete editBuffer.appliedFeats[asiKey];
          }
          renderEditor();
        };
        asiEl.appendChild(typeSelect);
        
        // Ability selector dropdowns based on type
        if (selection.type === '+2') {
          const abSel = document.createElement('select');
          abSel.style.margin = '4px 0 0 0';
          abSel.style.padding = '4px';
          abSel.style.fontSize = '11px';
          const opt0 = document.createElement('option');
          opt0.value = '';
          opt0.textContent = '-- Select ability --';
          abSel.appendChild(opt0);
          abilityList.forEach(ab => {
            const o = document.createElement('option');
            o.value = ab;
            o.textContent = ab;
            o.selected = selection.ability === ab;
            abSel.appendChild(o);
          });
          abSel.onchange = () => {
            if (abSel.value) {
              editBuffer.appliedFeats[asiKey].ability = abSel.value;
            } else {
              delete editBuffer.appliedFeats[asiKey].ability;
            }
            renderEditor();
          };
          asiEl.appendChild(abSel);
        } else if (selection.type === '+1') {
          const ab1Sel = document.createElement('select');
          ab1Sel.style.margin = '4px 0 0 0';
          ab1Sel.style.padding = '4px';
          ab1Sel.style.fontSize = '11px';
          const opt1 = document.createElement('option');
          opt1.value = '';
          opt1.textContent = '-- Select first ability --';
          ab1Sel.appendChild(opt1);
          abilityList.forEach(ab => {
            const o = document.createElement('option');
            o.value = ab;
            o.textContent = ab;
            o.selected = selection.abilities && selection.abilities[0] === ab;
            ab1Sel.appendChild(o);
          });
          ab1Sel.onchange = () => {
            if (!editBuffer.appliedFeats[asiKey].abilities) editBuffer.appliedFeats[asiKey].abilities = [];
            editBuffer.appliedFeats[asiKey].abilities[0] = ab1Sel.value;
            renderEditor();
          };
          asiEl.appendChild(ab1Sel);
          
          const ab2Sel = document.createElement('select');
          ab2Sel.style.margin = '4px 0 0 0';
          ab2Sel.style.padding = '4px';
          ab2Sel.style.fontSize = '11px';
          const opt2 = document.createElement('option');
          opt2.value = '';
          opt2.textContent = '-- Select second ability --';
          ab2Sel.appendChild(opt2);
          abilityList.forEach(ab => {
            if (selection.abilities && selection.abilities[0] === ab) return;
            const o = document.createElement('option');
            o.value = ab;
            o.textContent = ab;
            o.selected = selection.abilities && selection.abilities[1] === ab;
            ab2Sel.appendChild(o);
          });
          ab2Sel.onchange = () => {
            if (!editBuffer.appliedFeats[asiKey].abilities) editBuffer.appliedFeats[asiKey].abilities = [];
            editBuffer.appliedFeats[asiKey].abilities[1] = ab2Sel.value;
            renderEditor();
          };
          asiEl.appendChild(ab2Sel);
        }
        
        featsDiv.appendChild(asiEl);
      });
    });
    
    // Show other feats
    (Array.isArray(otherFeats) ? otherFeats : Object.values(otherFeats)).forEach(feat => {
      const featName = typeof feat === 'string' ? feat : feat.name;
      const featEl = document.createElement('div');
      featEl.style.fontSize = '12px';
      featEl.style.marginTop = '6px';
      featEl.style.padding = '6px';
      featEl.style.background = '#f0f4f8';
      featEl.style.borderRadius = '4px';
      featEl.textContent = '• ' + featName;
      featsDiv.appendChild(featEl);
    });
  }
  editor.appendChild(featsDiv);

  const saveBtn = document.createElement('button'); saveBtn.textContent = 'Save'; saveBtn.className='save-btn'; saveBtn.onclick = ()=> { Object.assign(c, editBuffer); saveChar(c); };
  const delBtn = document.createElement('button'); delBtn.textContent = 'Delete'; delBtn.onclick = ()=> deleteChar(c.id);
  editor.appendChild(saveBtn); editor.appendChild(delBtn);
}

function labelled(title, node){ const w = document.createElement('div'); const lbl = document.createElement('label'); lbl.textContent = title; w.appendChild(lbl); w.appendChild(node); return w; }

async function saveChar(c){
  // normalize old `class` field to `archetype`
  if (!c.archetype && c.class) { c.archetype = c.class; }
  delete c.class;
  await fetch((API_BASE || '') + '/api/characters/' + c.id, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(c)});
  await fetchChars();
  renderEditor();
}

async function deleteChar(id){
  await fetch((API_BASE || '') + '/api/characters/' + id, { method:'DELETE' });
  currentId = null; fetchChars();
}

function showArchetypeModal(){
  const overlay = document.createElement('div'); overlay.className='modal-overlay';
  const box = document.createElement('div'); box.className='modal-box';
  box.innerHTML = '<h3>Choose Archetype</h3>';
  ['Warrior','Expert','Spellcaster'].forEach(a=>{
    const btn = document.createElement('button'); btn.textContent = a; btn.onclick = async ()=>{
      document.body.removeChild(overlay);
      const res = await fetch((API_BASE || '') + '/api/characters', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ archetype: a }) });
      const created = await res.json(); currentId = created.id; fetchChars();
    };
    box.appendChild(btn);
  });
  const cancel = document.createElement('button'); cancel.textContent='Cancel'; cancel.onclick = ()=> document.body.removeChild(overlay);
  box.appendChild(cancel);
  overlay.appendChild(box); document.body.appendChild(overlay);
}

$('#pdfBtn').onclick = ()=> window.open((API_BASE || '') + '/UA_Sidekicks.pdf', '_blank');
$('#newChar').onclick = ()=> showArchetypeModal();

socket.on('connect', ()=> socket.emit('request_characters'));
socket.on('characters', data=> { characters = data; renderList(); if(!currentId && characters.length) currentId = characters[0].id; renderEditor(); });

fetchChars();
