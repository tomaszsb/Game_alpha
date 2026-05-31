import React, { useState, useEffect, useRef, useMemo } from 'react';
import { IServiceContainer } from '../../../types/ServiceContracts';
import { ActionLogEntry } from '../../../types/StateTypes';
import { formatActionDescription } from '../../../utils/actionLogFormatting';
import { LogRowDetail } from '../../game/LogRowDetail';

interface PlayerLogSectionProps {
  gameServices: IServiceContainer;
  playerId: string;
}

export const PlayerLogSection: React.FC<PlayerLogSectionProps> = ({ gameServices, playerId }) => {
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // fb:91738221 v3.0.45 — per-row expand for raw detail.
  const [expandedRows, setExpandedRows] = useState<{ [rowKey: string]: boolean }>({});
  const toggleRow = (rowKey: string) => {
    setExpandedRows(prev => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };

  useEffect(() => {
    const unsubscribe = gameServices.stateService.subscribe((gameState) => {
      const playerLogs = gameState.globalActionLog.filter(
        entry => entry.playerId === playerId && entry.isCommitted && entry.visibility === 'player'
      );
      setActionLog(playerLogs);
    });

    const gameState = gameServices.stateService.getGameState();
    const playerLogs = gameState.globalActionLog.filter(
      entry => entry.playerId === playerId && entry.isCommitted && entry.visibility === 'player'
    );
    setActionLog(playerLogs);

    return unsubscribe;
  }, [gameServices.stateService, playerId]);

  // Group by space visits
  const spaceGroups = useMemo(() => {
    const sorted = [...actionLog].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const groups: { spaceName: string; entries: ActionLogEntry[] }[] = [];
    let currentSpace: string | null = null;
    let currentEntries: ActionLogEntry[] = [];

    for (const entry of sorted) {
      const spaceName = entry.details?.spaceName || entry.details?.space || 'Unknown';

      if (entry.type === 'turn_start' && spaceName !== currentSpace) {
        if (currentSpace !== null && currentEntries.length > 0) {
          groups.push({ spaceName: currentSpace, entries: [...currentEntries] });
        }
        currentSpace = spaceName;
        currentEntries = [entry];
      } else {
        currentEntries.push(entry);
      }
    }

    if (currentSpace !== null && currentEntries.length > 0) {
      groups.push({ spaceName: currentSpace, entries: currentEntries });
    }

    return groups;
  }, [actionLog]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [spaceGroups]);

  const formatTimestamp = (timestamp: Date): string => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (actionLog.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#999', fontStyle: 'italic', padding: '20px' }}>
        No actions yet. Start playing to see your log!
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      style={{
        maxHeight: '300px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}
    >
      {spaceGroups.map((group, groupIndex) => (
        <div key={groupIndex} style={{ marginBottom: '4px' }}>
          <div style={{
            padding: '4px 8px',
            backgroundColor: '#e3f2fd',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            color: '#1565c0',
            marginBottom: '2px'
          }}>
            📍 {group.spaceName}
          </div>
          {group.entries
            .filter(entry => entry.type !== 'turn_start')
            .map((entry, entryIndex) => {
              const rowKey = `${groupIndex}-${entryIndex}`;
              const isExpanded = expandedRows[rowKey] || false;
              return (
                <div
                  key={rowKey}
                  style={{
                    padding: '3px 8px 3px 16px',
                    fontSize: '11px',
                    color: '#495057',
                    borderLeft: '3px solid #e0e0e0',
                    marginLeft: '4px',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleRow(rowKey)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ fontSize: '9px', color: '#999', userSelect: 'none' }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <span>{formatActionDescription(entry)}</span>
                    </span>
                    <span style={{ color: '#999', fontSize: '9px', whiteSpace: 'nowrap' }}>
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                  {isExpanded && <LogRowDetail entry={entry} />}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
};
