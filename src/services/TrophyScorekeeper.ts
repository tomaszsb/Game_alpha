// src/services/TrophyScorekeeper.ts
// Keeps the "best built" ledger. Listens for quality_event on the GameEvent bus and
// adds each one to the player's trophyRecord through updateTempState, so a Try Again or
// push-back that throws the turn away throws away the events it recorded too.
// Like LogWriter/ToastWriter it is constructed only so its subscription registers.
import { IStateService } from '../types/ServiceContracts';
import { GameEvent } from '../types/GameEvents';
import { withQualityEvent } from '../utils/trophyRecord';

export class TrophyScorekeeper {
  constructor(private stateService: IStateService) {
    this.stateService.subscribeToGameEvents(this.handleEvent);
  }

  private handleEvent = (event: GameEvent): void => {
    if (event.type !== 'quality_event') return;
    const player = this.stateService.getPlayer(event.playerId);
    if (!player) return;
    this.stateService.updateTempState(event.playerId, {
      trophyRecord: withQualityEvent(player.trophyRecord, event.eventId),
    });
  };
}
