// src/context/GameContext.ts

import { createContext, useContext } from 'react';
import { IServiceContainer } from '../types/ServiceContracts';

/**
 * The React Context object for providing the service container throughout the component tree.
 *
 * It is initialized with `null`, and a runtime check in `useGameContext` will ensure
 * that components are using the context within a `ServiceProvider` tree.
 */
export const GameContext = createContext<IServiceContainer | null>(null);

/**
 * Custom hook for accessing the game service container.
 *
 * @returns The service container.
 * @throws Error if the hook is used outside of a `ServiceProvider`.
 */
export const useGameContext = (): IServiceContainer => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within a ServiceProvider');
  }
  return context;
};
