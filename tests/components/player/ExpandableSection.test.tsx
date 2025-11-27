/**
 * ExpandableSection.test.tsx
 * 
 * Test suite for ExpandableSection component
 */

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpandableSection } from '../../../src/components/player/ExpandableSection';

describe('ExpandableSection', () => {
  const defaultProps = {
    title: 'Test Section',
    icon: '💰',
    hasAction: false,
    isExpanded: false,
    onToggle: vi.fn(),
    ariaControls: 'test-content',
    children: <div>Test Content</div>
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe('Basic Rendering', () => {
    it('should render the component without crashing', () => {
      render(<ExpandableSection {...defaultProps} />);
      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    it('should render the icon', () => {
      render(<ExpandableSection {...defaultProps} />);
      expect(screen.getByText('💰')).toBeInTheDocument();
    });

    it('should render children when expanded', () => {
      render(<ExpandableSection {...defaultProps} isExpanded={true} />);
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should not show children when collapsed', () => {
      render(<ExpandableSection {...defaultProps} isExpanded={false} />);
      const content = screen.getByText('Test Content');
      // Content is hidden but still in DOM
      expect(content.closest('[role="region"]')).toHaveAttribute('hidden');
    });
  });

  describe('Action Indicator', () => {
    it('should show indicator when hasAction=true', () => {
      render(<ExpandableSection {...defaultProps} hasAction={true} />);
      const indicator = screen.getByRole('status', { name: /action available/i });
      expect(indicator).toBeInTheDocument();
    });

    it('should not show indicator when hasAction=false', () => {
      render(<ExpandableSection {...defaultProps} hasAction={false} />);
      const indicator = screen.queryByRole('status', { name: /action available/i });
      expect(indicator).not.toBeInTheDocument();
    });
  });

  describe('Toggle Functionality', () => {
    it('should call onToggle when header is clicked', () => {
      const onToggle = vi.fn();
      render(<ExpandableSection {...defaultProps} onToggle={onToggle} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should show collapse icon when expanded', () => {
      render(<ExpandableSection {...defaultProps} isExpanded={true} />);
      expect(screen.getByText('▼')).toBeInTheDocument();
    });

    it('should show expand icon when collapsed', () => {
      render(<ExpandableSection {...defaultProps} isExpanded={false} />);
      expect(screen.getByText('▶')).toBeInTheDocument();
    });
  });

  describe('Accessibility (ARIA) Attributes', () => {
    it('should have correct aria-expanded attribute', () => {
      render(<ExpandableSection {...defaultProps} isExpanded={true} />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have correct aria-controls attribute', () => {
      render(<ExpandableSection {...defaultProps} ariaControls="test-content" />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-controls', 'test-content');
    });

    it('should have region role for content', () => {
      render(<ExpandableSection {...defaultProps} isExpanded={true} />);
      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
    });

    it('should have aria-labelledby on content region', () => {
      render(<ExpandableSection {...defaultProps} />);
      const region = screen.getByRole('region', { hidden: true });
      expect(region).toHaveAttribute('aria-labelledby', expect.stringContaining('header'));
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton when isLoading=true', () => {
      render(<ExpandableSection {...defaultProps} isExpanded={true} isLoading={true} />);
      const loadingElements = screen.getAllByText((content, element) => {
        return element?.classList.contains('skeleton-line') || false;
      });
      expect(loadingElements.length).toBeGreaterThan(0);
    });

    it('should not show children when loading', () => {
      render(<ExpandableSection {...defaultProps} isExpanded={true} isLoading={true} />);
      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when error prop is provided', () => {
      render(
        <ExpandableSection 
          {...defaultProps} 
          isExpanded={true} 
          error="Test error message" 
        />
      );
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('should show retry button when error and onRetry provided', () => {
      const onRetry = vi.fn();
      render(
        <ExpandableSection 
          {...defaultProps} 
          isExpanded={true} 
          error="Test error" 
          onRetry={onRetry}
        />
      );
      
      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();
    });

    it('should call onRetry when retry button clicked', () => {
      const onRetry = vi.fn();
      render(
        <ExpandableSection 
          {...defaultProps} 
          isExpanded={true} 
          error="Test error" 
          onRetry={onRetry}
        />
      );
      
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);
      
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should not show retry button when onRetry not provided', () => {
      render(
        <ExpandableSection 
          {...defaultProps} 
          isExpanded={true} 
          error="Test error" 
        />
      );
      
      expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    });

    it('should not show children when error state', () => {
      render(
        <ExpandableSection 
          {...defaultProps} 
          isExpanded={true} 
          error="Test error" 
        />
      );
      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });
  });

  describe('Desktop Behavior', () => {
    it('should have data-default-expanded attribute when defaultExpandedOnDesktop=true', () => {
      const { container } = render(
        <ExpandableSection 
          {...defaultProps} 
          defaultExpandedOnDesktop={true}
        />
      );
      
      const section = container.querySelector('.expandable-section');
      expect(section).toHaveAttribute('data-default-expanded', 'true');
    });

    it('should not have data-default-expanded=true when defaultExpandedOnDesktop=false', () => {
      const { container } = render(
        <ExpandableSection 
          {...defaultProps} 
          defaultExpandedOnDesktop={false}
        />
      );
      
      const section = container.querySelector('.expandable-section');
      expect(section).toHaveAttribute('data-default-expanded', 'false');
    });
  });
});