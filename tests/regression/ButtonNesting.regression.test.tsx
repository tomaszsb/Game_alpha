/**
 * BUTTON NESTING REGRESSION TEST
 *
 * Bug: ActionButtons were rendered inside ExpandableSection header <button>,
 * creating nested buttons (invalid HTML) and breaking click events.
 *
 * Root cause: headerActions prop rendered inside the header button element.
 *
 * Fix: Moved headerActions to render outside the button with stopPropagation()
 * to prevent toggle when clicking actions.
 *
 * Date: 2025-11-07
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ExpandableSection } from '../../src/components/player/ExpandableSection';
import { ActionButton } from '../../src/components/player/ActionButton';

describe('ButtonNesting Regression Tests', () => {
  describe('ExpandableSection with headerActions', () => {
    it('should not nest buttons inside header button', () => {
      const mockAction = vi.fn();
      const { container } = render(
        <ExpandableSection
          title="Test Section"
          icon="📋"
          hasAction={false}
          isExpanded={false}
          onToggle={vi.fn()}
          ariaControls="test-section"
          headerActions={
            <ActionButton
              onClick={mockAction}
              label="Action"
              variant="primary"
            />
          }
        >
          <div>Content</div>
        </ExpandableSection>
      );

      // Check for nested buttons in DOM
      const buttons = container.querySelectorAll('button');
      buttons.forEach(button => {
        const nestedButtons = button.querySelectorAll('button');
        expect(nestedButtons.length).toBe(0);
      });
    });

    it('should allow headerActions button click without interference', async () => {
      const user = userEvent.setup();
      const mockAction = vi.fn();
      const mockToggle = vi.fn();

      render(
        <ExpandableSection
          title="Cards"
          icon="🎴"
          hasAction={false}
          isExpanded={false}
          onToggle={mockToggle}
          ariaControls="cards-section"
          headerActions={
            <ActionButton
              onClick={mockAction}
              label="Draw Cards"
              variant="primary"
            />
          }
        >
          <div>Card content</div>
        </ExpandableSection>
      );

      // Click the action button
      const actionButton = screen.getByRole('button', { name: /draw cards/i });
      await user.click(actionButton);

      // Action should fire, toggle should NOT
      expect(mockAction).toHaveBeenCalledTimes(1);
      expect(mockToggle).not.toHaveBeenCalled();
    });

    it('should allow section toggle without triggering headerActions', async () => {
      const user = userEvent.setup();
      const mockAction = vi.fn();
      const mockToggle = vi.fn();

      const { container } = render(
        <ExpandableSection
          title="Cards"
          icon="🎴"
          hasAction={false}
          isExpanded={false}
          onToggle={mockToggle}
          ariaControls="cards-section"
          headerActions={
            <ActionButton
              onClick={mockAction}
              label="Draw Cards"
              variant="primary"
            />
          }
        >
          <div>Card content</div>
        </ExpandableSection>
      );

      // Click the section title area (the header button specifically)
      // Use the header button with aria-controls to be specific
      const headerButton = container.querySelector('[aria-controls="cards-section"]');
      expect(headerButton).toBeTruthy();
      await user.click(headerButton!);

      // Toggle should fire, action should NOT
      expect(mockToggle).toHaveBeenCalledTimes(1);
      expect(mockAction).not.toHaveBeenCalled();
    });

    it('should not produce React warnings about invalid DOM nesting', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ExpandableSection
          title="Test"
          icon="📋"
          hasAction={false}
          isExpanded={false}
          onToggle={vi.fn()}
          ariaControls="test-section"
          headerActions={
            <ActionButton onClick={vi.fn()} label="Action" variant="primary" />
          }
        >
          <div>Content</div>
        </ExpandableSection>
      );

      // Check for React warnings about nesting
      const nestingWarnings = consoleErrorSpy.mock.calls.filter(call =>
        call.some(arg =>
          typeof arg === 'string' &&
          (arg.includes('validateDOMNesting') ||
           (arg.includes('button') && arg.includes('cannot appear as a descendant')))
        )
      );

      expect(nestingWarnings.length).toBe(0);
      consoleErrorSpy.mockRestore();
    });

    it('should have proper accessibility with multiple interactive elements', () => {
      const mockAction = vi.fn();
      const mockToggle = vi.fn();

      render(
        <ExpandableSection
          title="Test Section"
          icon="📋"
          hasAction={false}
          isExpanded={false}
          onToggle={mockToggle}
          ariaControls="test-section"
          headerActions={
            <ActionButton
              onClick={mockAction}
              label="Primary Action"
              variant="primary"
              ariaLabel="Perform primary action"
            />
          }
        >
          <div>Content</div>
        </ExpandableSection>
      );

      // Both buttons should be accessible
      const toggleButton = screen.getByRole('button', { name: /test section/i });
      const actionButton = screen.getByRole('button', { name: /perform primary action/i });

      expect(toggleButton).toBeInTheDocument();
      expect(actionButton).toBeInTheDocument();

      // Buttons should be siblings or separately accessible, not nested
      expect(toggleButton).not.toContainElement(actionButton);
    });

    it('should handle multiple headerActions without nesting', () => {
      const mockAction1 = vi.fn();
      const mockAction2 = vi.fn();
      const { container } = render(
        <ExpandableSection
          title="Multi-Action Section"
          icon="📋"
          hasAction={false}
          isExpanded={false}
          onToggle={vi.fn()}
          ariaControls="multi-section"
          headerActions={
            <>
              <ActionButton
                onClick={mockAction1}
                label="Action 1"
                variant="primary"
              />
              <ActionButton
                onClick={mockAction2}
                label="Action 2"
                variant="secondary"
              />
            </>
          }
        >
          <div>Content</div>
        </ExpandableSection>
      );

      // Check no button contains another button
      const buttons = container.querySelectorAll('button');
      buttons.forEach(button => {
        const nestedButtons = button.querySelectorAll('button');
        expect(nestedButtons.length).toBe(0);
      });

      // Should have 3 total buttons: 1 toggle + 2 actions
      expect(buttons.length).toBe(3);
    });
  });

  describe('HTML Validity', () => {
    it('should maintain valid HTML structure with interactive elements', () => {
      const { container } = render(
        <ExpandableSection
          title="Valid HTML Test"
          icon="✅"
          hasAction={false}
          isExpanded={false}
          onToggle={vi.fn()}
          ariaControls="valid-section"
          headerActions={
            <ActionButton
              onClick={vi.fn()}
              label="Test Action"
              variant="primary"
            />
          }
        >
          <div>Content</div>
        </ExpandableSection>
      );

      // Get all buttons
      const buttons = Array.from(container.querySelectorAll('button'));

      // Verify no button is an ancestor of another
      buttons.forEach((button, i) => {
        buttons.forEach((otherButton, j) => {
          if (i !== j) {
            expect(button.contains(otherButton)).toBe(false);
          }
        });
      });
    });
  });
});
