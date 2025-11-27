// src/context/ServiceProviderOptimized.tsx

import React, { ReactNode, useMemo } from 'react';
import { GameContext } from './GameContext';
import { IServiceContainer } from '../types/ServiceContracts';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';

// Lazy imports for services
import { DataServiceOptimized } from '../services/DataServiceOptimized';

interface ServiceProviderOptimizedProps {
  children: ReactNode;
}

/**
 * Optimized ServiceProvider with lazy service initialization
 * Services are created only when first accessed, reducing initial load time
 */
export const ServiceProviderOptimized = ({ children }: ServiceProviderOptimizedProps): JSX.Element => {
  const services = useMemo(() => {
    PerformanceMonitor.startMeasurement('service-container-creation');

    // Create lazy service container
    const serviceContainer: IServiceContainer = createLazyServiceContainer();

    PerformanceMonitor.endMeasurement('service-container-creation');
    return serviceContainer;
  }, []);

  return (
    <GameContext.Provider value={services}>
      {children}
    </GameContext.Provider>
  );
};

function createLazyServiceContainer(): IServiceContainer {
  // Service instances (created lazily)
  let _dataService: any = null;
  let _stateService: any = null;
  let _loggingService: any = null;
  let _resourceService: any = null;
  let _choiceService: any = null;
  let _gameRulesService: any = null;
  let _cardService: any = null;
  let _movementService: any = null;
  let _targetingService: any = null;
  let _notificationService: any = null;
  let _turnService: any = null;
  let _effectEngineService: any = null;
  let _negotiationService: any = null;
  let _playerActionService: any = null;

  // Lazy initialization functions
  const getDataService = () => {
    if (!_dataService) {
      PerformanceMonitor.startMeasurement('dataService-init');
      _dataService = new DataServiceOptimized();
      PerformanceMonitor.endMeasurement('dataService-init');
    }
    return _dataService;
  };

  const getStateService = () => {
    if (!_stateService) {
      PerformanceMonitor.startMeasurement('stateService-init');
      // Dynamic import to avoid loading during initial bundle parse
      import('../services/StateService').then(({ StateService }) => {
        if (!_stateService) {
          _stateService = new StateService(getDataService());
        }
      });
      // Return a placeholder that will be replaced
      _stateService = createServicePlaceholder('StateService');
    }
    return _stateService;
  };

  const getLoggingService = () => {
    if (!_loggingService) {
      PerformanceMonitor.startMeasurement('loggingService-init');
      import('../services/LoggingService').then(({ LoggingService }) => {
        if (!_loggingService) {
          _loggingService = new LoggingService(getStateService());
        }
      });
      _loggingService = createServicePlaceholder('LoggingService');
      PerformanceMonitor.endMeasurement('loggingService-init');
    }
    return _loggingService;
  };

  const getResourceService = () => {
    if (!_resourceService) {
      PerformanceMonitor.startMeasurement('resourceService-init');
      import('../services/ResourceService').then(({ ResourceService }) => {
        if (!_resourceService) {
          _resourceService = new ResourceService(getStateService());
        }
      });
      _resourceService = createServicePlaceholder('ResourceService');
      PerformanceMonitor.endMeasurement('resourceService-init');
    }
    return _resourceService;
  };

  const getChoiceService = () => {
    if (!_choiceService) {
      PerformanceMonitor.startMeasurement('choiceService-init');
      import('../services/ChoiceService').then(({ ChoiceService }) => {
        if (!_choiceService) {
          _choiceService = new ChoiceService(getStateService());
        }
      });
      _choiceService = createServicePlaceholder('ChoiceService');
      PerformanceMonitor.endMeasurement('choiceService-init');
    }
    return _choiceService;
  };

  const getGameRulesService = () => {
    if (!_gameRulesService) {
      PerformanceMonitor.startMeasurement('gameRulesService-init');
      import('../services/GameRulesService').then(({ GameRulesService }) => {
        if (!_gameRulesService) {
          _gameRulesService = new GameRulesService(getDataService(), getStateService());

          // Wire up circular dependency: StateService needs GameRulesService for condition evaluation
          getStateService().setGameRulesService(_gameRulesService);
        }
      });
      _gameRulesService = createServicePlaceholder('GameRulesService');
      PerformanceMonitor.endMeasurement('gameRulesService-init');
    }
    return _gameRulesService;
  };

  const getCardService = () => {
    if (!_cardService) {
      PerformanceMonitor.startMeasurement('cardService-init');
      import('../services/CardService').then(({ CardService }) => {
        if (!_cardService) {
          _cardService = new CardService(
            getDataService(),
            getStateService(),
            getResourceService(),
            getLoggingService(),
            getGameRulesService()
          );
        }
      });
      _cardService = createServicePlaceholder('CardService');
      PerformanceMonitor.endMeasurement('cardService-init');
    }
    return _cardService;
  };

  const getMovementService = () => {
    if (!_movementService) {
      PerformanceMonitor.startMeasurement('movementService-init');
      import('../services/MovementService').then(({ MovementService }) => {
        if (!_movementService) {
          _movementService = new MovementService(
            getDataService(),
            getStateService(),
            getChoiceService(),
            getLoggingService(),
            getGameRulesService()
          );
        }
      });
      _movementService = createServicePlaceholder('MovementService');
      PerformanceMonitor.endMeasurement('movementService-init');
    }
    return _movementService;
  };

  const getTargetingService = () => {
    if (!_targetingService) {
      PerformanceMonitor.startMeasurement('targetingService-init');
      import('../services/TargetingService').then(({ TargetingService }) => {
        if (!_targetingService) {
          _targetingService = new TargetingService(getStateService(), getChoiceService());
        }
      });
      _targetingService = createServicePlaceholder('TargetingService');
      PerformanceMonitor.endMeasurement('targetingService-init');
    }
    return _targetingService;
  };

  const getNotificationService = () => {
    if (!_notificationService) {
      PerformanceMonitor.startMeasurement('notificationService-init');
      import('../services/NotificationService').then(({ NotificationService }) => {
        if (!_notificationService) {
          _notificationService = new NotificationService(getStateService(), getLoggingService());
        }
      });
      _notificationService = createServicePlaceholder('NotificationService');
      PerformanceMonitor.endMeasurement('notificationService-init');
    }
    return _notificationService;
  };

  const getTurnService = () => {
    if (!_turnService) {
      PerformanceMonitor.startMeasurement('turnService-init');
      import('../services/TurnService').then(({ TurnService }) => {
        if (!_turnService) {
          _turnService = new TurnService(
            getDataService(),
            getStateService(),
            getGameRulesService(),
            getCardService(),
            getResourceService(),
            getMovementService(),
            getNegotiationService(),
            getLoggingService(),
            getChoiceService(),
            getNotificationService()
          );
        }
      });
      _turnService = createServicePlaceholder('TurnService');
      PerformanceMonitor.endMeasurement('turnService-init');
    }
    return _turnService;
  };

  const getEffectEngineService = () => {
    if (!_effectEngineService) {
      PerformanceMonitor.startMeasurement('effectEngineService-init');
      import('../services/EffectEngineService').then(({ EffectEngineService }) => {
        if (!_effectEngineService) {
          _effectEngineService = new EffectEngineService(
            getResourceService(),
            getCardService(),
            getChoiceService(),
            getStateService(),
            getMovementService(),
            getTurnService(),
            getGameRulesService(),
            getTargetingService(),
            getLoggingService()
          );
        }
      });
      _effectEngineService = createServicePlaceholder('EffectEngineService');
      PerformanceMonitor.endMeasurement('effectEngineService-init');
    }
    return _effectEngineService;
  };

  const getNegotiationService = () => {
    if (!_negotiationService) {
      PerformanceMonitor.startMeasurement('negotiationService-init');
      import('../services/NegotiationService').then(({ NegotiationService }) => {
        if (!_negotiationService) {
          _negotiationService = new NegotiationService(getStateService(), getEffectEngineService());
        }
      });
      _negotiationService = createServicePlaceholder('NegotiationService');
      PerformanceMonitor.endMeasurement('negotiationService-init');
    }
    return _negotiationService;
  };

  const getPlayerActionService = () => {
    if (!_playerActionService) {
      PerformanceMonitor.startMeasurement('playerActionService-init');
      import('../services/PlayerActionService').then(({ PlayerActionService }) => {
        if (!_playerActionService) {
          _playerActionService = new PlayerActionService(
            getDataService(),
            getStateService(),
            getGameRulesService(),
            getMovementService(),
            getTurnService(),
            getEffectEngineService(),
            getLoggingService()
          );
        }
      });
      _playerActionService = createServicePlaceholder('PlayerActionService');
      PerformanceMonitor.endMeasurement('playerActionService-init');
    }
    return _playerActionService;
  };

  // Return service container with lazy getters
  return {
    get dataService() { return getDataService(); },
    get stateService() { return getStateService(); },
    get loggingService() { return getLoggingService(); },
    get notificationService() { return getNotificationService(); },
    get turnService() { return getTurnService(); },
    get cardService() { return getCardService(); },
    get playerActionService() { return getPlayerActionService(); },
    get movementService() { return getMovementService(); },
    get gameRulesService() { return getGameRulesService(); },
    get resourceService() { return getResourceService(); },
    get choiceService() { return getChoiceService(); },
    get effectEngineService() { return getEffectEngineService(); },
    get negotiationService() { return getNegotiationService(); }
  };
}

/**
 * Creates a service placeholder that logs when methods are called before the service is loaded
 */
function createServicePlaceholder(serviceName: string) {
  return new Proxy({}, {
    get(target, prop) {
      if (typeof prop === 'string') {
        return (...args: any[]) => {
          console.warn(`⚠️ ${serviceName}.${prop}() called before service is loaded`);
          // Return a promise for async methods
          return Promise.resolve();
        };
      }
      return undefined;
    }
  });
}