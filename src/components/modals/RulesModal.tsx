// src/components/modals/RulesModal.tsx

import React from 'react';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { colors, theme } from '../../styles/theme';
import { getUIString } from '../../constants/uiStrings';

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
      {getUIString('RULES.footer.gotIt')}
    </button>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={getUIString('RULES.title')}
      emoji={theme.emoji.rules}
      maxWidth="800px"
      footer={footer}
      testId="rules-modal"
    >
      <div style={textStyle}>
        <section style={sectionStyle}>
          <h3 style={headingStyle}>
            {theme.emoji.target} {getUIString('RULES.objective.heading')}
          </h3>
          <p>
            {getUIString('RULES.objective.body')}
          </p>
        </section>

        <section style={sectionStyle}>
          <h3 style={headingStyle}>
            📋 {getUIString('RULES.turnStructure.heading')}
          </h3>
          <ol style={listStyle}>
            <li style={listItemStyle}>
              <strong>{getUIString('RULES.turnStructure.step1.label')}</strong> {getUIString('RULES.turnStructure.step1.body')}
            </li>
            <li style={listItemStyle}>
              <strong>{getUIString('RULES.turnStructure.step2.label')}</strong> {getUIString('RULES.turnStructure.step2.body')}
            </li>
            <li style={listItemStyle}>
              <strong>{getUIString('RULES.turnStructure.step3.label')}</strong> {getUIString('RULES.turnStructure.step3.body')}
            </li>
          </ol>
        </section>

        <section style={sectionStyle}>
          <h3 style={headingStyle}>
            {theme.emoji.cards} {getUIString('RULES.resourceTypes.heading')}
          </h3>
          <div style={cardGridStyle}>
            <div>
              <strong style={{ color: colors.game.cardTypes.W.primary }}>
                {colors.game.cardTypes.W.emoji} {getUIString('RULES.resourceTypes.W.label')}
              </strong> {getUIString('RULES.resourceTypes.W.body')}
            </div>
            <div>
              <strong style={{ color: colors.game.cardTypes.B.primary }}>
                {colors.game.cardTypes.B.emoji} {getUIString('RULES.resourceTypes.B.label')}
              </strong> {getUIString('RULES.resourceTypes.B.body')}
            </div>
            <div>
              <strong style={{ color: colors.game.cardTypes.E.primary }}>
                {colors.game.cardTypes.E.emoji} {getUIString('RULES.resourceTypes.E.label')}
              </strong> {getUIString('RULES.resourceTypes.E.body')}
            </div>
            <div>
              <strong style={{ color: colors.game.cardTypes.L.primary }}>
                {colors.game.cardTypes.L.emoji} {getUIString('RULES.resourceTypes.L.label')}
              </strong> {getUIString('RULES.resourceTypes.L.body')}
            </div>
            <div>
              <strong style={{ color: colors.game.cardTypes.I.primary }}>
                {colors.game.cardTypes.I.emoji} {getUIString('RULES.resourceTypes.I.label')}
              </strong> {getUIString('RULES.resourceTypes.I.body')}
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h3 style={headingStyle}>
            {colors.game.cardTypes.W.emoji} {getUIString('RULES.keySpaces.heading')}
          </h3>
          <ul style={listStyle}>
            <li style={listItemStyle}>
              <strong>{getUIString('RULES.keySpaces.item1.label')}</strong> {getUIString('RULES.keySpaces.item1.body')}
            </li>
            <li style={listItemStyle}>
              <strong>{getUIString('RULES.keySpaces.item2.label')}</strong> {getUIString('RULES.keySpaces.item2.body')}
            </li>
            <li style={listItemStyle}>
              <strong>{getUIString('RULES.keySpaces.item3.label')}</strong> {getUIString('RULES.keySpaces.item3.body')}
            </li>
            <li style={listItemStyle}>
              <strong>{getUIString('RULES.keySpaces.item4.label')}</strong> {getUIString('RULES.keySpaces.item4.body')}
            </li>
            <li style={listItemStyle}>
              <strong>{getUIString('RULES.keySpaces.item5.label')}</strong> {getUIString('RULES.keySpaces.item5.body')}
            </li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h3 style={headingStyle}>
            {theme.emoji.negotiation} {getUIString('RULES.negotiation.heading')}
          </h3>
          <p>
            {getUIString('RULES.negotiation.body')}
          </p>
        </section>

        <section>
          <h3 style={headingStyle}>
            {theme.emoji.trophy} {getUIString('RULES.winning.heading')}
          </h3>
          <p>
            {getUIString('RULES.winning.body')}
          </p>
        </section>
      </div>
    </ModalBase>
  );
}
