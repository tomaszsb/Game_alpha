import React from 'react';
import { colors, theme } from '../../styles/theme';
import { Space, Player } from '../../types/DataTypes';

interface GameSpaceProps {
  space: Space;
  playersOnSpace: Player[];
  isValidMoveDestination?: boolean;
  isCurrentPlayerSpace?: boolean;
  showMovementIndicators?: boolean;
}

export function GameSpace({ 
  space, 
  playersOnSpace,
  isValidMoveDestination = false,
  isCurrentPlayerSpace = false,
  showMovementIndicators = false
}: GameSpaceProps): JSX.Element {
  // Add CSS animation styles to document head if not already present
  React.useEffect(() => {
    const styleId = 'player-token-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes playerTokenAppear {
          0% {
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) rotate(180deg);
            opacity: 0.8;
          }
          100% {
            transform: scale(1) rotate(360deg);
            opacity: 1;
          }
        }
        
        @keyframes playerTokenPulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Determine visual styling based on movement state
  const getBorderColor = () => {
    if (isCurrentPlayerSpace && showMovementIndicators) return colors.primary.main;
    if (isValidMoveDestination && showMovementIndicators) return colors.warning.main;
    if (playersOnSpace.length > 0) return colors.success.main;
    return colors.secondary.border;
  };

  const getBackgroundColor = () => {
    if (isCurrentPlayerSpace && showMovementIndicators) return colors.primary.light;
    if (isValidMoveDestination && showMovementIndicators) return colors.warning.light;
    if (playersOnSpace.length > 0) return colors.success.light;
    return colors.white;
  };

  const getBorderWidth = () => {
    if ((isCurrentPlayerSpace || isValidMoveDestination) && showMovementIndicators) return '4px';
    if (playersOnSpace.length > 0) return '3px';
    return '2px';
  };

  // Removed interactive click handling - this is now purely visual

  return (
    <div
      style={{
        border: `${getBorderWidth()} solid ${getBorderColor()}`,
        borderRadius: '8px',
        padding: '12px',
        margin: '4px',
        background: getBackgroundColor(),
        minHeight: '100px',
        minWidth: '120px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: (isCurrentPlayerSpace || isValidMoveDestination) && showMovementIndicators
          ? `0 6px 16px ${isCurrentPlayerSpace ? colors.primary.main : colors.warning.main}40`
          : playersOnSpace.length > 0 
            ? `0 4px 12px ${colors.success.main}30` 
            : theme.shadows.sm,
        position: 'relative',
        transition: 'all 0.3s ease-in-out',
        cursor: 'default', // Always default cursor - no interaction
        transform: 'scale(1)',
        animation: playersOnSpace.length > 0 ? 'none' : undefined
      }}
    >
      {/* Movement indicator overlay - Visual aid only */}
      {showMovementIndicators && isValidMoveDestination && (
        <div
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            backgroundColor: colors.warning.main,
            color: colors.white,
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: theme.shadows.sm,
            animation: 'pulse 2s infinite',
            pointerEvents: 'none' // Ensure no interaction
          }}
          title="Valid movement destination"
        >
          🎯
        </div>
      )}

      {/* Current player indicator - Visual aid only */}
      {showMovementIndicators && isCurrentPlayerSpace && (
        <div
          style={{
            position: 'absolute',
            top: '4px',
            left: '4px',
            backgroundColor: colors.primary.main,
            color: colors.white,
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: theme.shadows.sm,
            pointerEvents: 'none' // Ensure no interaction
          }}
          title="Current player position"
        >
          📍
        </div>
      )}

      {/* Space name */}
      <div
        style={{
          fontWeight: 'bold',
          fontSize: '14px',
          color: colors.text.primary,
          textAlign: 'center',
          marginBottom: '8px',
          lineHeight: '1.2'
        }}
      >
        {space.name}
      </div>

      {/* Players on this space */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '40px'
        }}
      >
        {playersOnSpace.map((player) => (
          <div
            key={player.id}
            title={player.name}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: player.color || colors.primary.main,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.white,
              fontSize: '16px',
              fontWeight: 'bold',
              border: `2px solid ${colors.white}`,
              boxShadow: theme.shadows.sm,
              // Animation properties
              animation: 'playerTokenAppear 0.5s ease-out',
              transition: 'all 0.3s ease-in-out',
              transform: 'scale(1)',
              zIndex: 1
            }}
            // Add hover effect for interactivity
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.zIndex = '10';
              e.currentTarget.style.boxShadow = theme.shadows.md;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.zIndex = '1';
              e.currentTarget.style.boxShadow = theme.shadows.sm;
            }}
          >
            {player.avatar || player.name.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}