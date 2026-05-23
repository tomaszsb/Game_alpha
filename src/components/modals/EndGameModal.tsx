// src/components/modals/EndGameModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { colors, theme } from '../../styles/theme';
import { useGameContext } from '../../context/GameContext';
import { Player, VisitType } from '../../types/DataTypes';
import { interpolateTemplate } from '../../utils/templateInterpolation';
import { buildEndGameStats, formatMoney, formatPercent, formatDays, EndGameStats } from '../../utils/endGameStats';
import { buildEndGameInsights, Insight, InsightTone } from '../../utils/endGameInsights';
import { shortName } from '../../utils/boardCommon';

interface EndGamePenaltyView {
  dobMissing: boolean;
  days: number;
  fee: number;
}

export function EndGameModal(): JSX.Element {
  const { stateService, dataService, gameRulesService } = useGameContext();
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [winnerName, setWinnerName] = useState<string>('');
  const [winnerSpace, setWinnerSpace] = useState<string>('');
  const [winnerVisitType, setWinnerVisitType] = useState<VisitType>('First');
  const [gameEndTime, setGameEndTime] = useState<Date | undefined>();
  const [penalty, setPenalty] = useState<EndGamePenaltyView | null>(null);
  const [winnerPlayer, setWinnerPlayer] = useState<Player | null>(null);
  // fb:cc345da9 + fb:3483b37b — collapsible journey list. Defaults closed so
  // the panel isn't dominated by a 20-row movement log; one click reveals it.
  const [journeyOpen, setJourneyOpen] = useState<boolean>(false);

  // Subscribe to state changes to show/hide modal
  useEffect(() => {
    const syncFromState = (gameState: ReturnType<typeof stateService.getGameState>) => {
      setIsGameOver(gameState.isGameOver);

      if (gameState.isGameOver && gameState.winner) {
        const winner = gameState.players.find(p => p.id === gameState.winner);
        setWinnerPlayer(winner || null);
        setWinnerName(winner?.name || 'Unknown Player');
        setWinnerSpace(winner?.currentSpace || '');
        setWinnerVisitType(winner?.visitType || 'First');
        setGameEndTime(gameState.gameEndTime);
        // Workstream 7 Phase 7.4 — render the missing-DOB penalty section
        // when present. Only set if the penalty belongs to this winner (it
        // always should, but defensive in case future phases credit other
        // players).
        if (gameState.endGamePenalty && gameState.endGamePenalty.playerId === gameState.winner) {
          setPenalty({
            dobMissing: gameState.endGamePenalty.dobMissing,
            days: gameState.endGamePenalty.days,
            fee: gameState.endGamePenalty.fee,
          });
        } else {
          setPenalty(null);
        }
      }
    };

    const unsubscribe = stateService.subscribe(syncFromState);
    syncFromState(stateService.getGameState());

    return unsubscribe;
  }, [stateService]);

  const handlePlayAgain = () => {
    // Navigate to root landing page instead of resetting in-place
    window.location.href = window.location.origin + window.location.pathname;
  };

  // Per-space ModalConfig overrides keyed by `${winnerSpace}|${winnerVisitType}|end_game`.
  // Lets creators theme the end-of-game celebration per FINISH space (e.g., different
  // victory flavor at CON-END vs REG-END vs PM-END).
  const endGameModalConfig = winnerSpace
    ? dataService.getModalConfig(winnerSpace, winnerVisitType, 'end_game')
    : undefined;

  const templateContext: Record<string, string | number | undefined> = {
    spaceName: winnerSpace,
    winnerName,
    playerName: winnerName,
  };
  const customTitle = endGameModalConfig?.modal_title
    ? interpolateTemplate(endGameModalConfig.modal_title, templateContext)
    : undefined;
  const customDescription = endGameModalConfig?.modal_description
    ? interpolateTemplate(endGameModalConfig.modal_description, templateContext)
    : undefined;
  const customButtonLabel = endGameModalConfig?.modal_button_label
    ? interpolateTemplate(endGameModalConfig.modal_button_label, templateContext)
    : undefined;
  const customSummary = endGameModalConfig?.modal_summary
    ? interpolateTemplate(endGameModalConfig.modal_summary, templateContext)
    : undefined;

  // fb:cc345da9 + fb:3483b37b — compute the end-game stats block.
  // Pure helper; only depends on the post-win Player snapshot plus the
  // injected projectScope (which needs the service). Recomputed only when
  // the winner changes, not on every render.
  const stats: EndGameStats | null = useMemo(() => {
    if (!winnerPlayer) return null;
    const projectScope = gameRulesService.calculateProjectScope(winnerPlayer.id);
    return buildEndGameStats(winnerPlayer, { projectScope });
  }, [winnerPlayer, gameRulesService]);

  // v3.0.13 — Project Debrief: pure-helper insights derived from the same stats
  // snapshot. Capped at 5 so we celebrate, not lecture.
  const insights: Insight[] = useMemo(() => {
    if (!winnerPlayer || !stats) return [];
    return buildEndGameInsights(stats, winnerPlayer, { maxInsights: 5 });
  }, [winnerPlayer, stats]);

  const footer = (
    <button
      onClick={handlePlayAgain}
      style={{
        ...modalButtonStyles.primary,
        backgroundColor: colors.primary.main,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = colors.primary.dark;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = colors.primary.main;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {customButtonLabel || `${theme.emoji.dice} Play Again`}
    </button>
  );

  return (
    <ModalBase
      isOpen={isGameOver && !!winnerName}
      onClose={handlePlayAgain}
      title={customTitle || 'Game Complete!'}
      emoji={theme.emoji.celebration}
      maxWidth="600px"
      headerColor={colors.success.light}
      headerBorderColor={colors.success.main}
      footer={footer}
      testId="end-game-modal"
    >
      <div style={{ textAlign: 'center' }}>
        {/* Celebration Icon */}
        <div style={{ fontSize: '80px', marginBottom: '20px' }}>
          {theme.emoji.celebration}
        </div>

        {/* Winner Announcement */}
        <h2 style={{
          margin: '0 0 10px 0',
          color: colors.success.main,
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
          {theme.emoji.trophy} Congratulations {winnerName}!
        </h2>
        <p style={{
          margin: '0 0 24px 0',
          color: colors.text.secondary,
          fontSize: '18px'
        }}>
          {customDescription || 'You have successfully reached an ending space and won the game!'}
        </p>

        {/* fb:cc345da9 + fb:3483b37b — comprehensive end-game stats panel.
            Replaces the bare timestamp that was the only "stat" the playtester
            could see at the end. */}
        {stats && (
          <EndGameStatsPanel
            stats={stats}
            gameEndTime={gameEndTime}
            journeyOpen={journeyOpen}
            onToggleJourney={() => setJourneyOpen(o => !o)}
          />
        )}

        {/* v3.0.13 — Project Debrief: plain-English insights distilled from
            the stats. Wins, observations, lessons — color coded. Renders only
            if at least one rule matched. */}
        {insights.length > 0 && <ProjectDebrief insights={insights} />}

        {/* Workstream 7 Phase 7.4 — Missing-DOB penalty section.
            Rendered above the celebration banner so the player sees the cost
            before being congratulated. Plain-language framing ("emergency
            processing fee", "your CO came late") aligned with the NPC voice. */}
        {penalty && penalty.dobMissing && (
          <div
            data-testid="end-game-penalty"
            style={{
              marginBottom: '20px',
              padding: '16px 20px',
              backgroundColor: '#fff3cd',
              borderRadius: theme.borderRadius.lg,
              border: '2px solid #ffc107',
              textAlign: 'left',
            }}
          >
            <h3 style={{
              margin: '0 0 8px 0',
              color: '#856404',
              fontSize: '16px',
              fontWeight: 'bold',
            }}>
              ⚠️ DOB never signed off
            </h3>
            <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#856404' }}>
              Your CO came late and cost the owner. Emergency processing added <strong>+{penalty.days} days</strong> and a <strong>${penalty.fee.toLocaleString()}</strong> fee to your final stats.
            </p>
            <p style={{ margin: '0', fontSize: '12px', color: '#856404', fontStyle: 'italic' }}>
              Next game: secure DOB plan-exam approval before pushing for CO.
            </p>
          </div>
        )}

        {/* Celebration Message */}
        <div style={{
          padding: '20px',
          backgroundColor: colors.success.light,
          borderRadius: theme.borderRadius.lg,
          border: `2px solid ${colors.success.border}`
        }}>
          <p style={{
            margin: '0',
            fontSize: '16px',
            color: colors.success.darker,
            fontWeight: '500'
          }}>
            {theme.emoji.celebration} {customSummary || "Well played! You've mastered the game and reached your destination successfully!"}
          </p>
        </div>
      </div>
    </ModalBase>
  );
}

// ============================================================================
// Stats panel — fb:cc345da9 + fb:3483b37b
// ============================================================================

interface EndGameStatsPanelProps {
  stats: EndGameStats;
  gameEndTime?: Date;
  journeyOpen: boolean;
  onToggleJourney: () => void;
}

function EndGameStatsPanel({ stats, gameEndTime, journeyOpen, onToggleJourney }: EndGameStatsPanelProps): JSX.Element {
  const sectionStyle: React.CSSProperties = {
    marginBottom: '12px',
    padding: '14px 16px',
    backgroundColor: '#f8f9fa',
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${colors.secondary.light}`,
    textAlign: 'left',
  };

  const sectionTitleStyle: React.CSSProperties = {
    margin: '0 0 8px 0',
    color: '#212529',
    fontSize: '15px',
    fontWeight: 700,
    letterSpacing: '0.2px',
  };

  return (
    <div data-testid="end-game-stats" style={{ textAlign: 'left', marginBottom: '20px' }}>

      {/* Headline numbers — the four things the user said matter most */}
      <div style={{ ...sectionStyle, backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
        <h3 style={{ ...sectionTitleStyle, color: '#1e40af' }}>📊 Project Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '14px' }}>
          <Stat label="🏗️ Project scope" value={formatMoney(stats.projectScope)} testid="stat-scope" />
          <Stat label="💸 Total spent" value={formatMoney(stats.totalSpent)} testid="stat-spent" />
          <Stat label="⏱️ Total days" value={formatDays(stats.daysTotal)} testid="stat-days" />
          <Stat label="🔄 Turns taken" value={String(stats.turnsTaken)} testid="stat-turns" />
          <Stat label="🎯 Final score" value={stats.finalScore.toLocaleString()} testid="stat-score" />
          <Stat label="🃏 Work cards" value={String(stats.construction.workCardCount)} testid="stat-workcards" />
        </div>
      </div>

      {/* Fees breakdown */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>💵 Fees Paid <span style={{ fontWeight: 400, color: '#6c757d', fontSize: '13px' }}>(total {formatMoney(stats.feesBreakdown.totalFees)})</span></h3>
        <FeeRow label="Architect" value={stats.feesBreakdown.architectural} total={stats.feesBreakdown.totalFees} />
        <FeeRow label="Engineer" value={stats.feesBreakdown.engineering} total={stats.feesBreakdown.totalFees} />
        <FeeRow label="Regulatory" value={stats.feesBreakdown.regulatory} total={stats.feesBreakdown.totalFees} />
        <FeeRow label="Expeditors" value={stats.feesBreakdown.expeditor} total={stats.feesBreakdown.totalFees} />
        <FeeRow label="Investment fees" value={stats.feesBreakdown.investmentFee} total={stats.feesBreakdown.totalFees} />
        <FeeRow label="Miscellaneous" value={stats.feesBreakdown.miscellaneous} total={stats.feesBreakdown.totalFees} />
      </div>

      {/* Funding mix */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>💰 Funding Sources <span style={{ fontWeight: 400, color: '#6c757d', fontSize: '13px' }}>(total {formatMoney(stats.fundingMix.total)})</span></h3>
        <FeeRow label="Owner" value={stats.fundingMix.owner} total={stats.fundingMix.total} />
        <FeeRow label="Bank loans" value={stats.fundingMix.bank} total={stats.fundingMix.total} />
        <FeeRow label="Investors" value={stats.fundingMix.investor} total={stats.fundingMix.total} />
        {stats.fundingMix.other > 0 && (
          <FeeRow label="Other" value={stats.fundingMix.other} total={stats.fundingMix.total} />
        )}
      </div>

      {/* Approvals + contractor */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>✅ Approvals & Construction</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: '14px' }}>
          <Stat label="DOB" value={approvalLabel(stats.approvals.dob)} testid="stat-dob" />
          <Stat label="FDNY" value={approvalLabel(stats.approvals.fdny)} testid="stat-fdny" />
          {stats.construction.contractorQuality && (
            <Stat
              label="Contractor"
              value={`${qualityLabel(stats.construction.contractorQuality)}${stats.construction.contractorMultiplier ? ` · ${stats.construction.contractorMultiplier}× cost` : ''}`}
              testid="stat-contractor"
            />
          )}
        </div>
      </div>

      {/* Movement log — collapsible. Default closed because long. */}
      {stats.journey.length > 0 && (
        <div style={sectionStyle}>
          <button
            type="button"
            onClick={onToggleJourney}
            data-testid="end-game-journey-toggle"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              margin: 0,
              width: '100%',
              textAlign: 'left',
              color: '#212529',
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '0.2px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{journeyOpen ? '▼' : '▶'}</span>
            <span>🗺️ Journey ({stats.journey.length} {stats.journey.length === 1 ? 'stop' : 'stops'})</span>
          </button>
          {journeyOpen && (
            <ol data-testid="end-game-journey-list" style={{ margin: '8px 0 0 0', padding: '0 0 0 20px', maxHeight: '240px', overflowY: 'auto', fontSize: '13px', color: '#495057', lineHeight: 1.6 }}>
              {stats.journey.map((step, i) => (
                <li key={`${i}-${step.spaceName}`}>
                  <span style={{ fontWeight: 600 }}>{shortName(step.spaceName)}</span>
                  <span style={{ color: '#adb5bd' }}> — {formatDays(step.daysSpent)} · turn {step.entryTurn}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Timestamp footer (preserved from old panel) */}
      {gameEndTime && (
        <div style={{ marginTop: '4px', fontSize: '12px', color: '#adb5bd', textAlign: 'center' }}>
          Game completed at {gameEndTime.toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Project Debrief — v3.0.13. Plain-English insights distilled from the stats.
// ============================================================================

interface ProjectDebriefProps {
  insights: Insight[];
}

function ProjectDebrief({ insights }: ProjectDebriefProps): JSX.Element {
  return (
    <div
      data-testid="project-debrief"
      style={{
        marginBottom: '20px',
        padding: '16px 18px',
        backgroundColor: '#fffbeb',
        borderRadius: theme.borderRadius.lg,
        border: '1px solid #fde68a',
        textAlign: 'left',
      }}
    >
      <h3
        style={{
          margin: '0 0 10px 0',
          color: '#92400e',
          fontSize: '15px',
          fontWeight: 700,
          letterSpacing: '0.2px',
        }}
      >
        🎓 Project Debrief
      </h3>
      <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#a16207', fontStyle: 'italic' }}>
        A few observations distilled from your playthrough.
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {insights.map((insight) => (
          <InsightRow key={insight.id} insight={insight} />
        ))}
      </ul>
    </div>
  );
}

interface InsightRowProps {
  insight: Insight;
}

function InsightRow({ insight }: InsightRowProps): JSX.Element {
  const palette = toneStyle(insight.tone);
  return (
    <li
      data-testid={`debrief-${insight.id}`}
      data-tone={insight.tone}
      style={{
        padding: '8px 12px',
        backgroundColor: palette.bg,
        border: `1px solid ${palette.border}`,
        borderLeft: `4px solid ${palette.accent}`,
        borderRadius: 6,
        fontSize: '13px',
        color: palette.text,
        lineHeight: 1.4,
      }}
    >
      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
        <span aria-hidden style={{ fontSize: '14px' }}>{palette.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{insight.headline}</div>
          {insight.detail && (
            <div style={{ marginTop: 2, color: palette.detail, fontWeight: 400 }}>{insight.detail}</div>
          )}
        </div>
      </div>
    </li>
  );
}

function toneStyle(tone: InsightTone) {
  switch (tone) {
    case 'win':
      return {
        icon: '🏆', bg: '#ecfdf5', border: '#a7f3d0', accent: '#10b981',
        text: '#065f46', detail: '#047857',
      };
    case 'lesson':
      return {
        icon: '💡', bg: '#fef2f2', border: '#fecaca', accent: '#dc2626',
        text: '#7f1d1d', detail: '#991b1b',
      };
    case 'observe':
    default:
      return {
        icon: '📝', bg: '#eff6ff', border: '#bfdbfe', accent: '#3b82f6',
        text: '#1e3a8a', detail: '#1e40af',
      };
  }
}

interface StatProps {
  label: string;
  value: string;
  testid?: string;
}
function Stat({ label, value, testid }: StatProps): JSX.Element {
  return (
    <div data-testid={testid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
      <span style={{ color: '#495057' }}>{label}</span>
      <strong style={{ color: '#212529' }}>{value}</strong>
    </div>
  );
}

interface FeeRowProps {
  label: string;
  value: number;
  total: number;
}
function FeeRow({ label, value, total }: FeeRowProps): JSX.Element {
  // Hide zero rows in the breakdown to reduce noise — players who never hired
  // an expeditor don't need to see "$0" for that line.
  if (value === 0 && total > 0) return <></>;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px', padding: '3px 0' }}>
      <span style={{ color: '#495057' }}>{label}</span>
      <span>
        <strong style={{ color: '#212529' }}>{formatMoney(value)}</strong>
        {total > 0 && value > 0 && (
          <span style={{ color: '#adb5bd', marginLeft: '8px', fontWeight: 400 }}>{formatPercent(value, total)}</span>
        )}
      </span>
    </div>
  );
}

function approvalLabel(s: EndGameStats['approvals']['dob']): string {
  switch (s) {
    case 'approved': return '✓ Approved';
    case 'denied': return '✗ Denied';
    case 'minor-objection': return '⚠ Minor objection';
    case 'none': return '— None on file';
  }
}

function qualityLabel(q: 'HIGH' | 'MED' | 'LOW'): string {
  return q === 'HIGH' ? 'High quality' : q === 'MED' ? 'Medium quality' : 'Low quality';
}
