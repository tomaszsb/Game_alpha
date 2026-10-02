import { IDataService } from '../types/ServiceContracts';
import { shortName, truncate } from './boardCommon';
import { getCardWordedFor } from './scopeWording';

export function friendlySpaceName(dataService: IDataService, spaceName: string): string {
  if (!spaceName) return '';
  const override = dataService.getDisplayLabelOverride(spaceName);
  return override || shortName(spaceName);
}

/** `projectType` = the kind of project of the player the entry is about (work packages read as
 *  work on THEIR job — see utils/scopeWording). Omit it and a card keeps its own wording. */
export function friendlyCardName(dataService: IDataService | undefined, cardId: string, maxLen = 30, projectType?: string): string {
  if (!cardId) return '';
  if (!dataService) return cardId;
  const card = getCardWordedFor(dataService, cardId, projectType);
  if (!card?.card_name) return cardId;
  return truncate(card.card_name, maxLen);
}

export function friendlyCardList(dataService: IDataService | undefined, cardIds: string[], maxLen = 30, projectType?: string): string {
  return cardIds.map(id => friendlyCardName(dataService, id, maxLen, projectType)).join(', ');
}
