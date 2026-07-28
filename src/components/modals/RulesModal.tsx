// src/components/modals/RulesModal.tsx

import React from 'react';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { colors, theme } from '../../styles/theme';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RulesModal({ isOpen, onClose }: RulesModalProps): JSX.Element | null {
  const sectionStyle: React.CSSProperties = {
    marginBottom: '24px',
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: colors.secondary.dark,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const textStyle: React.CSSProperties = {
    fontSize: '14px',
    lineHeight: '1.6',
    color: colors.text.primary,
  };

  const listStyle: React.CSSProperties = {
    paddingLeft: '20px',
    margin: 0,
  };

  const listItemStyle: React.CSSProperties = {
    marginBottom: '8px',
  };

  const cardGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
  };

  const footer = (
    <button
      onClick={onClose}
      style={modalButtonStyles.primary}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '0.9';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      Got it!
    </button>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Rules"
      emoji={theme.emoji.rules}
      maxWidth="800px"
      footer={footer}
      testId="rules-modal"
    >
      <div style={textStyle}>
        <section style={sectionStyle}>
          <h3 style={headingStyle}>
            {theme.emoji.target} Game Objective
          </h3>
          <p>
            Navigate through the development process from initial scope to project completion.
            Manage your time, money, and resources while making strategic decisions to successfully
            complete your construction project.
          </p>
        </section>

        <section style={sectionStyle}>
          <h3 style={headingStyle}>
            📋 Turn Structure
          </h3>
          <ol style={listStyle}>
            <li style={listItemStyle}>
              <strong>Determine Outcome:</strong> Each space has different possible outcomes that affect your project
            </li>
            <li style={listItemStyle}>
              <strong>Complete Actions:</strong> Perform any required actions (like hiring expeditors or securing funding)
            </li>
            <li style={listItemStyle}>
              <strong>End Turn:</strong> Once all actions are completed, end your turn to advance
            </li>
          </ol>
        </section>

        <section style={sectionStyle}>
          <h3 style={headingStyle}>
            {theme.emoji.cards} Resource Types
          </h3>
          <div style={cardGridStyle}>
            <div>
              <strong style={{ color: colors.game.cardTypes.W.primary }}>
                {colors.game.cardTypes.W.emoji} Work Packages:
              </strong> Construction work scopes and project requirements
            </div>
            <div>
              <strong style={{ color: colors.game.cardTypes.B.primary }}>
                {colors.game.cardTypes.B.emoji} Bank Loans:
              </strong> Funding and financial resources
            </div>
            <div>
              <strong style={{ color: colors.game.cardTypes.E.primary }}>
                {colors.game.cardTypes.E.emoji} Expeditors:
              </strong> Filing representatives who can help or hinder application processes
            </div>
            <div>
              <strong style={{ color: colors.game.cardTypes.L.primary }}>
                {colors.game.cardTypes.L.emoji} Life Events:
              </strong> Real-world surprises like new laws, weather delays, and unforeseen circumstances
            </div>
            <div>
              <strong style={{ color: colors.game.cardTypes.I.primary }}>
                {colors.game.cardTypes.I.emoji} Investors:
              </strong> Investment opportunities and funding partners
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h3 style={headingStyle}>
            {colors.game.cardTypes.W.emoji} Key Spaces
          </h3>
          <ul style={listStyle}>
            <li style={listItemStyle}>
              <strong>OWNER-SCOPE-INITIATION:</strong> Define project scope and hire expeditors
            </li>
            <li style={listItemStyle}>
              <strong>OWNER-FUND-INITIATION:</strong> Secure initial funding
            </li>
            <li style={listItemStyle}>
              <strong>ARCH/ENG Spaces:</strong> Work with architects and engineers
            </li>
            <li style={listItemStyle}>
              <strong>REG Spaces:</strong> Handle permits and regulatory requirements
            </li>
            <li style={listItemStyle}>
              <strong>CON Spaces:</strong> Construction and final project phases
            </li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h3 style={headingStyle}>
            {theme.emoji.negotiation} Negotiation
          </h3>
          <p>
            Some spaces allow negotiation. If you have a snapshot from entering the space,
            you can restore your previous state. Otherwise, you’ll receive a time penalty
            but can try again.
          </p>
        </section>

        <section>
          <h3 style={headingStyle}>
            {theme.emoji.trophy} Winning
          </h3>
          <p>
            Successfully navigate through all phases of development and reach the final
            completion space to win the game. Manage your resources wisely and make
            strategic decisions to overcome challenges along the way.
          </p>
        </section>
      </div>
    </ModalBase>
  );
}
