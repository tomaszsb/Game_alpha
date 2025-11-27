import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';
import { DiceResultModal, DiceRollResult } from '../modals/DiceResultModal';
import { Player } from '../../types/DataTypes';
import { GamePhase } from '../../types/StateTypes';
import { Choice } from '../../types/CommonTypes';
import { formatManualEffectButton, getManualEffectButtonStyle } from '../../utils/buttonFormatting';

interface TurnControlsProps {
  onOpenNegotiationModal: () => void;
}

export function TurnControlsLEGACY({ onOpenNegotiationModal }: TurnControlsProps): JSX.Element {
  console.log('🚨 LEGACY TurnControls component mounting - this should not be used!');
  const { stateService, turnService, playerActionService, dataService, choiceService, movementService } = useGameContext();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('SETUP');
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  const [humanPlayerId, setHumanPlayerId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [hasPlayerMovedThisTurn, setHasPlayerMovedThisTurn] = useState(false);
  const [hasPlayerRolledDice, setHasPlayerRolledDice] = useState(false);
  const [hasCompletedManualActions, setHasCompletedManualActions] = useState(false);
  const [awaitingChoice, setAwaitingChoice] = useState(false);
  const [currentChoice, setCurrentChoice] = useState<Choice | null>(null);
  const [actionCounts, setActionCounts] = useState({ required: 0, completed: 0 });
  const [diceResult, setDiceResult] = useState<DiceRollResult | null>(null);
  const [showDiceResultModal, setShowDiceResultModal] = useState(false);

  // Subscribe to state changes for live updates
  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      setGamePhase(gameState.gamePhase);
      setHasPlayerMovedThisTurn(gameState.hasPlayerMovedThisTurn || false);
      setHasPlayerRolledDice(gameState.hasPlayerRolledDice || false);
      setHasCompletedManualActions(Object.keys(gameState.completedActions.manualActions).length > 0);
      setAwaitingChoice(gameState.awaitingChoice !== null);
      setCurrentChoice(gameState.awaitingChoice);

      // Update action counts from game state
      setActionCounts({
        required: gameState.requiredActions || 1,
        completed: gameState.completedActionCount || 0
      });
      
      // Set the first player as the human player (for demo purposes)
      if (gameState.players.length > 0 && !humanPlayerId) {
        setHumanPlayerId(gameState.players[0].id);
      }
      
      if (gameState.currentPlayerId) {
        const player = gameState.players.find(p => p.id === gameState.currentPlayerId);
        setCurrentPlayer(player || null);
      } else {
        setCurrentPlayer(null);
      }
    });
    
    // Initialize with current state
    const gameState = stateService.getGameState();
    setGamePhase(gameState.gamePhase);
    setHasPlayerMovedThisTurn(gameState.hasPlayerMovedThisTurn || false);
    setHasPlayerRolledDice(gameState.hasPlayerRolledDice || false);
    setAwaitingChoice(gameState.awaitingChoice !== null);
    
    // Initialize action counts
    setActionCounts({
      required: gameState.requiredActions || 1,
      completed: gameState.completedActionCount || 0
    });
    
    // Set the first player as the human player
    if (gameState.players.length > 0 && !humanPlayerId) {
      setHumanPlayerId(gameState.players[0].id);
    }
    
    if (gameState.currentPlayerId) {
      const player = gameState.players.find(p => p.id === gameState.currentPlayerId);
      setCurrentPlayer(player || null);
    }
    
    return unsubscribe;
  }, [stateService, humanPlayerId]);

  // Handle automatic AI turns
  useEffect(() => {
    if (gamePhase === 'PLAY' && currentPlayer && currentPlayer.id !== humanPlayerId && !isProcessingTurn) {
      // Add delay to make AI turns feel natural
      const aiTurnTimer = setTimeout(async () => {
        try {
          setIsProcessingTurn(true);
          const result = await turnService.takeTurn(currentPlayer.id);

          // End the AI player's turn and advance to next player
          setTimeout(async () => {
            try {
              await turnService.endTurn();
            } catch (error) {
              console.error('Error ending AI turn:', error);
            } finally {
              setIsProcessingTurn(false);
            }
          }, 2000);
        } catch (error: any) {
          console.error('Error during AI turn:', error);
          setIsProcessingTurn(false);
        }
      }, 1500); // 1.5 second delay for AI turns
      
      return () => clearTimeout(aiTurnTimer);
    }
  }, [currentPlayer?.id, gamePhase, humanPlayerId, isProcessingTurn, turnService]);

  // Check for movement choices when it's the human player's turn
  useEffect(() => {
    console.log('🔍 TurnControls useEffect triggered - Movement choice check', {
      gamePhase,
      currentPlayerId: currentPlayer?.id,
      humanPlayerId,
      isProcessingTurn,
      awaitingChoice,
      currentSpace: currentPlayer?.currentSpace
    });

    if (gamePhase === 'PLAY' && currentPlayer && currentPlayer.id === humanPlayerId && !isProcessingTurn && !awaitingChoice) {
      console.log(`🔍 Checking for movement options for ${currentPlayer.name} at ${currentPlayer.currentSpace}`);

      // Check if player has multiple movement options at current location
      const checkMovementOptions = async () => {
        try {
          // Check movement type - skip choice creation for dice_outcome spaces
          // Those choices are created AFTER dice roll in TurnService.processTurnEffectsWithTracking()
          const movement = dataService.getMovement(currentPlayer.currentSpace, currentPlayer.visitType);
          if (movement?.movement_type === 'dice_outcome') {
            console.log(`🔍 TurnControls: Skipping choice for dice_outcome space ${currentPlayer.currentSpace} (choice created after dice roll)`);
            return;
          }

          const validMoves = movementService.getValidMoves(currentPlayer.id);

          if (validMoves.length > 1) {
            console.log(`🚶 ${currentPlayer.name} has ${validMoves.length} movement options at ${currentPlayer.currentSpace}`);

            // Create movement choice for TurnControls
            const options = validMoves.map(destination => ({
              id: destination,
              label: destination
            }));

            const prompt = `Choose your destination from ${currentPlayer.currentSpace}:`;

            await choiceService.createChoice(
              currentPlayer.id,
              'MOVEMENT',
              prompt,
              options
            );
          } else {
            console.log(`🚶 ${currentPlayer.name} has ${validMoves.length} movement options - no choice needed`);
          }
        } catch (error) {
          console.warn(`Warning: Could not check movement options for ${currentPlayer.name}:`, error);
        }
      };

      checkMovementOptions();
    }
  }, [currentPlayer?.id, gamePhase, humanPlayerId, isProcessingTurn, awaitingChoice, choiceService, movementService, dataService, currentPlayer?.currentSpace, currentPlayer?.visitType]);

  const handleRollDice = async () => {
    if (!currentPlayer || isProcessingTurn) return;

    try {
      setIsProcessingTurn(true);
      console.log(`Rolling dice for player: ${currentPlayer.name}`);
      
      // Use rollDiceWithFeedback for dice roll + effects + feedback modal
      const result = await turnService.rollDiceWithFeedback(currentPlayer.id);
      setDiceResult(result);
      setShowDiceResultModal(true);
      
      console.log(`Dice rolled! ${currentPlayer.name} rolled a ${result.diceValue}`);
      console.log('Effects:', result.effects);
      
      // Modal handles all dice feedback now - no duplicate notifications needed
    } catch (error) {
      console.error('Error rolling dice:', error);
    } finally {
      setIsProcessingTurn(false);
    }
  };

  const handleCloseDiceResultModal = () => {
    setShowDiceResultModal(false);
    setDiceResult(null);
  };

  const handleDiceResultConfirm = () => {
    handleCloseDiceResultModal();
    // Additional logic if needed for choices would go here
  };

  const handleEndTurn = async () => {
    if (!currentPlayer || isProcessingTurn) return;

    try {
      setIsProcessingTurn(true);
      console.log(`Ending turn for player: ${currentPlayer.name}`);

      // TurnService will handle executing the move from player's moveIntent
      await turnService.endTurnWithMovement();
      console.log(`Turn ended for ${currentPlayer.name}`);
    } catch (error) {
      console.error('Error ending turn:', error);
    } finally {
      setIsProcessingTurn(false);
    }
  };

  const handleNegotiate = async () => {
    if (!currentPlayer || isProcessingTurn) return;
    
    // Get space content to check if negotiation is allowed on this space
    const spaceContent = dataService.getSpaceContent(currentPlayer.currentSpace, currentPlayer.visitType);
    console.log('🤝 Negotiate Debug:', { 
      currentSpace: currentPlayer.currentSpace, 
      visitType: currentPlayer.visitType, 
      spaceContent,
      canNegotiate: spaceContent?.can_negotiate 
    });
    
    if (spaceContent && spaceContent.can_negotiate === true) {
      // Space-specific negotiation using TurnService method
      console.log(`Negotiation available on ${currentPlayer.currentSpace}`);
      
      try {
        setIsProcessingTurn(true);
        const result = await turnService.performNegotiation(currentPlayer.id);
        
        // Show result to user
        alert(result.message);
        
        if (result.success) {
          setFeedbackMessage('Negotiation successful! State restored.');
        } else {
          setFeedbackMessage('Negotiation failed. Time penalty applied.');
        }
        
        // Clear feedback after 4 seconds
        setTimeout(() => {
          setFeedbackMessage('');
        }, 4000);
        
      } catch (error: any) {
        console.error('Error during negotiation:', error);
        alert(`Negotiation failed: ${error.message}`);
      } finally {
        setIsProcessingTurn(false);
      }
    } else {
      console.log('Negotiation not available on this space');
      alert('Negotiation not available on this space.');
    }
  };

  const handleManualEffect = async (effectType: string) => {
    if (!currentPlayer || isProcessingTurn) return;

    try {
      setIsProcessingTurn(true);
      console.log(`Triggering manual ${effectType} effect for player: ${currentPlayer.name}`);
      
      // Use triggerManualEffectWithFeedback for modal support
      const result = await turnService.triggerManualEffectWithFeedback(currentPlayer.id, effectType);
      console.log(`Manual ${effectType} effect completed! Effects:`, result.effects);
      
      // Set modal result and show modal
      setDiceResult(result);
      setShowDiceResultModal(true);
      
    } catch (error: any) {
      console.error(`Error triggering manual ${effectType} effect:`, error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsProcessingTurn(false);
    }
  };


  // Check for available manual effects
  // Filter out 'turn' effects since they duplicate the regular End Turn button
  const manualEffects = currentPlayer ?
    dataService.getSpaceEffects(currentPlayer.currentSpace, currentPlayer.visitType)
      .filter(effect => effect.trigger_type === 'manual')
      .filter(effect => effect.effect_type !== 'turn') : []; // Exclude turn effects to avoid duplicate end turn buttons


  const isHumanPlayerTurn = currentPlayer?.id === humanPlayerId;
  // Hide dice roll button on OWNER-FUND-INITIATION space (funding is automatic)
  const isOnFundingSpace = currentPlayer?.currentSpace === 'OWNER-FUND-INITIATION';
  const canRollDice = gamePhase === 'PLAY' && isHumanPlayerTurn && 
                     !isProcessingTurn && !hasPlayerRolledDice && !hasPlayerMovedThisTurn && !awaitingChoice &&
                     !isOnFundingSpace;
  // On OWNER-FUND-INITIATION space, allow ending turn without dice roll (funding is automatic)
  // Disable end turn if there's a pending movement choice
  const canEndTurn = gamePhase === 'PLAY' && isHumanPlayerTurn &&
                    !isProcessingTurn &&
                    (hasPlayerRolledDice || isOnFundingSpace) &&
                    actionCounts.completed >= actionCounts.required &&
                    !(currentChoice && currentChoice.type === 'MOVEMENT');

  // MANUAL MOVEMENT CHOICE TEST - Remove this later
  const testMovementChoice = async () => {
    if (!currentPlayer) return;
    console.log('🧪 MANUAL TEST: Checking movement options for', currentPlayer.name, 'at', currentPlayer.currentSpace);

    try {
      const validMoves = movementService.getValidMoves(currentPlayer.id);
      console.log('🧪 MANUAL TEST: Valid moves found:', validMoves);

      if (validMoves.length > 1) {
        console.log('🧪 MANUAL TEST: Creating movement choice');
        const options = validMoves.map(destination => ({
          id: destination,
          label: destination
        }));

        await choiceService.createChoice(
          currentPlayer.id,
          'MOVEMENT',
          `Choose your destination from ${currentPlayer.currentSpace}:`,
          options
        );
        console.log('🧪 MANUAL TEST: Movement choice created successfully');
      }
    } catch (error) {
      console.error('🧪 MANUAL TEST: Error:', error);
    }
  };

  // Handle movement choice selection
  const handleMovementChoice = (choiceId: string) => {
    if (!currentChoice || currentChoice.type !== 'MOVEMENT' || !currentPlayer) {
      console.error('No valid movement choice available');
      return;
    }

    // Check if player already has a move intent (choice already resolved)
    if (currentPlayer.moveIntent) {
      console.log(`🎯 Player ${currentPlayer.name} already has move intent: ${currentPlayer.moveIntent}`);
      return; // Don't resolve again
    }

    // Store the intent in game state instead of executing the move
    console.log(`🎯 Player ${currentPlayer.name} selected destination intent: ${choiceId}`);
    stateService.setPlayerMoveIntent(currentPlayer.id, choiceId);

    // Resolve the choice - this will unblock the code waiting for the choice
    // The awaiting code (TurnService) will handle clearing the choice from state
    choiceService.resolveChoice(currentChoice.id, choiceId);
  };

  // Debug End Turn button state
  if (currentPlayer && actionCounts.completed >= actionCounts.required) {
    console.log(`🏁 End Turn Debug for ${currentPlayer.name}:`);
    console.log(`  gamePhase === 'PLAY': ${gamePhase === 'PLAY'}`);
    console.log(`  isHumanPlayerTurn: ${isHumanPlayerTurn}`);
    console.log(`  !isProcessingTurn: ${!isProcessingTurn}`);
    console.log(`  hasPlayerRolledDice: ${hasPlayerRolledDice}`);
    console.log(`  actionCounts: ${actionCounts.completed}/${actionCounts.required}`);
    console.log(`  canEndTurn: ${canEndTurn}`);
  }

  if (gamePhase !== 'PLAY') {
    const handleStartGame = async () => {
      try {
        // Add a test player if no players exist
        const gameState = stateService.getGameState();
        if (gameState.players.length === 0) {
          stateService.addPlayer('Test Player');
        }
        // Start the game
        stateService.startGame();

        // Place players on starting spaces (no effects processing)
        console.log('🏁 Placing players on starting spaces...');
        try {
          await turnService.placePlayersOnStartingSpaces();
          console.log('✅ Players placed on starting spaces successfully');

          // Start the first turn (this will create snapshots and mark as initialized)
          const currentState = stateService.getGameState();
          if (currentState.currentPlayerId) {
            console.log('🎬 Starting first turn for game initialization...');
            await turnService.startTurn(currentState.currentPlayerId);
          }
        } catch (error) {
          console.error('❌ Error placing players on starting spaces:', error);
        }
      } catch (error) {
        console.error('Error starting game:', error);
      }
    };

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px',
          backgroundColor: colors.secondary.bg,
          border: `1px solid ${colors.secondary.border}`,
          borderRadius: '4px',
          color: colors.secondary.main,
          fontSize: '8px',
          gap: '6px'
        }}
      >
        <div>
          🎯 Game setup... (Phase: {gamePhase})
        </div>
        <button
          onClick={handleStartGame}
          style={{
            padding: '4px 8px',
            fontSize: '8px',
            backgroundColor: colors.success.main,
            color: colors.white,
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Start Game
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '6px',
        backgroundColor: colors.white,
        borderRadius: '6px'
      }}
    >
      {/* Turn Controls Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: colors.text.primary }}>
          🎮 Turn Controls - FORCE UPDATE v2.0 - {Date.now()}
        </div>
        <div style={{ fontSize: '8px', color: 'red', fontWeight: 'bold' }}>
          🔥 CHOICE: {currentChoice?.type || 'NULL'} | SPACE: {currentPlayer?.currentSpace || 'NULL'}
        </div>
        <div style={{ fontSize: '8px', color: 'orange', fontWeight: 'bold' }}>
          🔥 AWAITING: {awaitingChoice ? 'YES' : 'NO'} | HUMAN: {isHumanPlayerTurn ? 'YES' : 'NO'}
        </div>
      </div>

      {/* TEMP TEST BUTTON - Remove after debugging */}
      {currentPlayer && currentPlayer.currentSpace === 'PM-DECISION-CHECK' && (
        <button
          onClick={testMovementChoice}
          style={{
            width: '100%',
            padding: '8px',
            margin: '4px 0',
            backgroundColor: '#ff6b35',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px'
          }}
        >
          🧪 TEST: Create Movement Choice
        </button>
      )}


      {/* Status Messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
        
        {/* Dice Roll Result Display - Removed to avoid duplication with modal */}
        
        {/* Feedback Message Display */}
        {feedbackMessage && (
          <div 
            style={{
              padding: '6px 12px',
              backgroundColor: colors.info.light,
              border: `2px solid ${colors.info.main}`,
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 'bold',
              color: colors.info.dark,
              animation: 'fadeIn 0.3s ease-in',
              textAlign: 'center'
            }}
          >
            💡 {feedbackMessage}
          </div>
        )}
      </div>
        
      {/* Action Buttons Container */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '6px',
        backgroundColor: colors.secondary.bg,
        borderRadius: '6px',
        border: `1px solid ${colors.secondary.border}`
      }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 'bold',
          color: colors.secondary.main,
          textAlign: 'center',
          marginBottom: '2px'
        }}>
          🎯 ACTIONS
        </div>
        
        {/* Show funding message on OWNER-FUND-INITIATION space instead of dice button */}
        {isOnFundingSpace ? (
          <div
            style={{
              padding: '6px 8px',
              fontSize: '10px',
              fontWeight: 'bold',
              color: colors.warning.dark,
              backgroundColor: colors.warning.light,
              border: `1px solid ${colors.warning.border}`,
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              textAlign: 'center',
              lineHeight: '1.2'
            }}
          >
            <span>💰</span>
            <span>Reviewing project scope for funding level...</span>
          </div>
        ) : (
          <button
            onClick={handleRollDice}
            disabled={!canRollDice}
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: 'bold',
              color: canRollDice ? colors.white : colors.secondary.main,
              backgroundColor: canRollDice ? colors.success.main : colors.secondary.bg,
              border: 'none',
              borderRadius: '4px',
              cursor: canRollDice ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              transition: 'all 0.2s ease',
              transform: isProcessingTurn ? 'scale(0.95)' : 'scale(1)',
              opacity: isProcessingTurn ? 0.7 : 1,
            }}
          >
            {isProcessingTurn ? (
              <>
                <span>🎲</span>
                <span>Rolling...</span>
              </>
            ) : (
              <>
                <span>🎲</span>
                <span>Roll Dice</span>
              </>
            )}
          </button>
        )}


        {/* Manual Space Effect Buttons */}
        {isHumanPlayerTurn && manualEffects.length > 0 && manualEffects.map((effect, index) => {
          // Use centralized button formatting
          const { text: buttonText, icon: buttonIcon } = formatManualEffectButton(effect);

          const isButtonDisabled = isProcessingTurn || hasCompletedManualActions;

          return (
            <button
              key={index}
              onClick={() => handleManualEffect(effect.effect_type)}
              disabled={isButtonDisabled}
              title={isButtonDisabled ? 'Manual action already completed' : ''}
              style={getManualEffectButtonStyle(isButtonDisabled, colors)}
            >
              <span>{buttonIcon}</span>
              <span>{buttonText}</span>
            </button>
          );
        })}

        {/* Movement Choice Buttons */}
        {(() => {
          console.log('🔍 TurnControls Movement Choice Debug:', {
            isHumanPlayerTurn,
            currentChoice,
            choiceType: currentChoice?.type,
            shouldShow: isHumanPlayerTurn && currentChoice && currentChoice.type === 'MOVEMENT'
          });
          return null;
        })()}
        {isHumanPlayerTurn && currentChoice && currentChoice.type === 'MOVEMENT' && (
          <>
            <div style={{
              fontSize: '10px',
              fontWeight: 'bold',
              color: colors.info.main,
              textAlign: 'center',
              marginTop: '6px',
              marginBottom: '2px'
            }}>
              🚶 Choose Destination
            </div>
            {currentChoice.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleMovementChoice(option.id)}
                disabled={isProcessingTurn}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: !isProcessingTurn ? colors.white : colors.secondary.main,
                  backgroundColor: !isProcessingTurn ? colors.info.main : colors.secondary.bg,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: !isProcessingTurn ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  transition: 'all 0.2s ease',
                  transform: isProcessingTurn ? 'scale(0.95)' : 'scale(1)',
                  opacity: isProcessingTurn ? 0.7 : 1,
                }}
              >
                <span>🎯</span>
                <span>{option.label}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Turn-Ending Buttons Container */}
      {isHumanPlayerTurn && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '6px',
          backgroundColor: colors.danger.light,
          borderRadius: '6px',
          border: `2px solid ${colors.danger.main}`,
          marginTop: '8px'
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 'bold',
            color: colors.danger.main,
            textAlign: 'center',
            marginBottom: '2px'
          }}>
            🏁 END TURN
          </div>
          
          {/* End Turn Button */}
          <button
            onClick={handleEndTurn}
            disabled={!canEndTurn}
            title={
              currentChoice && currentChoice.type === 'MOVEMENT'
                ? 'Select a movement destination before ending turn'
                : canEndTurn
                  ? 'End your turn'
                  : `Complete ${actionCounts.required - actionCounts.completed} more action(s) to end turn`
            }
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: 'bold',
              color: canEndTurn ? colors.white : colors.secondary.main,
              backgroundColor: canEndTurn ? colors.success.main : colors.secondary.bg,
              border: 'none',
              borderRadius: '4px',
              cursor: canEndTurn ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              transition: 'all 0.2s ease',
              transform: !canEndTurn ? 'scale(0.95)' : 'scale(1)',
              opacity: !canEndTurn ? 0.7 : 1,
              }}
          >
            <span>⏹️</span>
            <span>End Turn ({actionCounts.completed}/{actionCounts.required})</span>
          </button>

          {/* Negotiate Button */}
          <button
            onClick={handleNegotiate}
            disabled={isProcessingTurn}
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: 'bold',
              color: !isProcessingTurn ? colors.white : colors.secondary.main,
              backgroundColor: !isProcessingTurn ? colors.warning.main : colors.secondary.bg,
              border: 'none',
              borderRadius: '4px',
              cursor: !isProcessingTurn ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              transition: 'all 0.2s ease',
              transform: isProcessingTurn ? 'scale(0.95)' : 'scale(1)',
              opacity: isProcessingTurn ? 0.7 : 1,
              }}
          >
            <span>🤝</span>
            <span>Negotiate</span>
          </button>
        </div>
      )}

      {/* Dice Result Modal */}
      <DiceResultModal
        isOpen={showDiceResultModal}
        result={diceResult}
        onClose={handleCloseDiceResultModal}
        onConfirm={diceResult?.hasChoices ? handleDiceResultConfirm : undefined}
      />
    </div>
  );
}