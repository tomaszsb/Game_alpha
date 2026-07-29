// src/components/setup/usePlayerValidation.ts

import { useMemo } from 'react';
import { Player } from '../../types/StateTypes';
import { IStateService, IGameRulesService } from '../../types/ServiceContracts';
import { colors } from '../../styles/theme';

/**
 * Color option interface
 */
export interface ColorOption {
  color: string;
  name: string;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Available colors for players (from legacy component)
 */
export const AVAILABLE_COLORS: ColorOption[] = [
  { color: colors.game.player1, name: 'Blue' },
  { color: colors.game.player2, name: 'Green' },
  { color: colors.game.player3, name: 'Red' },
  { color: colors.game.player8, name: 'Orange' },
  { color: colors.game.player5, name: 'Purple' },
  { color: colors.game.player6, name: 'Pink' },
  { color: colors.game.player7, name: 'Teal' },
  { color: colors.game.player4, name: 'Yellow' }
];

/**
 * Available avatars for players (from legacy component)
 */
export const AVAILABLE_AVATARS: string[] = [
  '👤', '👨‍💼', '👩‍💼', '👨‍🔧', '👩‍🔧', 
  '👨‍💻', '👩‍💻', '🧑‍🎨', '👨‍🏫', '👩‍🏫'
];

/**
 * Game settings interface
 */
export interface GameSettings {
  maxPlayers: number;
  winCondition: string;
  difficulty: string;
  // Same Starting Point game mode (January 2026)
  sameStartingPoint?: boolean;
  startingMode?: 'QUICK_START' | 'EDUCATIONAL';
  preSelectedHand?: string[];  // For Educational mode
}

/**
 * Custom hook for player validation logic
 * Encapsulates all validation rules from the legacy component
 * Now uses services for validation instead of local logic
 */
export function usePlayerValidation(
  players: Player[],
  gameSettings: GameSettings,
  stateService: IStateService,
  gameRulesService: IGameRulesService,
  // v3.0.25: when true (TV mode), every player must have connected a phone
  // (deviceType === 'mobile') before the game can start. PC mode passes false.
  requirePhones: boolean = false
) {
  
  /**
   * Check if we can add more players
   */
  const canAddPlayer = useMemo(() => {
    // Remove the stateService call that was causing infinite re-renders
    // The gamePhase check should be handled at the component level, not in validation
    return players.length < gameSettings.maxPlayers;
  }, [players.length, gameSettings.maxPlayers]);

  /**
   * Get available colors (not used by existing players)
   */
  const availableColors = useMemo(() => {
    const usedColors = players.map(p => p.color);
    return AVAILABLE_COLORS.filter(c => !usedColors.includes(c.color));
  }, [players]);

  /**
   * Get available avatars (not used by existing players)
   */
  const availableAvatars = useMemo(() => {
    const usedAvatars = players.map(p => p.avatar);
    return AVAILABLE_AVATARS.filter(a => !usedAvatars.includes(a));
  }, [players]);

  /**
   * Check if we can remove players (must have at least 1)
   */
  const canRemovePlayer = useMemo(() => {
    return players.length > 1;
  }, [players.length]);

  /**
   * Validate if a color can be used by a specific player
   */
  const validateColorChoice = (playerId: string, color: string): ValidationResult => {
    const isUsedByOtherPlayer = players.some(p => p.id !== playerId && p.color === color);
    
    if (isUsedByOtherPlayer) {
      const colorOption = AVAILABLE_COLORS.find(c => c.color === color);
      const colorName = colorOption ? colorOption.name : color;
      return {
        isValid: false,
        errorMessage: `The ${colorName} color is already taken by another player. Please choose a different color.`
      };
    }

    return { isValid: true };
  };

  /**
   * Validate if an avatar can be used by a specific player
   */
  const validateAvatarChoice = (playerId: string, avatar: string): ValidationResult => {
    const isUsedByOtherPlayer = players.some(p => p.id !== playerId && p.avatar === avatar);
    
    if (isUsedByOtherPlayer) {
      return {
        isValid: false,
        errorMessage: `This avatar (${avatar}) is already taken by another player. Please choose a different avatar.`
      };
    }

    return { isValid: true };
  };

  /**
   * Validate if we can add a new player
   */
  const validateAddPlayer = (): ValidationResult => {
    if (!canAddPlayer) {
      return {
        isValid: false,
        errorMessage: `Cannot add more players. Maximum of ${gameSettings.maxPlayers} players allowed.`
      };
    }

    // Remove the strict avatar/color validation since StateService handles assignment gracefully
    // The StateService will automatically assign available colors/avatars or reuse them if needed
    
    return { isValid: true };
  };

  /**
   * Cache StateService validation to avoid calling it on every render
   */
  // `players.length` looks unnecessary to exhaustive-deps because the callback
  // body never mentions it — but stateService.canStartGame() reads
  // currentState.players.length internally (StateService.ts:911), so this is a
  // deliberate cache-busting key, not a stray dep. Removing it (as the rule
  // suggests) would leave `stateService` as the only dep — a reference that
  // never changes — freezing the Start Game button in whatever state it had on
  // first render.
  const canStartGame = useMemo(() => {
    return stateService.canStartGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.length, stateService]);

  /**
   * Validate if players can start the game
   */
  const validateGameStart = (): ValidationResult => {
    const validPlayers = players.filter(p => p.name.trim());
    
    if (validPlayers.length === 0) {
      return {
        isValid: false,
        errorMessage: 'Please add at least one player with a valid name.'
      };
    }

    // Use cached StateService validation
    if (!canStartGame) {
      return {
        isValid: false,
        errorMessage: 'Game cannot be started. Check player requirements.'
      };
    }

    // TV mode (v3.0.25): every player must have joined from a phone before
    // the game can start. Players who haven't connected yet have no
    // deviceType (or a non-'mobile' one). List the stragglers by name.
    if (requirePhones) {
      const notConnected = validPlayers.filter(p => p.deviceType !== 'mobile');
      if (notConnected.length > 0) {
        const names = notConnected.map(p => p.name.trim()).join(', ');
        return {
          isValid: false,
          errorMessage: `All players must connect their phone before starting. Waiting on: ${names}. Each player scans their QR code to join.`
        };
      }
    }

    return { isValid: true };
  };

  /**
   * TV mode: names of valid players whose phone hasn't joined yet (no
   * 'mobile' deviceType). Empty when phones aren't required or everyone's
   * in. Same predicate as validateGameStart's phone gate — kept here so the
   * visible "waiting for X to scan" banner (fb: real players never saw the
   * tooltip-only reason) can't drift from what actually blocks the start.
   */
  const waitingOnPhoneNames: string[] = requirePhones
    ? players.filter(p => p.name.trim() && p.deviceType !== 'mobile').map(p => p.name.trim())
    : [];

  /**
   * Get the next available color for a new player
   */
  const getNextAvailableColor = (): string | null => {
    return availableColors.length > 0 ? availableColors[0].color : null;
  };

  /**
   * Get the next available avatar for a new player
   */
  const getNextAvailableAvatar = (): string | null => {
    return availableAvatars.length > 0 ? availableAvatars[0] : null;
  };

  /**
   * Get the next available avatar in sequence for cycling
   * Only returns avatars that are not already in use by other players
   */
  const getNextAvatar = (currentAvatar: string, currentPlayerId: string): string => {
    const currentIndex = AVAILABLE_AVATARS.indexOf(currentAvatar);
    const usedAvatars = players
      .filter(p => p.id !== currentPlayerId)  // Exclude current player
      .map(p => p.avatar);
    
    // Start from the next avatar and loop through until we find an available one
    for (let i = 1; i <= AVAILABLE_AVATARS.length; i++) {
      const nextIndex = (currentIndex + i) % AVAILABLE_AVATARS.length;
      const nextAvatar = AVAILABLE_AVATARS[nextIndex];
      
      if (!usedAvatars.includes(nextAvatar)) {
        return nextAvatar;
      }
    }
    
    // Fallback: return current avatar if all others are taken
    return currentAvatar;
  };

  /**
   * Get player count summary text
   */
  const getPlayerCountSummary = (): string => {
    const remaining = gameSettings.maxPlayers - players.length;
    return `${players.length}/${gameSettings.maxPlayers} players added${
      remaining > 0 
        ? ` • You can add ${remaining} more player${remaining === 1 ? '' : 's'}` 
        : ' • Maximum reached'
    }`;
  };

  return {
    // Validation functions
    validateColorChoice,
    validateAvatarChoice,
    validateAddPlayer,
    validateGameStart,
    waitingOnPhoneNames,

    // State queries
    canAddPlayer,
    canRemovePlayer,
    availableColors,
    availableAvatars,
    
    // Helper functions
    getNextAvailableColor,
    getNextAvailableAvatar,
    getNextAvatar,
    getPlayerCountSummary,
    
    // Constants
    AVAILABLE_COLORS,
    AVAILABLE_AVATARS
  };
}