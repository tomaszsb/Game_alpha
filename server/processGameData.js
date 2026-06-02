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
    // Emit movement_type='logic' so the runtime walks LOGIC_QUESTIONS.csv
    // as a yes/no decision chain. Previously emitted 'choice' which silently
    // downgraded the feature to a flat destination picker — that regression
    // (v2.45 era) clobbered REG-FDNY-FEE-REVIEW's 5-question tree on every sync.
    if (pathVal === 'LOGIC') {
      const destinations = extractDestinationsFromLogicConditions(row);
      movements.push(createMovementRow(spaceName, visitType, 'logic', destinations));
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

  for (const row of rows) {
    const spaceName = (row.space_name || '').trim();
    if (!spaceName) continue; // skip button label rows with empty space_name
    if (configs[spaceName]) continue; // first occurrence wins (dedup)

    const phase = row.phase || '';
    const pathType = row.path || '';
    // Workstream 6 #1: read is_starting_space from source.
    const isStarting = (row.is_starting_space || '').trim() === 'Yes';
    // Workstream 6 #5+#6: read resume-mechanic flags from source.
    // is_resume_hub: this space is where players check in from side quests
    //   (was hardcoded to PM-DECISION-CHECK in MovementService).
    // is_point_of_no_return: arriving here clears any stored resume point and
    //   permanently disables future resume-from-side-quest behavior (was
    //   hardcoded to CHEAT-BYPASS in MovementService).
    // Empty / missing / non-Yes values default to 'No'.
    const isResumeHub = (row.is_resume_hub || '').trim() === 'Yes';
    const isPointOfNoReturn = (row.is_point_of_no_return || '').trim() === 'Yes';
    // Workstream 6 #2: read min_w_cards_to_leave from source. Used by the
    // engine's end-turn guard. Empty / missing / non-numeric values default to 0.
    const minWCardsRaw = (row.min_w_cards_to_leave || '').trim();
    const minWCardsParsed = parseInt(minWCardsRaw, 10);
    const minWCardsToLeave = Number.isFinite(minWCardsParsed) && minWCardsParsed >= 0 ? minWCardsParsed : 0;
    // Workstream 6 #7: design fee calculation. 'percentage_of_scope' = fee is
    // computed from the player's project scope (was hardcoded for ARCH/ENG-FEE-REVIEW).
    // Empty / missing / unrecognized values default to 'flat' (fee = literal amount).
    const feeMethodRaw = (row.fee_calculation_method || '').trim();
    const feeCalculationMethod = feeMethodRaw === 'percentage_of_scope' ? 'percentage_of_scope' : 'flat';
    // fee_label is a free-form string used in the dice-roll button + effect description.
    const feeLabel = (row.fee_label || '').trim();
    // Workstream 6 #3: setup-phase auto-handling flags.
    // auto_apply_funding: when player arrives at this space, run handleAutomaticFunding
    //   (was hardcoded for OWNER-FUND-INITIATION).
    // auto_trigger_card_types: comma-separated card letters whose draws are
    //   auto-triggered AND whose direct money effects are skipped (because
    //   handleAutomaticFunding handles the money instead). Example: "B,I" means
    //   B-card and I-card draws auto-fire and don't double-count their money.
    const autoApplyFunding = (row.auto_apply_funding || '').trim() === 'Yes';
    const autoTriggerCardTypes = (row.auto_trigger_card_types || '').trim();
    // Workstream 6 #4: path-choice memory flags.
    // path_choice_memory_key: opaque slot name in player.pathChoiceMemory.
    //   Spaces share a key when they store/read the same choice (was hardcoded
    //   to 'REG-DOB-TYPE-SELECT' in MovementService).
    // is_path_choice_lock_point: when First-visit player chooses a destination
    //   from this space, store it under path_choice_memory_key. On Subsequent
    //   visits, valid moves are filtered to the stored value.
    const pathChoiceMemoryKey = (row.path_choice_memory_key || '').trim();
    const isPathChoiceLockPoint = (row.is_path_choice_lock_point || '').trim() === 'Yes';
    // Workstream 6 Phase 6.3 (cosmetic mappings): display label override + review-loop message.
    // Empty values mean "use legacy fallback in code." Educators can set these per-space.
    const displayLabelOverride = (row.display_label_override || '').trim();
    const reviewLoopMessage = (row.review_loop_message || '').trim();
    // Workstream 3 (Living Map): coordinate-driven board positions.
    // Numbers in pixels in board coordinate space. Empty values default
    // to 0 (placed at top-left) so a missing coord is visible — but
    // every row should have these populated by scripts/seed-board-positions.mjs.
    const posX = parseFloat(row.pos_x) || 0;
    const posY = parseFloat(row.pos_y) || 0;
    // 2026-05-18 audit: funding_source enum, used by DataService.isFundingSpace
    // / getFundingSource. 'owner' = seed money (OWNER-FUND-INITIATION),
    // 'bank' = loan (BANK-FUND-REVIEW), 'investor' = INVESTOR-FUND-REVIEW.
    // Empty for non-funding spaces. Replaces hardcoded space-name arrays in
    // CardEffectHandler / CardEffectService / NotificationUtils.
    const rawFundingSource = (row.funding_source || '').trim();
    const fundingSource = (rawFundingSource === 'owner' || rawFundingSource === 'bank' || rawFundingSource === 'investor') ? rawFundingSource : '';
    // 2026-06-02: data-driven flag for the Workstream 7 Phase 7.4 Stage-1 gate.
    // Spaces marked Yes get checkFinalReviewGate() run inside MovementService.getValidMoves,
    // which collapses valid moves to [routeTo] when the player lacks the required
    // approvals. Replaces hardcoded `=== DOB_FINAL_REVIEW_SPACE` in MovementService.
    // Empty / missing / non-Yes values default to 'No'.
    const hasFinalReviewGate = (row.has_final_review_gate || '').trim() === 'Yes';

    configs[spaceName] = {
      space_name: spaceName,
      phase,
      path_type: pathType,
      is_starting_space: isStarting ? 'Yes' : 'No',
      is_ending_space: spaceName === 'FINISH' ? 'Yes' : 'No',
      min_players: '1',
      max_players: '4',
      requires_dice_roll: row.requires_dice_roll || 'Yes',
      is_resume_hub: isResumeHub ? 'Yes' : 'No',
      is_point_of_no_return: isPointOfNoReturn ? 'Yes' : 'No',
      min_w_cards_to_leave: String(minWCardsToLeave),
      fee_calculation_method: feeCalculationMethod,
      fee_label: feeLabel,
      auto_apply_funding: autoApplyFunding ? 'Yes' : 'No',
      auto_trigger_card_types: autoTriggerCardTypes,
      path_choice_memory_key: pathChoiceMemoryKey,
      is_path_choice_lock_point: isPathChoiceLockPoint ? 'Yes' : 'No',
      display_label_override: displayLabelOverride,
      review_loop_message: reviewLoopMessage,
      pos_x: String(posX),
      pos_y: String(posY),
      funding_source: fundingSource,
      has_final_review_gate: hasFinalReviewGate ? 'Yes' : 'No'
    };
  }

  const fieldnames = [
    'space_name', 'phase', 'path_type', 'is_starting_space', 'is_ending_space',
    'min_players', 'max_players', 'requires_dice_roll',
    'is_resume_hub', 'is_point_of_no_return', 'min_w_cards_to_leave',
    'fee_calculation_method', 'fee_label',
    'auto_apply_funding', 'auto_trigger_card_types',
    'path_choice_memory_key', 'is_path_choice_lock_point',
    'display_label_override', 'review_loop_message',
    'pos_x', 'pos_y',
    'funding_source',
    'has_final_review_gate'
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
    try_again_label: row.try_again_label || 'Try Again',
    shake_on: row.shake_on || '',
    tts_field: row.tts_field || ''
  }));

  const fieldnames = [
    'space_name', 'visit_type', 'title', 'story', 'action_description',
    'outcome_description', 'can_negotiate', 'end_turn_label', 'try_again_label',
    'shake_on', 'tts_field'
  ];

  return toCsv(contents, fieldnames);
}

function loadModalConfig(modalConfigCsv) {
  if (!modalConfigCsv) return new Map();
  const rows = parseCsvWithHeaders(modalConfigCsv);
  const lookup = new Map();
  for (const row of rows) {
    const space = (row.space_name || '').trim();
    const visit = (row.visit_type || '').trim();
    const action = (row.effect_action || '').trim();
    if (!space || !action) continue;
    // Phase 4: skip dice-specific rows — those are consumed directly by
    // DiceResultModal via DataService and must NOT be merged into SPACE_EFFECTS
    // (otherwise a "Roll 6" override would bleed onto unrelated manual actions).
    const diceValue = (row.dice_value || '').trim();
    if (diceValue) continue;
    const key = `${space}|${visit}|${action}`;
    lookup.set(key, {
      modal_title: (row.modal_title || '').trim(),
      modal_description: (row.modal_description || '').trim(),
      modal_button_label: (row.modal_button_label || '').trim(),
      modal_summary: (row.modal_summary || '').trim(),
    });
  }
  return lookup;
}

function processSpaceEffects(spacesCsv, diceRollCsv, modalConfigLookup = new Map()) {
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
    const cardNarrativeCols = { w_card: 'w_card_narrative', b_card: 'b_card_narrative', i_card: 'i_card_narrative', l_card: 'l_card_narrative', e_card: 'e_card_narrative' };
    for (const [colName, cardLetter] of Object.entries(cardTypes)) {
      const cardValue = (row[colName] || '').trim();
      if (!cardValue) continue;

      let triggerType = 'manual';
      // L cards are always auto — life events are surprises, not player choices
      if (cardLetter === 'L') {
        triggerType = 'auto';
      } else {
        // Workstream 6 #3: lifted from `spaceName === 'OWNER-FUND-INITIATION'`.
        // Read the row's auto_trigger_card_types (comma-separated card letters).
        // If this card type is in the list, auto-trigger its draw on arrival.
        const autoTypes = (row.auto_trigger_card_types || '').trim().split(',').map(s => s.trim()).filter(Boolean);
        if (autoTypes.includes(cardLetter)) {
          triggerType = 'auto';
        }
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

      // Per-action narrative text from Spaces.csv (e.g., w_card_narrative)
      const narrative = (row[cardNarrativeCols[colName]] || '').trim();

      effects.push({
        space_name: spaceName,
        visit_type: visitType,
        effect_type: 'cards',
        effect_action: cardAction,
        effect_value: cardCount,
        condition: condition,
        description: description,
        trigger_type: triggerType,
        narrative: narrative
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
      // Determine fee_type at pipeline time instead of runtime regex
      const feeValLower = feeValue.toLowerCase();
      let feeType = 'FIXED';
      if (feeValLower.includes('dice') || feeValLower.includes('roll')) {
        feeType = 'DICE_BASED';
      } else if (feeValLower.includes('%')) {
        feeType = 'LOAN_PERCENTAGE';
      }

      effects.push({
        space_name: spaceName,
        visit_type: visitType,
        effect_type: 'fee',
        effect_action: 'deduct',
        effect_value: feeValue,
        condition: '',
        description: `Pay ${feeValue} fees`,
        trigger_type: 'auto',
        fee_type: feeType
      });
    }
  }

  // Merge modal config into effects
  for (const effect of effects) {
    const key = `${effect.space_name}|${effect.visit_type}|${effect.effect_action}`;
    const cfg = modalConfigLookup.get(key);
    effect.modal_title = cfg?.modal_title || '';
    effect.modal_description = cfg?.modal_description || '';
    effect.modal_button_label = cfg?.modal_button_label || '';
    effect.modal_summary = cfg?.modal_summary || '';
  }

  const fieldnames = [
    'space_name', 'visit_type', 'effect_type', 'effect_action', 'effect_value',
    'condition', 'description', 'trigger_type', 'fee_type', 'narrative',
    'modal_title', 'modal_description', 'modal_button_label', 'modal_summary'
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

    // Analyze roll values to determine row-level metadata
    const rollValues = [row['1'], row['2'], row['3'], row['4'], row['5'], row['6']]
      .map(v => (v || '').trim())
      .filter(v => v !== '');

    let rollAction = '';
    let rollIsPercentage = false;
    let rollNumericOnly = false;

    if (rollValues.length > 0) {
      // Check if all values are percentages
      rollIsPercentage = rollValues.every(v => v.includes('%'));
      // Check if all values are just numbers (possibly with +/- prefix)
      rollNumericOnly = rollValues.every(v => /^[+-]?\d+$/.test(v));

      // Determine the action pattern from the first non-empty roll value
      const sample = rollValues[0].toLowerCase();
      if (/^draw\s/i.test(sample)) rollAction = 'draw';
      else if (/^remove\s/i.test(sample)) rollAction = 'remove';
      else if (/^replace\s/i.test(sample)) rollAction = 'replace';
      else if (rollIsPercentage) rollAction = 'fee';
      else if (effectType === 'time') rollAction = 'time';
      else if (effectType === 'money') rollAction = 'money';
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
      roll_6: row['6'] || '',
      roll_group: row.roll_group || '',
      roll_action: rollAction,
      roll_is_percentage: rollIsPercentage ? 'true' : 'false',
      roll_numeric_only: rollNumericOnly ? 'true' : 'false'
    });
  }

  const fieldnames = [
    'space_name', 'visit_type', 'effect_type', 'card_type',
    'roll_1', 'roll_2', 'roll_3', 'roll_4', 'roll_5', 'roll_6',
    'roll_group', 'roll_action', 'roll_is_percentage', 'roll_numeric_only'
  ];

  return toCsv(effects, fieldnames);
}

// ===== MAIN EXPORT =====

/**
 * Process source CSV files and write CLEAN_FILES to outputDir.
 * @param {string} spacesCsv - Raw contents of Spaces.csv
 * @param {string} diceRollCsv - Raw contents of DiceRoll Info.csv
 * @param {string} outputDir - Path to CLEAN_FILES directory (e.g. dist/data/CLEAN_FILES)
 * @param {string} [modalConfigCsv] - Raw contents of ModalConfig.csv (optional)
 */
export function processGameData(spacesCsv, diceRollCsv, outputDir, modalConfigCsv = null) {
  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const modalConfigLookup = loadModalConfig(modalConfigCsv);

  // Generate all clean files (except DICE_OUTCOMES which has manual fixes)
  const files = {
    'MOVEMENT.csv': processMovement(spacesCsv, diceRollCsv),
    'GAME_CONFIG.csv': processGameConfig(spacesCsv),
    'SPACE_CONTENT.csv': processSpaceContent(spacesCsv),
    'SPACE_EFFECTS.csv': processSpaceEffects(spacesCsv, diceRollCsv, modalConfigLookup),
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
