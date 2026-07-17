// src/services/GameEventBus.ts
// Domain-event stage 2 (docs/design/domain-events.md). Synchronous, ordered
// dispatch for typed GameEvents: listeners run in subscribe order, and a
// throwing listener is caught and logged so it can never break the emitting
// call site — same contract the old StateService.emitAutoAction had.
import { GameEvent } from '../types/GameEvents';

export class GameEventBus {
  private listeners: Array<(event: GameEvent) => void> = [];

  subscribe(callback: (event: GameEvent) => void): () => void {
    this.listeners.push(callback);

    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  emit(event: GameEvent): void {
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in game event listener:', error);
      }
    });
  }
}
