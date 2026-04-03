/**
 * Test utilities with proper provider wrappers
 *
 * Use renderWithProviders instead of render for components that need context providers.
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { GameContext } from '../../src/context/GameContext';
import { DictionaryProvider } from '../../src/dictionary';

interface WrapperProps {
  children: React.ReactNode;
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  gameServices?: any;
}

/**
 * Creates a wrapper component with all necessary providers
 */
function createWrapper(gameServices?: any) {
  return function Wrapper({ children }: WrapperProps) {
    // If gameServices provided, wrap with GameContext
    if (gameServices) {
      return (
        <DictionaryProvider>
          <GameContext.Provider value={gameServices}>
            {children}
          </GameContext.Provider>
        </DictionaryProvider>
      );
    }

    // Otherwise just wrap with DictionaryProvider
    return (
      <DictionaryProvider>
        {children}
      </DictionaryProvider>
    );
  };
}

/**
 * Custom render function that wraps components with all necessary providers
 *
 * @param ui - The component to render
 * @param options - Render options including optional gameServices
 * @returns The render result
 *
 * @example
 * // With game services
 * renderWithProviders(<PlayerPanel />, { gameServices: mockServices });
 *
 * @example
 * // Without game services (just DictionaryProvider)
 * renderWithProviders(<SomeComponent />);
 */
export function renderWithProviders(
  ui: ReactElement,
  { gameServices, ...options }: CustomRenderOptions = {}
) {
  return render(ui, {
    wrapper: createWrapper(gameServices),
    ...options
  });
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render with our custom render
export { renderWithProviders as render };
