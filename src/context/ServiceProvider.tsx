// src/context/ServiceProvider.tsx

import React, { ReactNode } from 'react';
import { GameContext } from './GameContext';
import { IServiceContainer } from '../types/ServiceContracts';

// --- Service Imports ---
import { DataService } from '../services/DataService';
import { StateService } from '../services/StateService';
import { LoggingService } from '../services/LoggingService';
import { TurnService } from '../services/TurnService';
import { CardService } from '../services/CardService';
import { PlayerActionService } from '../services/PlayerActionService';
import { MovementService } from '../services/MovementService';
import { GameRulesService } from '../services/GameRulesService';
import { ResourceService } from '../services/ResourceService';
import { ChoiceService } from '../services/ChoiceService';
import { EffectEngineService } from '../services/EffectEngineService';
import { NegotiationService } from '../services/NegotiationService';
import { TargetingService } from '../services/TargetingService';
import { NotificationService } from '../services/NotificationService';
import { CardEffectService } from '../services/CardEffectService';
import { FinancialEffectHandler } from '../services/FinancialEffectHandler';
import { CardEffectHandler } from '../services/CardEffectHandler';
import { ApprovalService } from '../services/ApprovalService';

interface ServiceProviderProps {
  children: ReactNode;
}

/**
 * The ServiceProvider component is the dependency injection container for the entire application.
 *
 * It instantiates all the services and provides them to the component tree via the GameContext.
 * This is the *only* place where services should be directly instantiated.
 *
 * @param {ServiceProviderProps} props The component props.
 * @returns {JSX.Element} The provider component.
 */
export const ServiceProvider = ({ children }: ServiceProviderProps): JSX.Element => {
  // Instantiate services - Phase 1 & 2: Core services implemented
  const dataService = new DataService();
  const stateService = new StateService(dataService);
  const loggingService = new LoggingService(stateService);
  const resourceService = new ResourceService(stateService);
  const choiceService = new ChoiceService(stateService);
  const gameRulesService = new GameRulesService(dataService, stateService);

  // Wire up circular dependency: StateService needs GameRulesService for condition evaluation
  stateService.setGameRulesService(gameRulesService);

  const approvalService = new ApprovalService();
  const cardService = new CardService(dataService, stateService, resourceService, loggingService, gameRulesService, choiceService, approvalService);
  const movementService = new MovementService(dataService, stateService, choiceService, loggingService, gameRulesService, approvalService);
  const targetingService = new TargetingService(stateService, choiceService);

  // Create NotificationService early for TurnService dependency
  const notificationService = new NotificationService(stateService, loggingService);

  // Build the two effect handlers up-front so they can be passed into EffectEngineService's constructor.
  const financialEffectHandler = new FinancialEffectHandler(resourceService, stateService, gameRulesService, loggingService, dataService, notificationService);
  const cardEffectHandler = new CardEffectHandler(cardService, stateService, choiceService, loggingService, dataService, notificationService);

  // Temp EffectEngineService exists only to break the 3-way Turn↔EffectEngine↔Card cycle
  // (see docs/technical/ARCHITECTURE.md). NegotiationService holds the temp instance but only
  // invokes it after the real instance has been wired onto turnService/cardService below.
  const tempEffectEngine = new EffectEngineService(resourceService, cardService, choiceService, stateService, movementService, undefined as any, undefined as any, targetingService, loggingService, dataService, notificationService, financialEffectHandler, cardEffectHandler);
  const negotiationService = new NegotiationService(stateService, tempEffectEngine);

  // CardEffectService is a clean dependency (no cycle back to TurnService),
  // so it goes through TurnService's constructor — not setter injection.
  const cardEffectService = new CardEffectService(cardService, stateService, dataService, choiceService);

  // Create TurnService with NegotiationService and NotificationService dependencies
  const turnService = new TurnService(dataService, stateService, gameRulesService, cardService, resourceService, movementService, negotiationService, loggingService, choiceService, notificationService, undefined, undefined, undefined, cardEffectService, approvalService);

  // Real EffectEngineService — gets the constructed turnService and all dependencies up-front.
  const effectEngineService = new EffectEngineService(resourceService, cardService, choiceService, stateService, movementService, turnService, gameRulesService, targetingService, loggingService, dataService, notificationService, financialEffectHandler, cardEffectHandler);

  // Remaining setter calls are for the two genuine architectural cycles documented in ARCHITECTURE.md.
  turnService.setEffectEngineService(effectEngineService);
  cardService.setEffectEngineService(effectEngineService);

  const playerActionService = new PlayerActionService(dataService, stateService, gameRulesService, movementService, turnService, effectEngineService, loggingService);

  const services: IServiceContainer = {
    dataService,
    stateService,
    loggingService,
    notificationService,
    turnService,
    cardService,
    playerActionService,
    movementService,
    gameRulesService,
    resourceService,
    choiceService,
    effectEngineService,
    negotiationService,
    approvalService,
  };

  return (
    <GameContext.Provider value={services}>
      {children}
    </GameContext.Provider>
  );
};
