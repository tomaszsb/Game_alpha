import { ActionLogEntry } from '../types/StateTypes';

export const formatActionDescription = (entry: ActionLogEntry): string => {
  switch (entry.type) {
    case 'dice_roll':
      // Use the unified description that already includes outcomes
      return `🎲 ${entry.description}`;
      
    case 'card_draw': {
      if (entry.details?.cardType && entry.details?.cardCount) {
        const typeNames: Record<string, string> = { W: 'Work Package', B: 'Bank Loan', E: 'Expeditor', L: 'Life Event', I: 'Investment' };
        const name = typeNames[entry.details.cardType] || entry.details.cardType;
        const count = entry.details.cardCount;
        return `🎴 Got ${count} ${name}${count > 1 ? 's' : ''}`;
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

    default:
      return entry.description;
  }
};