import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';
import { Space, SpaceContent, SpaceEffect, DiceEffect, Player } from '../../types/DataTypes';
import { FormatUtils } from '../../utils/FormatUtils';

interface SpaceDetails {
  space: Space;
  content: SpaceContent | null;
  effects: SpaceEffect[];
  diceEffects: DiceEffect[];
  playersOnSpace: Player[];
  connections: string[];
}

interface SpaceExplorerPanelProps {
  isVisible: boolean;
  onToggle: () => void;
}

/**
 * SpaceExplorerPanel provides detailed information about spaces on the game board
 * Shows space content, effects, connections, and players
 */
export function SpaceExplorerPanel({ 
  isVisible, 
  onToggle 
}: SpaceExplorerPanelProps): JSX.Element {
  const { dataService, stateService, movementService } = useGameContext();
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  const [spaceDetails, setSpaceDetails] = useState<SpaceDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'starting' | 'ending' | 'tutorial'>('all');
  const [players, setPlayers] = useState<Player[]>([]);

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = stateService.subscribe((gameState) => {
      setPlayers(gameState.players);
    });
    
    // Initialize with current state
    setPlayers(stateService.getGameState().players);
    
    return unsubscribe;
  }, [stateService]);

  // Load spaces on mount
  useEffect(() => {
    const spaces = dataService.getAllSpaces();
    setAllSpaces(spaces);

    // Select current player's space by default if available (only on mount)
    const gameState = stateService.getGameState();
    const currentPlayer = gameState.currentPlayerId
      ? gameState.players.find(p => p.id === gameState.currentPlayerId)
      : null;
    if (currentPlayer) {
      setSelectedSpace(currentPlayer.currentSpace);
    }
  }, [dataService, stateService]); // Removed selectedSpace to prevent infinite loop

  // Update space details when selection or players change
  useEffect(() => {
    if (!selectedSpace) {
      setSpaceDetails(null);
      return;
    }

    const space = allSpaces.find(s => s.name === selectedSpace);
    if (!space) {
      setSpaceDetails(null);
      return;
    }

    const content = dataService.getSpaceContent(selectedSpace, 'First');
    const effects = dataService.getSpaceEffects(selectedSpace, 'First');
    const diceEffects = dataService.getDiceEffects(selectedSpace, 'First');
    const playersOnSpace = players.filter(p => p.currentSpace === selectedSpace);

    // Get connections from movement data
    const connections: string[] = [];
    try {
      allSpaces.forEach(otherSpace => {
        const movement = dataService.getMovement(otherSpace.name, 'First');
        if (movement) {
          const destinations = [
            movement.destination_1,
            movement.destination_2,
            movement.destination_3,
            movement.destination_4,
            movement.destination_5
          ].filter(dest => dest && dest === selectedSpace);

          if (destinations.length > 0 && !connections.includes(otherSpace.name)) {
            connections.push(otherSpace.name);
          }
        }
      });
    } catch (error) {
      console.warn('Error loading space connections:', error);
    }

    setSpaceDetails({
      space,
      content: content || null,
      effects,
      diceEffects,
      playersOnSpace,
      connections
    });
  }, [selectedSpace, allSpaces, dataService, players]); // Direct dependencies, no useCallback needed

  const getFilteredSpaces = (): Space[] => {
    let filtered = allSpaces;

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(space => {
        const config = dataService.getGameConfigBySpace(space.name);
        switch (filterType) {
          case 'starting': return config?.is_starting_space === true;
          case 'ending': return config?.is_ending_space === true;
          case 'tutorial': return config?.path_type === 'Tutorial';
          default: return true;
        }
      });
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(space =>
        space.name.toLowerCase().includes(term)
      );
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  };

  const getSpaceTypeIcon = (spaceName: string): string => {
    const config = dataService.getGameConfigBySpace(spaceName);
    if (config?.is_starting_space) return '🏁';
    if (config?.is_ending_space) return '🎯';
    if (config?.path_type === 'Tutorial') return '📚';
    return '📍';
  };

  const getSpaceTypeLabel = (spaceName: string): string => {
    const config = dataService.getGameConfigBySpace(spaceName);
    if (config?.is_starting_space) return 'Starting Space';
    if (config?.is_ending_space) return 'Ending Space';
    if (config?.path_type === 'Tutorial') return 'Tutorial Space';
    return 'Game Space';
  };

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
    left: '20px',
    width: selectedSpace ? '800px' : '400px',
    maxHeight: '85vh',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    zIndex: 900,
    transform: isVisible ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'all 0.3s ease-in-out',
    overflow: 'hidden',
    border: `2px solid ${colors.secondary.border}`,
    display: 'flex',
    flexDirection: 'row'
  };


  const leftPanelStyle: React.CSSProperties = {
    width: '400px',
    display: 'flex',
    flexDirection: 'column',
    borderRight: selectedSpace ? `2px solid ${colors.secondary.border}` : 'none'
  };

  const headerStyle: React.CSSProperties = {
    padding: '16px 20px',
    backgroundColor: colors.secondary.bg,
    borderBottom: `2px solid ${colors.secondary.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const searchStyle: React.CSSProperties = {
    padding: '12px 20px',
    borderBottom: `1px solid ${colors.secondary.border}`,
    backgroundColor: colors.white
  };

  const spaceListStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '8px'
  };

  const spaceItemStyle = (spaceName: string): React.CSSProperties => ({
    padding: '8px 12px',
    margin: '4px 0',
    borderRadius: '6px',
    border: `2px solid ${selectedSpace === spaceName ? colors.success.main : colors.secondary.border}`,
    backgroundColor: selectedSpace === spaceName ? colors.success.light : colors.secondary.bg,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontSize: '14px'
  });

  const rightPanelStyle: React.CSSProperties = {
    width: '400px',
    display: selectedSpace ? 'flex' : 'none',
    flexDirection: 'column',
    backgroundColor: colors.secondary.light
  };

  const detailsHeaderStyle: React.CSSProperties = {
    padding: '16px 20px',
    backgroundColor: colors.primary.light,
    borderBottom: `2px solid ${colors.primary.main}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const detailsContentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px'
  };

  return (
    <>
      {/* Space Explorer Panel */}
      <div style={containerStyle}>
        {/* Left Panel - Space List */}
        <div style={leftPanelStyle}>
          <div style={headerStyle}>
            <h3 style={{ 
              margin: 0, 
              fontSize: '18px', 
              fontWeight: 'bold',
              color: colors.text.primary
            }}>
              Space Explorer
            </h3>
            <button
              onClick={onToggle}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: colors.secondary.main
              }}
              title="Close Space Explorer"
            >
              ✕
            </button>
          </div>

          {/* Search and Filter */}
          <div style={searchStyle}>
            <input
              type="text"
              placeholder="Search spaces..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: `2px solid ${colors.secondary.border}`,
                borderRadius: '6px',
                fontSize: '14px',
                marginBottom: '8px'
              }}
            />
            
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['all', 'starting', 'ending', 'tutorial'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  style={{
                    padding: '4px 8px',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: filterType === type ? colors.success.main : colors.secondary.light,
                    color: filterType === type ? 'white' : colors.secondary.main
                  }}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Space List */}
          <div style={spaceListStyle}>
            {getFilteredSpaces().map(space => (
              <div
                key={space.name}
                style={spaceItemStyle(space.name)}
                onClick={() => setSelectedSpace(space.name)}
                onMouseEnter={(e) => {
                  if (selectedSpace !== space.name) {
                    e.currentTarget.style.backgroundColor = colors.primary.light;
                    e.currentTarget.style.borderColor = colors.primary.main;
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedSpace !== space.name) {
                    e.currentTarget.style.backgroundColor = colors.secondary.bg;
                    e.currentTarget.style.borderColor = colors.secondary.border;
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>
                    {getSpaceTypeIcon(space.name)}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: colors.text.primary }}>
                      {space.name}
                    </div>
                    <div style={{ fontSize: '12px', color: colors.secondary.main }}>
                      {getSpaceTypeLabel(space.name)}
                    </div>
                  </div>
                  {players.filter(p => p.currentSpace === space.name).length > 0 && (
                    <span style={{ 
                      backgroundColor: colors.success.main, 
                      color: 'white', 
                      borderRadius: '10px',
                      padding: '2px 6px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {players.filter(p => p.currentSpace === space.name).length}
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            {getFilteredSpaces().length === 0 && (
              <div style={{
                textAlign: 'center',
                color: colors.secondary.main,
                padding: '20px',
                fontStyle: 'italic'
              }}>
                No spaces found matching your criteria
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Space Details */}
        {spaceDetails && (
          <div style={rightPanelStyle}>
            <div style={detailsHeaderStyle}>
              <h4 style={{ 
                margin: 0,
                color: colors.primary.text,
                fontSize: '16px',
                fontWeight: 'bold'
              }}>
                {spaceDetails.space.name}
              </h4>
              <button
                onClick={() => setSelectedSpace(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: colors.primary.text
                }}
                title="Back to space list"
              >
                ←
              </button>
            </div>

            <div style={detailsContentStyle}>
              {/* Space Type and Configuration */}
              <div style={{
                padding: '12px',
                backgroundColor: colors.primary.light,
                borderRadius: '8px',
                marginBottom: '16px',
                border: `2px solid ${colors.primary.main}`
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  marginBottom: '8px' 
                }}>
                  <span style={{ fontSize: '20px' }}>
                    {getSpaceTypeIcon(spaceDetails.space.name)}
                  </span>
                  <span style={{ fontWeight: 'bold', color: colors.primary.text, fontSize: '16px' }}>
                    {getSpaceTypeLabel(spaceDetails.space.name)}
                  </span>
                </div>
                
                {/* Game Configuration Data */}
                {(() => {
                  const config = dataService.getGameConfigBySpace(spaceDetails.space.name);
                  if (config) {
                    return (
                      <div style={{ fontSize: '13px', color: colors.primary.text }}>
                        {config.game_phase && <div><strong>Game Phase:</strong> {config.game_phase}</div>}
                        {config.path_type && <div><strong>Path Type:</strong> {config.path_type}</div>}
                        {config.space_order !== undefined && <div><strong>Space Order:</strong> {config.space_order}</div>}
                        {config.tutorial_step && <div><strong>Tutorial Step:</strong> {config.tutorial_step}</div>}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Players on Space */}
              {spaceDetails.playersOnSpace.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h5 style={{ 
                    fontSize: '14px', 
                    fontWeight: 'bold',
                    color: colors.text.primary,
                    margin: '0 0 8px 0'
                  }}>
                    👥 Players Currently Here ({spaceDetails.playersOnSpace.length}):
                  </h5>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {spaceDetails.playersOnSpace.map(player => (
                      <div
                        key={player.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          backgroundColor: player.color || colors.primary.main,
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: 'bold'
                        }}
                      >
                        <span>{player.avatar || player.name.charAt(0).toUpperCase()}</span>
                        <div>
                          <div>{player.name}</div>
                          <div style={{ fontSize: '11px', opacity: 0.8 }}>
                            💰${FormatUtils.formatMoney(player.money)} | ⏱️{player.timeSpent}d
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Space Content */}
              {spaceDetails.content && (
                <div style={{ marginBottom: '16px' }}>
                  <h5 style={{ 
                    fontSize: '14px', 
                    fontWeight: 'bold',
                    color: colors.text.primary,
                    margin: '0 0 8px 0'
                  }}>
                    📄 Space Content & Story:
                  </h5>
                  <div style={{
                    padding: '12px',
                    backgroundColor: colors.warning.bg,
                    borderRadius: '8px',
                    border: `2px solid ${colors.warning.main}`,
                    fontSize: '13px',
                    lineHeight: '1.5'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', color: colors.warning.text }}>
                      Story Text:
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      {spaceDetails.content.story || 'No story content available'}
                    </div>

                    {/* Action Description */}
                    {spaceDetails.content.action_description && (
                      <>
                        <div style={{ fontWeight: 'bold', marginBottom: '8px', marginTop: '12px', color: colors.danger.text }}>
                          Action Required:
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                          {spaceDetails.content.action_description}
                        </div>
                      </>
                    )}

                    {/* Outcome Description */}
                    {spaceDetails.content.outcome_description && (
                      <>
                        <div style={{ fontWeight: 'bold', marginBottom: '8px', marginTop: '12px', color: colors.success.text }}>
                          Potential Outcomes:
                        </div>
                        <div>
                          {spaceDetails.content.outcome_description}
                        </div>
                      </>
                    )}

                    {/* Additional Content Properties */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                      {spaceDetails.content.can_negotiate && (
                        <div style={{ color: colors.success.main, fontWeight: 'bold' }}>
                          💬 Negotiation: Available
                        </div>
                      )}
                      {spaceDetails.content.requires_choice && (
                        <div style={{ color: colors.danger.main, fontWeight: 'bold' }}>
                          🎯 Choice Required
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Movement Options */}
              {(() => {
                const movement = dataService.getMovement(spaceDetails.space.name, 'First');
                if (movement) {
                  const destinations = [
                    movement.destination_1,
                    movement.destination_2,
                    movement.destination_3,
                    movement.destination_4,
                    movement.destination_5
                  ].filter(dest => dest && dest.trim());
                  
                  if (destinations.length > 0) {
                    return (
                      <div style={{ marginBottom: '16px' }}>
                        <h5 style={{ 
                          fontSize: '14px', 
                          fontWeight: 'bold',
                          color: colors.text.primary,
                          margin: '0 0 8px 0'
                        }}>
                          🧭 Movement Options ({movement.movement_type}):
                        </h5>
                        <div style={{
                          padding: '12px',
                          backgroundColor: colors.secondary.bg,
                          borderRadius: '8px',
                          border: `2px solid ${colors.secondary.border}`
                        }}>
                          <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                            Movement Type: {movement.movement_type} 
                            {movement.movement_type === 'dice' && ' 🎲'}
                            {movement.movement_type === 'choice' && ' 🎯'}
                            {movement.movement_type === 'fixed' && ' ➡️'}
                          </div>
                          
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {destinations.map((dest, index) => (
                              <button
                                key={index}
                                onClick={() => setSelectedSpace(dest || null)}
                                style={{
                                  padding: '6px 10px',
                                  backgroundColor: colors.primary.main,
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                                title={`Click to view ${dest}`}
                              >
                                {dest}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }
                }
                return null;
              })()}

              {/* Space Effects */}
              {spaceDetails.effects.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h5 style={{ 
                    fontSize: '14px', 
                    fontWeight: 'bold',
                    color: colors.text.primary,
                    margin: '0 0 8px 0'
                  }}>
                    ⚡ Space Effects ({spaceDetails.effects.length}):
                  </h5>
                  {spaceDetails.effects.map((effect, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: colors.warning.bg,
                        borderRadius: '8px',
                        border: `2px solid ${colors.warning.main}`,
                        marginBottom: '8px',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ fontWeight: 'bold', color: colors.warning.text, marginBottom: '4px' }}>
                        {effect.effect_type}: {effect.effect_action} {effect.effect_value}
                        {effect.trigger_type && ` (${effect.trigger_type})`}
                      </div>
                      {effect.description && (
                        <div style={{ color: colors.warning.text }}>
                          {effect.description}
                        </div>
                      )}
                      {effect.condition && (
                        <div style={{ fontSize: '12px', color: colors.secondary.main, marginTop: '4px' }}>
                          <strong>Condition:</strong> {effect.condition}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Dice Effects */}
              {spaceDetails.diceEffects.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h5 style={{ 
                    fontSize: '14px', 
                    fontWeight: 'bold',
                    color: colors.text.primary,
                    margin: '0 0 8px 0'
                  }}>
                    🎲 Dice Roll Effects ({spaceDetails.diceEffects.length}):
                  </h5>
                  {spaceDetails.diceEffects.map((effect, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: colors.info.bg,
                        borderRadius: '8px',
                        border: `2px solid ${colors.primary.main}`,
                        marginBottom: '8px',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ fontWeight: 'bold', color: colors.primary.dark, marginBottom: '4px' }}>
                        Roll {effect.roll_1}{effect.roll_2 && `, ${effect.roll_2}`}: 
                        {effect.effect_type} {effect.effect_action} {effect.effect_value}
                      </div>
                      {effect.description && (
                        <div style={{ color: colors.primary.dark }}>
                          {effect.description}
                        </div>
                      )}
                      {effect.condition && (
                        <div style={{ fontSize: '12px', color: colors.secondary.main, marginTop: '4px' }}>
                          <strong>Condition:</strong> {effect.condition}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Connected Spaces */}
              {spaceDetails.connections.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h5 style={{ 
                    fontSize: '14px', 
                    fontWeight: 'bold',
                    color: colors.text.primary,
                    margin: '0 0 8px 0'
                  }}>
                    🔗 Incoming Connections ({spaceDetails.connections.length}):
                  </h5>
                  <div style={{
                    padding: '12px',
                    backgroundColor: colors.secondary.bg,
                    borderRadius: '8px',
                    border: `2px solid ${colors.secondary.border}`
                  }}>
                    <div style={{ fontSize: '12px', color: colors.secondary.main, marginBottom: '8px' }}>
                      Spaces that can move to this location:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {spaceDetails.connections.map(connection => (
                        <button
                          key={connection}
                          onClick={() => setSelectedSpace(connection)}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: colors.success.main,
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                          title={`Click to view ${connection}`}
                        >
                          {connection}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Raw CSV Data Section */}
              <div style={{ marginBottom: '16px' }}>
                <h5 style={{ 
                  fontSize: '14px', 
                  fontWeight: 'bold',
                  color: colors.text.primary,
                  margin: '0 0 8px 0'
                }}>
                  📊 Technical Details:
                </h5>
                <div style={{
                  padding: '12px',
                  backgroundColor: colors.background.muted,
                  borderRadius: '8px',
                  border: `2px solid ${colors.border.dark}`,
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>
                  <div><strong>Space ID:</strong> {spaceDetails.space.name}</div>
                  <div><strong>Effects Count:</strong> {spaceDetails.effects.length} space + {spaceDetails.diceEffects.length} dice</div>
                  <div><strong>Movement Destinations:</strong> {(() => {
                    const movement = dataService.getMovement(spaceDetails.space.name, 'First');
                    return movement ? [movement.destination_1, movement.destination_2, movement.destination_3, movement.destination_4, movement.destination_5].filter(d => d).length : 0;
                  })()}</div>
                  <div><strong>Negotiation:</strong> {spaceDetails.content?.can_negotiate ? 'Yes' : 'No'}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}