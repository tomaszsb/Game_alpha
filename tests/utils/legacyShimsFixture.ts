// The shape of a real saved game, for the clone test: players with hands, a turn snapshot, logs with undefined fields.
export const GameStateSnapshotForTest = {
  players: [
    {
      id: 'player_1',
      name: 'Inka',
      money: 1250000,
      currentSpace: 'OWNER-FUND-INITIATION',
      visitType: 'First',
      visitedSpaces: ['OWNER-SCOPE-INITIATION', 'OWNER-FUND-INITIATION'],
      hand: ['W119', 'W116', 'E003'],
      activeCards: [{ cardId: 'B002', expirationTurn: undefined }],
      moneySources: { ownerFunding: 950000, bankLoans: 300000, investmentDeals: 0, other: 0 },
      moveIntent: null,
      dobApprovalStatus: 'none',
      peakScope: 950000,
    },
    { id: 'player_2', name: 'Tom', money: 0, hand: [], activeCards: [], moveIntent: 'BANK-FUND-REVIEW', moneySources: {} },
  ],
  currentPlayerId: 'player_1',
  gamePhase: 'PLAY',
  gameRound: 4,
  isGameOver: false,
  winner: undefined,
  awaitingChoice: { id: 'c1', type: 'MOVEMENT', options: [{ id: 'A', label: 'Go' }, { id: 'B', label: 'Stay' }] },
  globalActionLog: [
    { id: 'l1', type: 'dice_roll', timestamp: new Date(1793373486184), playerId: 'player_1', description: 'Rolled', details: { value: 3 }, isCommitted: true },
    { id: 'l2', type: 'card_draw', timestamp: new Date(1793373487184), playerId: 'player_2', description: 'Drew', details: undefined, isCommitted: false },
  ],
  activeEffects: [],
};
