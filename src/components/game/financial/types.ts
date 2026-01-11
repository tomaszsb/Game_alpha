// src/components/game/financial/types.ts

import { CSSProperties } from 'react';

/**
 * Shared types for financial display components
 */

export interface FinancialStatus {
  playerMoney: number;
  totalScopeCost: number;
  surplus: number;
  isDeficit: boolean;
}

export interface CardGroup {
  cardId: string;
  card: any;
}

export interface GroupedWCards {
  [workType: string]: CardGroup[];
}

export interface FundingTransaction {
  type: string;
  description: string;
  amount: number;
  icon: string;
}

export interface SharedStyles {
  sectionStyle: CSSProperties;
  sectionTitleStyle: CSSProperties;
  metricRowStyle: CSSProperties;
  metricLabelStyle: CSSProperties;
  metricValueStyle: CSSProperties;
}

export interface FundingCardSectionProps {
  title: string;
  cards: string[];
  cardType: string;
  dataService: any;
  colors: any;
}

export interface OwnerSeedMoneySectionProps {
  bCards: string[];
  iCards: string[];
  totalFunding: number;
  dataService: any;
  colors: any;
}
