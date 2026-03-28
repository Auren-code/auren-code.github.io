const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data.json');

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf8') || '[]';
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeData(arr) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

function computeProficiency(level){
  const l = Number(level) || 1;
  if (l >= 17) return 6;
  if (l >= 13) return 5;
  if (l >= 9) return 4;
  if (l >= 5) return 3;
  return 2;
}

const abilitiesByArchetype = {
  'Warrior': { STR: 16, DEX: 14, CON: 15, INT: 10, WIS: 10, CHA: 12 },
  'Expert': { STR: 10, DEX: 15, CON: 10, INT: 12, WIS: 14, CHA: 16 },
  'Spellcaster': { STR: 10, DEX: 14, CON: 10, INT: 16, WIS: 12, CHA: 15 }
};

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

function computeAbilitiesWithASI(baseAbilities, appliedFeats, archetype, level) {
  const abilities = { ...baseAbilities };
  const activeASIFeats = [];
  const feats = featsByArchetype[archetype] || {};
  // Collect all active ASI feat keys at current level
  for (let lvl = 1; lvl <= Number(level); lvl++) {
    if (feats[lvl]) {
      feats[lvl].forEach((feat, idx) => {
        if (feat.includes('(ASI)')) {
          activeASIFeats.push(lvl + '-asi-' + idx);
        }
      });
    }
  }
  // Apply only active ASI bonuses
  activeASIFeats.forEach(asiKey => {
    if (appliedFeats && appliedFeats[asiKey]) {
      const selection = appliedFeats[asiKey];
      if (selection.type === '+2' && selection.ability) {
        abilities[selection.ability] += 2;
      } else if (selection.type === '+1' && Array.isArray(selection.abilities)) {
        selection.abilities.forEach(ab => { abilities[ab] += 1; });
      }
    }
  });
  // Cap abilities at 20
  Object.keys(abilities).forEach(key => {
    if (abilities[key] > 20) abilities[key] = 20;
  });
  return abilities;
}

function getActiveASIFeats(archetype, level) {
  const feats = featsByArchetype[archetype] || {};
  const activeASIs = [];
  for (let lvl = 1; lvl <= Number(level); lvl++) {
    if (feats[lvl]) {
      feats[lvl].forEach((feat, idx) => {
        if (feat.includes('(ASI)')) {
          activeASIs.push({ level: lvl, key: lvl + '-asi-' + idx });
        }
      });
    }
  }
  return activeASIs;
}

function getFeatsForCharacter(archetype, level) {
  // Returns array of feat objects with level and name for all feats up to character's level
  const feats = featsByArchetype[archetype] || {};
  const result = [];
  for (let lvl = 1; lvl <= Number(level); lvl++) {
    if (feats[lvl]) {
      feats[lvl].forEach((feat, idx) => {
        if (feat.includes('(ASI)')) {
          // ASI feats get an object structure with level and name
          result.push({ level: lvl, name: feat, feat: feat });
        } else {
          // Other feats as strings
          result.push(feat);
        }
      });
    }
  }
  return result;
}

function getAllChars() {
  return readData().map(r => {
    const obj = { ...r };
    if (!obj.level) obj.level = 1;
    obj.proficiencyBonus = computeProficiency(obj.level);
    obj.feats = getFeatsForCharacter(obj.archetype, obj.level);
    if (!obj.appliedFeats) obj.appliedFeats = {};
    if (!obj.campaign) obj.campaign = '';
    if (obj.archetype === 'Spellcaster') {
      if (!obj.spellcastingClass) obj.spellcastingClass = '';
      if (!obj.spellSlots) obj.spellSlots = {};
      if (!obj.signatureSpells || !Array.isArray(obj.signatureSpells)) {
        obj.signatureSpells = [{ name: '', used: false }, { name: '', used: false }];
      }
    }
    // Recompute abilities with active ASI selections
    const baseAbilities = abilitiesByArchetype[obj.archetype] || { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 };
    obj.abilities = computeAbilitiesWithASI(baseAbilities, obj.appliedFeats, obj.archetype, obj.level);
    return obj;
  });
}

function defaultCharacter(archetype = 'Warrior') {
  const a = archetype || 'Warrior';
  const abilities = abilitiesByArchetype[a] ? { ...abilitiesByArchetype[a] } : { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 };
  return {
    name: 'New Character',
    race: '',
    archetype: a,
    flavor: '',
    abilities,
    level: 1,
    proficiencyBonus: 2,
    appliedFeats: {},
    campaign: '',
    spellcastingClass: a === 'Spellcaster' ? '' : undefined,
    spellSlots: a === 'Spellcaster' ? {} : undefined,
    signatureSpells: a === 'Spellcaster' ? [{ name: '', used: false }, { name: '', used: false }] : undefined,
    saves: { STR: false, DEX: false, CON: false, INT: false, WIS: false, CHA: false },
    skills: {
      "Acrobatics": { ability: 'DEX', proficient: false },
      "Animal Handling": { ability: 'WIS', proficient: false },
      "Arcana": { ability: 'INT', proficient: false },
      "Athletics": { ability: 'STR', proficient: false },
      "Deception": { ability: 'CHA', proficient: false },
      "History": { ability: 'INT', proficient: false },
      "Insight": { ability: 'WIS', proficient: false },
      "Intimidation": { ability: 'CHA', proficient: false },
      "Investigation": { ability: 'INT', proficient: false },
      "Medicine": { ability: 'WIS', proficient: false },
      "Nature": { ability: 'INT', proficient: false },
      "Perception": { ability: 'WIS', proficient: false },
      "Performance": { ability: 'CHA', proficient: false },
      "Persuasion": { ability: 'CHA', proficient: false },
      "Religion": { ability: 'INT', proficient: false },
      "Sleight of Hand": { ability: 'DEX', proficient: false },
      "Stealth": { ability: 'DEX', proficient: false },
      "Survival": { ability: 'WIS', proficient: false }
    },
    equipmentProficiencies: ['Simple Weapons'],
    equipment: ['Backpack', 'Torch']
  };
}

app.get('/api/characters', (req, res) => {
  res.json(getAllChars());
});

// Serve the UA_Sidekicks.pdf if present at repo root
app.get('/UA_Sidekicks.pdf', (req, res) => {
  const pdfPath = path.join(__dirname, 'UA_Sidekicks.pdf');
  if (fs.existsSync(pdfPath)) return res.sendFile(pdfPath);
  res.status(404).send('PDF not found');
});

app.post('/api/characters', (req, res) => {
  let payload;
  if (req.body && req.body.archetype) {
    payload = defaultCharacter(req.body.archetype);
    // if client provided level use it, else defaultCharacter already set level
    if (req.body.level) payload.level = Number(req.body.level) || payload.level;
    payload.proficiencyBonus = computeProficiency(payload.level);
  } else if (req.body && Object.keys(req.body).length) {
    payload = req.body;
    if (!payload.level) payload.level = 1;
    payload.proficiencyBonus = computeProficiency(payload.level);
  } else {
    payload = defaultCharacter();
  }
  const list = readData();
  const id = list.length ? Math.max(...list.map(x => x.id || 0)) + 1 : 1;
  const created = { ...payload, id };
  list.push(created);
  writeData(list);
  io.emit('characters', getAllChars());
  res.json(created);
});

app.put('/api/characters/:id', (req, res) => {
  const id = Number(req.params.id);
  const payload = req.body;
  if (!payload.level) payload.level = 1;
  payload.proficiencyBonus = computeProficiency(payload.level);
  const list = readData();
  const idx = list.findIndex(x => Number(x.id) === id);
  if (idx >= 0) list[idx] = { ...payload, id };
  else list.push({ ...payload, id });
  writeData(list);
  io.emit('characters', getAllChars());
  res.json({ ...payload, id });
});

app.delete('/api/characters/:id', (req, res) => {
  const id = Number(req.params.id);
  const list = readData().filter(x => Number(x.id) !== id);
  writeData(list);
  io.emit('characters', getAllChars());
  res.json({ deleted: id });
});

io.on('connection', socket => {
  socket.emit('characters', getAllChars());
  socket.on('request_characters', () => socket.emit('characters', getAllChars()));
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on http://localhost:${port}`));
