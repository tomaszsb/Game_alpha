import { IDataService } from '../types/ServiceContracts';
import { shortName, truncate } from './boardCommon';

export function friendlySpaceName(dataService: IDataService, spaceName: string): string {
  if (!spaceName) return '';
  const override = dataService.getDisplayLabelOverride(spaceName);
  return override || shortName(spaceName);
}

export function friendlyCardName(dataService: IDataService | undefined, cardId: string, maxLen = 30): string {
  if (!cardId) return '';
  if (!dataService) return cardId;
  const card = dataService.getCardById(cardId);
  if (!card?.card_name) return cardId;
  return truncate(card.card_name, maxLen);
}

export function friendlyCardList(dataService: IDataService | undefined, cardIds: string[], maxLen = 30): string {
  return cardIds.map(id => friendlyCardName(dataService, id, maxLen)).join(', ');
}
