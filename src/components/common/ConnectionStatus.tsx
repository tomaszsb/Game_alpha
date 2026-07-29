import React, { useState, useEffect, useCallback } from 'react';
import './ConnectionStatus.css';

interface ConnectionStatusProps {
  /** Server URL to monitor */
  serverUrl: string;
  /** Check interval in milliseconds (default: 30000 = 30s) */
  checkInterval?: number;
}

/**
 * ConnectionStatus Component
 *
 * Displays real-time connection status to the backend server.
 * Shows:
 * - 🟢 Connected (green) when server is reachable
 * - 🔴 Offline (red) when server is unreachable
 * - 🟡 Checking... (yellow) during health check
 *
 * Useful for:
 * - Development: Know if backend server is running
 * - Production: Show users if they're experiencing connectivity issues
 *
 * @example
 * ```tsx
 * <ConnectionStatus serverUrl="http://localhost:3001" />
 * ```
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  serverUrl,
  checkInterval = 30000
}) => {
  const [status, setStatus] = useState<'connected' | 'offline' | 'checking'>('checking');
  // NOTE: a lastChecked timestamp was tracked here but never rendered, so every
  // successful poll (default: one every 30s) re-rendered this component for a
  // value nobody could see. Removed; `status` is the only state that displays.

  // useCallback so the polling effect below can depend on it honestly. Without
  // it this function was rebuilt every render, so listing it as a dep would
  // have torn down and recreated the interval on every render — which is why
  // the dep was omitted and the warning suppressed itself by accident.
  const checkConnection = useCallback(async () => {
    // Empty string is valid (same-origin relative URL)
    if (serverUrl === undefined || serverUrl === null) {
      setStatus('offline');
      return;
    }

    setStatus('checking');

    try {
      const response = await fetch(`${serverUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (response.ok) {
        setStatus('connected');
      } else {
        setStatus('offline');
      }
    } catch (_error) {
      setStatus('offline');
    }
  }, [serverUrl]);

  useEffect(() => {
    // Initial check
    checkConnection();

    // Set up periodic checks
    const interval = setInterval(checkConnection, checkInterval);

    return () => clearInterval(interval);
  }, [checkConnection, checkInterval]);

  const getStatusDisplay = () => {
    switch (status) {
      case 'connected':
        return { icon: '🟢', text: 'Connected', className: 'connected' };
      case 'offline':
        return { icon: '🔴', text: 'Offline', className: 'offline' };
      case 'checking':
        return { icon: '🟡', text: 'Checking...', className: 'checking' };
    }
  };

  const display = getStatusDisplay();

  return (
    <div className={`connection-status connection-status--${display.className}`}>
      <span className="connection-status__icon">{display.icon}</span>
      <span className="connection-status__text">{display.text}</span>
      {status === 'offline' && (
        <button
          className="connection-status__retry"
          onClick={checkConnection}
          aria-label="Retry connection"
        >
          🔄 Retry
        </button>
      )}
    </div>
  );
};
