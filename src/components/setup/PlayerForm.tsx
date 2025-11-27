// src/components/setup/PlayerForm.tsx

import React, { useState } from 'react';
import { colors } from '../../styles/theme';
import { usePlayerValidation, ValidationResult } from './usePlayerValidation';

interface PlayerFormProps {
  onAddPlayer: () => void;
  canAddPlayer: boolean;
  validationResult: ValidationResult;
}

/**
 * PlayerForm component handles the UI for adding new players
 * Extracted from the legacy component's add player functionality
 */
export function PlayerForm({ 
  onAddPlayer, 
  canAddPlayer, 
  validationResult 
}: PlayerFormProps): JSX.Element {
  const [showTooltip, setShowTooltip] = useState(false);

  /**
   * Handle add player button click
   */
  const handleAddPlayer = () => {
    if (canAddPlayer && validationResult.isValid) {
      onAddPlayer();
    } else if (!validationResult.isValid && validationResult.errorMessage) {
      alert(validationResult.errorMessage);
    }
  };

  /**
   * Handle button hover effects
   */
  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (canAddPlayer && validationResult.isValid) {
      const button = e.currentTarget;
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 20px rgba(40, 167, 69, 0.4)';
    }
    setShowTooltip(true);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (canAddPlayer && validationResult.isValid) {
      const button = e.currentTarget;
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.3)';
    }
    setShowTooltip(false);
  };

  /**
   * Determine button styles based on state
   */
  const getButtonStyles = () => {
    const baseStyles: React.CSSProperties = {
      border: 'none',
      borderRadius: '12px',
      padding: '1rem 2rem',
      fontSize: '1.1rem',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      width: '100%',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      position: 'relative'
    };

    if (canAddPlayer && validationResult.isValid) {
      return {
        ...baseStyles,
        background: `linear-gradient(45deg, ${colors.success.main}, ${colors.game.teal})`,
        color: colors.white,
        boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)'
      };
    } else {
      return {
        ...baseStyles,
        background: colors.secondary.main,
        color: colors.white,
        cursor: 'not-allowed',
        opacity: 0.6
      };
    }
  };

  /**
   * Get tooltip text based on validation state
   */
  const getTooltipText = (): string => {
    if (!canAddPlayer) {
      return 'Maximum number of players reached';
    }
    if (!validationResult.isValid && validationResult.errorMessage) {
      return validationResult.errorMessage;
    }
    return 'Click to add a new player';
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        onClick={handleAddPlayer}
        disabled={!canAddPlayer || !validationResult.isValid}
        style={getButtonStyles()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={getTooltipText()}
        aria-label="Add new player"
      >
        {canAddPlayer && validationResult.isValid ? (
          <>
            <span style={{ fontSize: '1.2rem' }}>+</span>
            Add Player
          </>
        ) : (
          <>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            Cannot Add Player
          </>
        )}
      </button>

      {/* Tooltip for better UX */}
      {showTooltip && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
          padding: '8px 12px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: colors.white,
          borderRadius: '6px',
          fontSize: '0.9rem',
          whiteSpace: 'nowrap',
          zIndex: 1000,
          opacity: showTooltip ? 1 : 0,
          transition: 'opacity 0.2s ease'
        }}>
          {getTooltipText()}
          
          {/* Tooltip arrow */}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid rgba(0, 0, 0, 0.8)'
          }} />
        </div>
      )}
    </div>
  );
}