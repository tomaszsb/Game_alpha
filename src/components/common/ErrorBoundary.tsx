// src/components/common/ErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { colors } from '../../styles/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs the errors, and displays a fallback UI instead of crashing.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 *
 * With custom fallback:
 * ```tsx
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console for debugging
    console.error('Error caught by ErrorBoundary:', error, errorInfo);

    // Update state with error info for display
    this.setState({
      errorInfo
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // TODO: Send to error reporting service (Sentry, LogRocket, etc.) when implemented
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backgroundColor: colors.background.primary,
            color: colors.text.primary,
            textAlign: 'center',
            zIndex: 9999
          }}
        >
          <div
            style={{
              maxWidth: '600px',
              width: '100%',
              padding: '40px',
              backgroundColor: colors.background.secondary,
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                marginBottom: '16px',
                color: colors.danger.main
              }}
            >
              ⚠️ Something went wrong
            </h2>

            <p
              style={{
                fontSize: '16px',
                marginBottom: '24px',
                color: colors.text.secondary,
                lineHeight: '1.5'
              }}
            >
              The game encountered an unexpected error. Don't worry - your progress may still be saved.
              Try reloading the page to continue playing.
            </p>

            {/* Show error details in development mode */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div
                style={{
                  marginBottom: '24px',
                  padding: '16px',
                  backgroundColor: colors.background.primary,
                  borderRadius: '4px',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  color: colors.error.primary,
                  overflow: 'auto',
                  maxHeight: '200px'
                }}
              >
                <strong>Error:</strong> {this.state.error.message}
                {this.state.errorInfo && (
                  <>
                    <br />
                    <br />
                    <strong>Stack:</strong>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}
            >
              <button
                onClick={this.handleReload}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: colors.primary.main,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = colors.primary.dark;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = colors.primary.main;
                }}
              >
                🔄 Reload Game
              </button>

              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={this.handleReset}
                  style={{
                    padding: '12px 24px',
                    fontSize: '16px',
                    backgroundColor: colors.background.primary,
                    color: colors.text.primary,
                    border: `1px solid ${colors.neutral.gray}`,
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Try to Continue
                </button>
              )}
            </div>

            <p
              style={{
                fontSize: '14px',
                marginTop: '24px',
                color: colors.text.tertiary
              }}
            >
              If this problem persists, please report it on GitHub.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
