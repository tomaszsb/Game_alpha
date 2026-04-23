// src/components/player/sections/StoryAccordion.tsx
// v2.50.0 — Per-action story accordion for the landing-on-space header.
//
// Replaces the old flat action_description / outcome_description blocks with
// N accordion rows — one per authored SPACE_EFFECTS.narrative. The first
// uncompleted row auto-expands; completed rows collapse with a green ✓;
// auto-triggered L-card rows render pre-collapsed with a "Life event
// happened" label so the player knows something fired without reading
// through it mid-turn.
//
// If NO effect on this space has an authored narrative, the component
// renders null so ActionCenterPanel can fall back to the legacy flat blocks
// while content authoring is in progress.

import React, { useMemo, useState, useEffect } from 'react';
import { IDataService } from '../../../types/ServiceContracts';
import { SpaceEffect, VisitType } from '../../../types/DataTypes';
import { TextWithTerms, useDictionaryPanel } from '../../../dictionary';
import { CHARACTER_MAP, extractPrefix } from '../../../constants/characters';

export interface StoryAccordionProps {
  dataService: IDataService;
  spaceName: string;
  visitType: VisitType;
  completedActions: {
    diceRoll?: string;
    manualActions: { [effectType: string]: string };
  };
  portraitSrc?: string | null;
}

interface AccordionRow {
  id: string;
  effect: SpaceEffect;
  narrative: string;
  label: string;
  icon: string;
  isCompleted: boolean;
  isAutoL: boolean;
  priority: number;
}

// Display order: Expeditor first (push their use), then Work/Money (required),
// then dice/time/money, then Life (auto, mostly informational).
function effectPriority(effect: SpaceEffect): number {
  const action = (effect.effect_action || '').toLowerCase();
  if (effect.effect_type === 'cards') {
    if (action.endsWith('_e')) return 10;
    if (action.endsWith('_w')) return 20;
    if (action.endsWith('_b')) return 30;
    if (action.endsWith('_i')) return 40;
    if (action.endsWith('_l')) return 90;
  }
  if (effect.effect_type === 'dice') return 50;
  if (effect.effect_type === 'money') return 60;
  if (effect.effect_type === 'time') return 70;
  return 80;
}

function effectIcon(effect: SpaceEffect): string {
  const action = (effect.effect_action || '').toLowerCase();
  if (effect.effect_type === 'cards') {
    if (action.endsWith('_e')) return '⚡';
    if (action.endsWith('_w')) return '🔨';
    if (action.endsWith('_b')) return '🏦';
    if (action.endsWith('_i')) return '💼';
    if (action.endsWith('_l')) return '🎲';
  }
  if (effect.effect_type === 'dice') return '🎲';
  if (effect.effect_type === 'money') return '💰';
  if (effect.effect_type === 'time') return '⏱';
  return '📌';
}

function effectLabel(effect: SpaceEffect): string {
  const action = (effect.effect_action || '').toLowerCase();
  if (effect.effect_type === 'cards' && action) {
    const map: Record<string, string> = {
      draw_e: 'Hire Expeditor',
      draw_w: 'Add Work Package',
      draw_b: 'Get Bank Loan',
      draw_i: 'Get Investment',
      draw_l: 'Life Event',
      return_e: 'Return Expeditor',
      replace_e: 'Replace Expeditor',
      give_e: 'Give Expeditor',
    };
    if (map[action]) return map[action];
    return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const typeMap: Record<string, string> = {
    dice: 'Determine Outcome',
    money: 'Funding',
    time: 'Time Cost',
    movement: 'Select Destination',
  };
  return typeMap[effect.effect_type] || effect.effect_type;
}

function isCompletedEffect(
  effect: SpaceEffect,
  completedActions: StoryAccordionProps['completedActions']
): boolean {
  if (effect.effect_type === 'dice') {
    return completedActions.diceRoll !== undefined;
  }
  // Auto-triggered effects fire as soon as the player lands — treat them as
  // already completed so they render pre-collapsed instead of demanding the
  // player's attention.
  if (effect.trigger_type === 'auto') {
    return true;
  }
  const effectKey = effect.effect_action
    ? `${effect.effect_type}:${effect.effect_action}`
    : effect.effect_type;
  const completedKeys = Object.keys(completedActions.manualActions);
  return completedKeys.some(
    (key) =>
      key === effectKey ||
      key.toLowerCase() === effectKey.toLowerCase() ||
      (!!effect.effect_action && key === effect.effect_action) ||
      (!!effect.effect_action && key.toLowerCase() === effect.effect_action.toLowerCase())
  );
}

export function StoryAccordion({
  dataService,
  spaceName,
  visitType,
  completedActions,
  portraitSrc,
}: StoryAccordionProps): JSX.Element | null {
  const { openWithTerm } = useDictionaryPanel();

  const rows = useMemo<AccordionRow[]>(() => {
    if (!spaceName) return [];
    const effects = dataService.getSpaceEffects(spaceName, visitType) || [];
    const built: AccordionRow[] = [];
    for (const effect of effects) {
      const action = effect.effect_action || '';
      const narrative = action
        ? dataService.getEffectNarrative(spaceName, visitType, action) || ''
        : '';
      if (!narrative) continue;
      const isAutoL =
        effect.trigger_type === 'auto' &&
        effect.effect_type === 'cards' &&
        action.toLowerCase().endsWith('_l');
      built.push({
        id: `${effect.effect_type}:${action || '_'}`,
        effect,
        narrative,
        label: effectLabel(effect),
        icon: effectIcon(effect),
        isCompleted: isCompletedEffect(effect, completedActions),
        isAutoL,
        priority: effectPriority(effect),
      });
    }
    built.sort((a, b) => a.priority - b.priority);
    return built;
  }, [dataService, spaceName, visitType, completedActions]);

  const firstUncompletedId = useMemo(
    () => rows.find((r) => !r.isCompleted)?.id,
    [rows]
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    firstUncompletedId ? new Set([firstUncompletedId]) : new Set()
  );

  // Reset expansion when the player lands on a new space / new row becomes the
  // "first uncompleted" — keeps the UX predictable turn-to-turn.
  const rowsKey = rows.map((r) => `${r.id}|${r.isCompleted ? 1 : 0}`).join(',');
  useEffect(() => {
    setExpandedIds(firstUncompletedId ? new Set([firstUncompletedId]) : new Set());
    // rowsKey intentionally captures both row identity and completion state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey, firstUncompletedId]);

  if (rows.length === 0) return null;

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const prefix = extractPrefix(spaceName);
  const npcInfo = prefix ? CHARACTER_MAP[prefix] : undefined;
  const accentColor = npcInfo?.color || '#4caf50';

  return (
    <div className="story-accordion" data-testid="story-accordion">
      {rows.map((row) => {
        const isExpanded = expandedIds.has(row.id);
        const collapsedLabel = row.isAutoL
          ? 'Life event happened — click to read'
          : row.label;
        return (
          <div
            key={row.id}
            className="story-accordion__row"
            data-testid={`story-accordion-row-${row.id}`}
            data-completed={row.isCompleted ? 'true' : 'false'}
            style={{
              borderLeft: `3px solid ${accentColor}`,
              backgroundColor: row.isCompleted ? '#f1f8e9' : '#fafafa',
              borderRadius: '6px',
              marginBottom: '6px',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => toggle(row.id)}
              aria-expanded={isExpanded}
              aria-controls={`story-accordion-content-${row.id}`}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span aria-hidden="true">{row.icon}</span>
                <span style={{ fontWeight: 600, color: '#2c3e50' }}>{collapsedLabel}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {row.isCompleted && (
                  <span
                    aria-label="Completed"
                    title="Completed"
                    style={{ color: '#2e7d32', fontWeight: 700 }}
                  >
                    ✓
                  </span>
                )}
                <span aria-hidden="true" style={{ color: '#888', fontSize: '11px' }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
              </span>
            </button>
            {isExpanded && (
              <div
                id={`story-accordion-content-${row.id}`}
                role="region"
                style={{
                  padding: '10px 12px 12px 44px',
                  fontStyle: 'italic',
                  color: '#555',
                  fontSize: '13px',
                  lineHeight: 1.55,
                  borderTop: '1px dashed #e0e0e0',
                }}
              >
                {portraitSrc && npcInfo && (
                  <img
                    src={portraitSrc}
                    alt={npcInfo.name}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      float: 'left',
                      marginRight: '8px',
                      marginTop: '2px',
                      border: `2px solid ${accentColor}`,
                    }}
                  />
                )}
                <TextWithTerms
                  text={row.narrative}
                  onTermClick={(term) => openWithTerm(term.id)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
