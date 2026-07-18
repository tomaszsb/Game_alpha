import { ActionLogEntry } from '../types/StateTypes';

export const formatActionDescription = (entry: ActionLogEntry): string => {
  switch (entry.type) {
    case 'dice_roll':
      // Voice rule (no game language): no 🎲. The description already carries the
      // real-world outcome; 🎯 reads as "result/outcome".
      return `🎯 ${entry.description}`;

    case 'card_draw': {
      // Note: the emission points (CardEffectHandler.logCardDraw,
      // LogWriter's 'card_drawn' case) write the count under `count`, not
      // `cardCount` — `cardCount` belongs to the unrelated DiceResultEffect
      // shape. Read `count` (falling back to the legacy/test key) so this
      // branch actually fires instead of silently falling through to the
      // raw description below.
      const cardCount = entry.details?.count ?? entry.details?.cardCount;
      if (entry.details?.cardType && cardCount) {
        const typeNames: Record<string, string> = { W: 'Work Package', B: 'Bank Loan', E: 'Expeditor', L: 'Life Event', I: 'Investment' };
        // Voice rule (no game language): no 🎴 playing-card icon — use the
        // real-world per-type icon that matches the rest of the UI.
        const typeIcons: Record<string, string> = { W: '🏗️', B: '🏦', E: '⚡', L: '📰', I: '💰' };
        const name = typeNames[entry.details.cardType] || entry.details.cardType;
        const icon = typeIcons[entry.details.cardType] || '📄';
        let text = `${icon} Got ${cardCount} ${name}${cardCount > 1 ? 's' : ''}`;
        // Inline delta (TODO P1 — Project Chronicle): a Work Package draw's
        // count alone doesn't say how much it moved the needle — a $50k
        // scope and a $500k scope both read as "Got 1 Work Package". Append
        // the actual project-scope change when the emission point captured
        // it (details.scopeDelta — sum of the drawn cards' `cost` field).
        if (entry.details.cardType === 'W' && typeof entry.details.scopeDelta === 'number' && entry.details.scopeDelta > 0) {
          text += ` (+$${entry.details.scopeDelta.toLocaleString()})`;
        }
        return text;
      }
      return entry.description;
    }

    case 'space_effect':
      const cleanDescription = entry.description.replace(/^📍\s*Space Effect:\s*/, '');
      return `⚡ ${cleanDescription}`;
      
    case 'time_effect':
      const cleanTimeDescription = entry.description.replace(/^📍\s*Space Effect:\s*/, '');
      return `⏰ ${cleanTimeDescription}`;

    case 'manual_action':
      return `✋ ${entry.description}`;

    case 'resource_change':
      return `💰 ${entry.description}`;

    case 'space_entry':
      return `📍 ${entry.description}`;

    case 'game_start':
      return `🏁 ${entry.description}`;

    case 'game_end':
      return `🏆 ${entry.description}`;

    case 'error_event':
      return `❌ ${entry.description}`;

    case 'choice_made':
      return `👉 ${entry.description}`;

    case 'negotiation_resolved':
      return `🤝 ${entry.description}`;

    case 'system_log':
      return `⚙️ ${entry.description}`;

    case 'turn_start':
      return `▶️ ${entry.description}`;

    case 'turn_end':
      return `⏹️ ${entry.description}`;

    case 'approval_revoked':
      return `⚠️ ${entry.description}`;

    case 'approval_outcome_determined':
      return `📋 ${entry.description}`;

    case 'routed_back_to_review':
      return `🛂 ${entry.description}`;

    default:
      return entry.description;
  }
};

// Human-readable label for an ActionLogEntry.type — the raw value is a
// snake_case internal enum ("manual_action", "space_entry", etc.) that read
// as "directly from a CSV" when shown verbatim in the post-game log's type
// filter dropdown (fb:69fe31a4). Kept separate from formatActionDescription
// (which formats the whole line, not just the type name).
const LOG_TYPE_LABELS: Record<ActionLogEntry['type'], string> = {
  space_entry: 'Arrived at a space',
  space_effect: 'Space effect',
  time_effect: 'Time change',
  dice_roll: 'Dice roll',
  card_draw: 'Card drawn',
  resource_change: 'Resource change',
  manual_action: 'Action taken',
  turn_start: 'Turn started',
  turn_end: 'Turn ended',
  card_play: 'Card played',
  card_transfer: 'Card transferred',
  card_discard: 'Card discarded',
  player_movement: 'Moved',
  card_activate: 'Card activated',
  card_expire: 'Card expired',
  deck_reshuffle: 'Deck reshuffled',
  game_start: 'Game started',
  game_end: 'Game ended',
  error_event: 'Error',
  choice_made: 'Choice made',
  negotiation_resolved: 'Negotiation resolved',
  system_log: 'System note',
  approval_revoked: 'Approval revoked',
  approval_outcome_determined: 'Approval decided',
  routed_back_to_review: 'Sent back for review',
};

export const getLogTypeLabel = (type: ActionLogEntry['type']): string =>
  LOG_TYPE_LABELS[type] || type;