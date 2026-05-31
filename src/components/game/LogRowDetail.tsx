import React from 'react';
import { ActionLogEntry } from '../../types/StateTypes';
import { useGameContext } from '../../context/GameContext';
import { colors } from '../../styles/theme';

interface LogRowDetailProps {
  entry: ActionLogEntry;
}

interface DetailRow {
  label: string;
  value: string;
}

export const LogRowDetail: React.FC<LogRowDetailProps> = ({ entry }) => {
  const { dataService } = useGameContext();
  const details = (entry.details ?? {}) as Record<string, unknown>;
  const rows: DetailRow[] = [];

  // Raw description as the producer wrote it. May differ from the friendly
  // displayed version when a future formatting pass rewrites the surface text.
  if (entry.description) {
    rows.push({ label: 'Raw', value: entry.description });
  }

  // Space ID (the engine ID, not the friendly name)
  const spaceName = typeof details.spaceName === 'string' ? details.spaceName : '';
  if (spaceName) {
    rows.push({ label: 'Space ID', value: spaceName });
  }

  // Movement: source → destination raw IDs
  const sourceSpace = typeof details.sourceSpace === 'string' ? details.sourceSpace : '';
  const destinationSpace = typeof details.destinationSpace === 'string' ? details.destinationSpace : '';
  if (sourceSpace || destinationSpace) {
    rows.push({ label: 'From → To', value: `${sourceSpace || '?'} → ${destinationSpace || '?'}` });
  }

  // Card details: raw IDs + full untruncated titles
  const cardIds = Array.isArray(details.cards)
    ? (details.cards as unknown[]).filter((c): c is string => typeof c === 'string')
    : [];
  if (cardIds.length > 0) {
    rows.push({ label: 'Card IDs', value: cardIds.join(', ') });
    // Only add the full-titles row if dataService actually resolved at least
    // one title — otherwise it duplicates the Card IDs row above.
    const resolvedTitles = cardIds.map(id => dataService.getCardById(id)?.card_name);
    if (resolvedTitles.some(t => t)) {
      const fullTitles = cardIds
        .map((id, i) => resolvedTitles[i] ?? id)
        .join(', ');
      rows.push({ label: 'Card titles (full)', value: fullTitles });
    }
  }

  // Source identifier (e.g., "space:OWNER-SCOPE-INITIATION", "dice:...")
  if (typeof details.source === 'string') {
    rows.push({ label: 'Source', value: details.source });
  }

  // Action category as the producer tagged it
  if (typeof details.action === 'string') {
    rows.push({ label: 'Action', value: details.action });
  }

  // Entry type discriminant
  rows.push({ label: 'Type', value: entry.type });

  // Full timestamp with seconds (compact view only shows hours:minutes)
  const ts = entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp);
  rows.push({
    label: 'When',
    value: ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  });

  // Turn context
  rows.push({
    label: 'Turn',
    value: `round ${entry.gameRound} · turn ${entry.globalTurnNumber} · ${entry.playerName}'s turn ${entry.playerTurnNumber}`,
  });

  return (
    <div
      data-testid="log-row-detail"
      style={{
        marginTop: '4px',
        padding: '6px 10px',
        backgroundColor: colors.white,
        border: `1px dashed ${colors.secondary.border}`,
        borderRadius: '4px',
        fontSize: '10px',
        lineHeight: '1.5',
        color: colors.text.secondary,
        fontFamily: 'monospace',
      }}
    >
      {rows.map(({ label, value }) => (
        <div key={label} style={{ display: 'flex', gap: '8px' }}>
          <span style={{ fontWeight: 'bold', color: colors.secondary.dark, flexShrink: 0, minWidth: '110px' }}>
            {label}:
          </span>
          <span style={{ wordBreak: 'break-word' }}>{value}</span>
        </div>
      ))}
    </div>
  );
};
