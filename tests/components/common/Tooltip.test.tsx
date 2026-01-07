/**
 * Tooltip.test.tsx
 *
 * Test suite for Tooltip component
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Tooltip, SimpleTooltip } from '../../../src/components/common/Tooltip';

describe('Tooltip', () => {
  const defaultProps = {
    content: 'This is a tooltip',
    children: <button>Hover me</button>
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('should render children without tooltip initially', () => {
      render(<Tooltip {...defaultProps} />);
      expect(screen.getByText('Hover me')).toBeInTheDocument();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should render with custom content', () => {
      render(
        <Tooltip content="Custom tooltip text">
          <span>Custom child</span>
        </Tooltip>
      );
      expect(screen.getByText('Custom child')).toBeInTheDocument();
    });
  });

  describe('Hover Behavior', () => {
    it('should show tooltip after hover delay', () => {
      render(<Tooltip {...defaultProps} delay={100} />);

      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);

      // Tooltip should not be visible immediately
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Fast-forward past the delay - wrap in act to ensure React updates
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Now tooltip should be visible
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByText('This is a tooltip')).toBeInTheDocument();
    });

    it('should hide tooltip on mouse leave', () => {
      render(<Tooltip {...defaultProps} delay={0} />);

      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.mouseLeave(button);

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should cancel tooltip if mouse leaves before delay', () => {
      render(<Tooltip {...defaultProps} delay={500} />);

      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);

      // Leave before delay completes
      act(() => {
        vi.advanceTimersByTime(200);
      });
      fireEvent.mouseLeave(button);
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Tooltip should never have appeared
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Content Rendering', () => {
    it('should render context text when provided', () => {
      render(
        <Tooltip content="Main text" context="Additional context" delay={0}>
          <button>Hover</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByText('Hover'));
      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByText('Main text')).toBeInTheDocument();
      expect(screen.getByText('Additional context')).toBeInTheDocument();
    });

    it('should not render context section if not provided', () => {
      render(
        <Tooltip content="Main text only" delay={0}>
          <button>Hover</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByText('Hover'));
      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByText('Main text only')).toBeInTheDocument();

      // Verify no context section is present (context class/element would have specific styling)
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip.textContent).toBe('Main text only');
    });
  });

  describe('Position Prop', () => {
    it('should accept position prop without error', () => {
      const { rerender } = render(
        <Tooltip {...defaultProps} position="top" />
      );
      expect(screen.getByText('Hover me')).toBeInTheDocument();

      rerender(<Tooltip {...defaultProps} position="bottom" />);
      expect(screen.getByText('Hover me')).toBeInTheDocument();

      rerender(<Tooltip {...defaultProps} position="left" />);
      expect(screen.getByText('Hover me')).toBeInTheDocument();

      rerender(<Tooltip {...defaultProps} position="right" />);
      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('should not show tooltip when disabled', () => {
      render(<Tooltip {...defaultProps} disabled={true} delay={0} />);

      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should not show tooltip when content is empty', () => {
      render(
        <Tooltip content="" delay={0}>
          <button>Hover</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByText('Hover'));
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Focus Behavior', () => {
    it('should show tooltip on focus', () => {
      render(<Tooltip {...defaultProps} delay={0} />);

      const button = screen.getByText('Hover me');
      fireEvent.focus(button);
      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('should hide tooltip on blur', () => {
      render(<Tooltip {...defaultProps} delay={0} />);

      const button = screen.getByText('Hover me');
      fireEvent.focus(button);
      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.blur(button);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Max Width', () => {
    it('should accept custom maxWidth prop', () => {
      render(<Tooltip {...defaultProps} maxWidth={400} delay={0} />);

      fireEvent.mouseEnter(screen.getByText('Hover me'));
      act(() => {
        vi.advanceTimersByTime(10);
      });

      const tooltip = screen.getByRole('tooltip');
      const innerDiv = tooltip.querySelector('div');
      expect(innerDiv).toHaveStyle({ maxWidth: '400px' });
    });
  });
});

describe('SimpleTooltip', () => {
  it('should add title attribute to child element', () => {
    render(
      <SimpleTooltip content="Simple tooltip text">
        <button>Simple button</button>
      </SimpleTooltip>
    );

    const button = screen.getByText('Simple button');
    expect(button).toHaveAttribute('title', 'Simple tooltip text');
  });

  it('should work with different element types', () => {
    render(
      <SimpleTooltip content="Link tooltip">
        <a href="#">Link</a>
      </SimpleTooltip>
    );

    const link = screen.getByText('Link');
    expect(link).toHaveAttribute('title', 'Link tooltip');
  });
});
