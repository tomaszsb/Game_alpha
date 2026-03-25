// server/processGameData.js
// JS port of data/process_game_data.py and data/process_remaining_files.py
// Generates CLEAN_FILES from SOURCE_FILES (Spaces.csv + DiceRoll Info.csv)

import fs from 'fs';
import path from 'path';

// ===== CSV UTILITIES =====

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvWithHeaders(csvText) {
  // Remove BOM if present
  const text = csvText.replace(/^\uFEFF/, '');
  const lines = text.trim().split('\n').map(l => l.replace(/\r$/, ''));
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1)
    .map(line => {
      const values = parseCsvLine(line);
      const row = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });
      return row;
    })
    .filter(row => Object.values(row).some(v => v)); // filter empty rows
}

function escapeCSV(value) {
  if (!value && value !== 0) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows, fieldnames) {
  const header = fieldnames.join(',');
  const lines = rows.map(row =>
    fieldnames.map(f => escapeCSV(row[f] ?? '')).join(',')
  );
  return header + '\n' + lines.join('\n') + '\n';
}

// ===== MOVEMENT PROCESSING (from process_game_data.py) =====

function isValidSpaceName(name) {
  if (!name || !name.trim()) return false;
  name = name.trim();

  // Must match: UPPERCASE letters, numbers, and hyphens, start with uppercase
  if (!/^[A-Z][A-Z0-9\-]+$/.test(name)) return false;
  if (name.includes('?')) return false;
  if (/^Space\s+\d+$/i.test(name)) return false;
  if (['YES', 'NO'].includes(name.toUpperCase())) return false;
  if (/\d+\s*(day|week|month)/i.test(name)) return false;

  // Must have hyphen (except START, FINISH)
  if (!name.includes('-')) {
    if (!['START', 'FINISH'].includes(name)) return false;
  }

  if (name.length < 5) return false;
  return true;
}

function loadDiceData(diceRollCsv) {
  const rows = parseCsvWithHeaders(diceRollCsv);
  const diceSpaces = new Set();

  for (const row of rows) {
    const spaceName = (row.space_name || '').trim();
    const outcomeType = (row.die_roll || '').trim();
    const visitType = (row.visit_type || '').trim();

    // Get roll values (columns 1-6)
    const rolls = ['1', '2', '3', '4', '5', '6'].map(n => (row[n] || '').trim());

    if (outcomeType === 'Next Step') {
      diceSpaces.add(`${spaceName}|${visitType}`);
    } else if (outcomeType === 'Time outcomes') {
      const hasSpaceNames = rolls.some(r => r && isValidSpaceName(r));
      if (hasSpaceNames) {
        diceSpaces.add(`${spaceName}|${visitType}`);
      }
    }
  }

  return diceSpaces;
}

function extractDestinationsFromLogicConditions(row) {
  const destinations = new Set();

  for (let i = 1; i <= 5; i++) {
    const conditionText = (row[`space_${i}`] || '').trim();
    if (!conditionText) continue;

    const potentialNames = conditionText.match(/[A-Z][A-Z0-9\-]{2,}/g) || [];
    for (const name of potentialNames) {
      if (isValidSpaceName(name)) {
        destinations.add(name);
      }
    }
  }

  return Array.from(destinations).sort();
}

function getAllDestColumns(row) {
  return [1, 2, 3, 4, 5].map(i => (row[`space_${i}`] || '').trim());
}

function createMovementRow(spaceName, visitType, movementType, destinations) {
  return {
    space_name: spaceName,
    visit_type: visitType,
    movement_type: movementType,
    destination_1: destinations[0] || '',
    destination_2: destinations[1] || '',
    destination_3: destinations[2] || '',
    destination_4: destinations[3] || '',
    destination_5: destinations[4] || '',
    condition_1: '',
    condition_2: '',
    condition_3: '',
    condition_4: '',
    condition_5: ''
  };
}

function processMovement(spacesCsv, diceRollCsv) {
  const diceSpaces = loadDiceData(diceRollCsv);
  const spacesRows = parseCsvWithHeaders(spacesCsv);
  const movements = [];

  for (const row of spacesRows) {
    const spaceName = (row.space_name || '').trim();
    if (!spaceName) continue; // skip button label rows
    const visitType = row.visit_type;
    const pathVal = (row.path || '').trim();
    const allDestColumns = getAllDestColumns(row);

    // SPECIAL CASE: Tutorial
    if (spaceName === 'START-QUICK-PLAY-GUIDE') {
      movements.push(createMovementRow(spaceName, visitType, 'none', []));
      continue;
    }

    // PRIORITY 1: path=LOGIC
    if (pathVal === 'LOGIC') {
      const destinations = extractDestinationsFromLogicConditions(row);
      movements.push(createMovementRow(spaceName, visitType, 'choice', destinations));
      continue;
    }

    // PRIORITY 2: dice movement
    const key = `${spaceName}|${visitType}`;
    if (diceSpaces.has(key)) {
      movements.push(createMovementRow(spaceName, visitType, 'dice', []));
      continue;
    }

    // PRIORITY 3: stateful movement
    const allDestLower = allDestColumns.join(' ').toLowerCase();
    if (allDestLower.includes('option from first visit')) {
      const validDests = allDestColumns.filter(d => isValidSpaceName(d));
      movements.push(createMovementRow(spaceName, visitType,
        validDests.length ? 'choice' : 'none', validDests));
      continue;
    }

    // PRIORITY 4: "Outcome from rolled dice"
    if (allDestColumns.some(d => d && d.toLowerCase().includes('outcome') && d.toLowerCase().includes('dice'))) {
      movements.push(createMovementRow(spaceName, visitType, 'dice', []));
      continue;
    }

    // PRIORITY 5: standard destination counting
    const validDestinations = allDestColumns.filter(d => isValidSpaceName(d));
    let movementType;
    if (validDestinations.length === 0) movementType = 'none';
    else if (validDestinations.length === 1) movementType = 'fixed';
    else movementType = 'choice';

    movements.push(createMovementRow(spaceName, visitType, movementType, validDestinations));
  }

  const fieldnames = [
    'space_name', 'visit_type', 'movement_type',
    'destination_1', 'destination_2', 'destination_3', 'destination_4', 'destination_5',
    'condition_1', 'condition_2', 'condition_3', 'condition_4', 'condition_5'
  ];

  return toCsv(movements, fieldnames);
}

// ===== REMAINING FILES (from process_remaining_files.py) =====

function processGameConfig(spacesCsv) {
  const rows = parseCsvWithHeaders(spacesCsv);
  const configs = {};

  // Known starting space — first space on the Main path where gameplay begins
  const STARTING_SPACE = 'OWNER-SCOPE-INITIATION';

  for (const row of rows) {
    const spaceName = (row.space_name || '').trim();
    if (!spaceName) continue; // skip button label rows with empty space_name
    if (configs[spaceName]) continue; // first occurrence wins (dedup)

    const phase = row.phase || '';
    const pathType = row.path || '';
    const isStarting = (spaceName === STARTING_SPACE);

    configs[spaceName] = {
      space_name: spaceName,
      phase,
      path_type: pathType,
      is_starting_space: isStarting ? 'Yes' : 'No',
      is_ending_space: spaceName === 'FINISH' ? 'Yes' : 'No',
      min_players: '1',
      max_players: '4',
      requires_dice_roll: row.requires_dice_roll || 'Yes'
    };
  }

  const fieldnames = [
    'space_name', 'phase', 'path_type', 'is_starting_space', 'is_ending_space',
    'min_players', 'max_players', 'requires_dice_roll'
  ];

  return toCsv(Object.values(configs), fieldnames);
}

function processSpaceContent(spacesCsv) {
  const rows = parseCsvWithHeaders(spacesCsv);
  const contents = rows.filter(row => (row.space_name || '').trim()).map(row => ({
    space_name: row.space_name,
    visit_type: row.visit_type,
    title: row.Title || row.Event || '',
    story: row.Event || '',
    action_description: row.Action || '',
    outcome_description: row.Outcome || '',
    can_negotiate: row.Negotiate || 'No',
    end_turn_label: row.end_turn_label || 'End Turn',
    try_again_label: row.try_again_label || 'Try Again'
  }));

  const fieldnames = [
    'space_name', 'visit_type', 'title', 'story', 'action_description',
    'outcome_description', 'can_negotiate', 'end_turn_label', 'try_again_label'
  ];

  return toCsv(contents, fieldnames);
}

function processSpaceEffects(spacesCsv, diceRollCsv) {
  const rows = parseCsvWithHeaders(spacesCsv);
  const effects = [];

  // Build dice roll lookup: space|visit_type -> [die_roll types]
  // Used to generate dice_outcome effect rows for non-movement dice types
  const diceRollRows = parseCsvWithHeaders(diceRollCsv);
  const diceRollLookup = new Map(); // key: "space|visitType" -> [{die_roll, rolls}]
  for (const dr of diceRollRows) {
    const dieRoll = (dr.die_roll || '').trim();
    // Skip "Next Step" — that's movement, not an effect
    if (dieRoll === 'Next Step') continue;
    const key = `${dr.space_name}|${dr.visit_type}`;
    if (!diceRollLookup.has(key)) diceRollLookup.set(key, []);
    diceRollLookup.get(key).push({ die_roll: dieRoll, button_label: (dr.button_label || '').trim() });
  }

  for (const row of rows) {
    const spaceName = (row.space_name || '').trim();
    if (!spaceName) continue; // skip button label rows
    const visitType = row.visit_type;

    // Card effects (from Spaces.csv columns)
    const cardTypes = { w_card: 'W', b_card: 'B', i_card: 'I', l_card: 'L', e_card: 'E' };
    const cardLabelCols = { w_card: 'w_card_label', b_card: 'b_card_label', i_card: 'i_card_label', l_card: 'l_card_label', e_card: 'e_card_label' };
    for (const [colName, cardLetter] of Object.entries(cardTypes)) {
      const cardValue = (row[colName] || '').trim();
      if (!cardValue) continue;

      let triggerType = 'manual';
      // L cards are always auto — life events are surprises, not player choices
      if (cardLetter === 'L') {
        triggerType = 'auto';
      } else if (spaceName === 'OWNER-FUND-INITIATION' && ['B', 'I'].includes(cardLetter)) {
        triggerType = 'auto';
      }

      // Use custom button label from CSV if provided, otherwise auto-generate
      const customLabel = (row[cardLabelCols[colName]] || '').trim();
      const description = customLabel || `${cardValue} ${cardLetter} cards`;

      // Extract dice condition from L card descriptions like "Draw 1 if you roll a 3"
      let condition = '';
      if (cardLetter === 'L') {
        const diceMatch = cardValue.match(/roll\s+a\s+(\d)/i);
        if (diceMatch) {
          condition = `dice_roll_${diceMatch[1]}`;
        }
      }

      // Parse card action from value text (e.g., "Return 1", "Replace 1", "Give 1", "Draw 1")
      let cardAction = `draw_${cardLetter}`;
      let cardCount = cardValue;
      const actionMatch = cardValue.match(/^(Return|Replace|Give|Draw)\s+(\d+)/i);
      if (actionMatch) {
        const verb = actionMatch[1].toLowerCase();
        cardCount = actionMatch[2];
        if (verb === 'return') {
          cardAction = `return_${cardLetter.toLowerCase()}`;
        } else if (verb === 'replace') {
          cardAction = `replace_${cardLetter.toLowerCase()}`;
        } else if (verb === 'give') {
          cardAction = `give_${cardLetter.toLowerCase()}`;
        } else {
          cardAction = `draw_${cardLetter}`;
        }
      }

      effects.push({
        space_name: spaceName,
        visit_type: visitType,
        effect_type: 'cards',
        effect_action: cardAction,
        effect_value: cardCount,
        condition: condition,
        description: description,
        trigger_type: triggerType
      });
    }

    // Dice outcome effects (from DiceRoll Info.csv cross-reference)
    const diceKey = `${spaceName}|${visitType}`;
    const diceEntries = diceRollLookup.get(diceKey) || [];
    for (const entry of diceEntries) {
      effects.push({
        space_name: spaceName,
        visit_type: visitType,
        effect_type: 'dice',
        effect_action: 'dice_outcome',
        effect_value: entry.die_roll,
        condition: '',
        description: entry.button_label || `Roll for ${entry.die_roll}`,
        trigger_type: 'manual'
      });
    }

    // Time effect
    const timeValue = (row.Time || '').trim();
    if (timeValue) {
      const timeStr = timeValue.toLowerCase().replace(/days?/g, '').trim();
      const timeNum = parseInt(timeStr, 10);
      if (!isNaN(timeNum)) {
        effects.push({
          space_name: spaceName,
          visit_type: visitType,
          effect_type: 'time',
          effect_action: 'add',
          effect_value: timeNum,
          condition: '',
          description: `Spend ${timeValue}`,
          trigger_type: 'auto'
        });
      }
    }

    // Fee effect
    const feeValue = (row.Fee || '').trim();
    if (feeValue && !['', '0', '0%'].includes(feeValue)) {
      effects.push({
        space_name: spaceName,
        visit_type: visitType,
        effect_type: 'fee',
        effect_action: 'deduct',
        effect_value: feeValue,
        condition: '',
        description: `Pay ${feeValue} fees`,
        trigger_type: 'auto'
      });
    }
  }

  const fieldnames = [
    'space_name', 'visit_type', 'effect_type', 'effect_action', 'effect_value',
    'condition', 'description', 'trigger_type'
  ];

  return toCsv(effects, fieldnames);
}

function processDiceEffects(diceRollCsv) {
  const rows = parseCsvWithHeaders(diceRollCsv);
  const effects = [];

  for (const row of rows) {
    const spaceName = row.space_name;
    const dieRollRaw = row.die_roll || '';
    const visitType = row.visit_type;

    let effectType, cardType;
    if (/card/i.test(dieRollRaw)) {
      effectType = 'cards';
      cardType = dieRollRaw.includes(' ') ? dieRollRaw.split(' ')[0] : '';
    } else if (/fee|paid/i.test(dieRollRaw)) {
      effectType = 'money';
      cardType = '';
    } else if (/time/i.test(dieRollRaw)) {
      effectType = 'time';
      cardType = '';
    } else {
      effectType = dieRollRaw;
      cardType = dieRollRaw.includes(' ') ? dieRollRaw.split(' ')[0] : dieRollRaw;
    }

    effects.push({
      space_name: spaceName,
      visit_type: visitType,
      effect_type: effectType,
      card_type: cardType,
      roll_1: row['1'] || '',
      roll_2: row['2'] || '',
      roll_3: row['3'] || '',
      roll_4: row['4'] || '',
      roll_5: row['5'] || '',
      roll_6: row['6'] || ''
    });
  }

  const fieldnames = [
    'space_name', 'visit_type', 'effect_type', 'card_type',
    'roll_1', 'roll_2', 'roll_3', 'roll_4', 'roll_5', 'roll_6'
  ];

  return toCsv(effects, fieldnames);
}

// ===== MAIN EXPORT =====

/**
 * Process source CSV files and write CLEAN_FILES to outputDir.
 * @param {string} spacesCsv - Raw contents of Spaces.csv
 * @param {string} diceRollCsv - Raw contents of DiceRoll Info.csv
 * @param {string} outputDir - Path to CLEAN_FILES directory (e.g. dist/data/CLEAN_FILES)
 */
export function processGameData(spacesCsv, diceRollCsv, outputDir) {
  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Generate all clean files (except DICE_OUTCOMES which has manual fixes)
  const files = {
    'MOVEMENT.csv': processMovement(spacesCsv, diceRollCsv),
    'GAME_CONFIG.csv': processGameConfig(spacesCsv),
    'SPACE_CONTENT.csv': processSpaceContent(spacesCsv),
    'SPACE_EFFECTS.csv': processSpaceEffects(spacesCsv, diceRollCsv),
    'DICE_EFFECTS.csv': processDiceEffects(diceRollCsv),
  };

  const results = [];
  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    const rowCount = content.trim().split('\n').length - 1; // minus header
    results.push({ filename, rowCount });
    console.log(`  ✓ ${filename} (${rowCount} rows)`);
  }

  return results;
}
