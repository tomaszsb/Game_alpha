// src/main.tsx

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

/**
 * Main entry point for the React application.
 * Uses ReactDOM.createRoot() to mount the App component into the DOM.
 */
function main(): void {
  const container = document.getElementById('root');
  
  if (!container) {
    throw new Error('Root element not found. Make sure there is a div with id="root" in your HTML.');
  }

  const root = createRoot(container);
  root.render(<App />);
}

// Initialize the application
main();