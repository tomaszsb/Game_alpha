import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FeeInput } from '../../../src/components/editor/SpaceEditor';

// The inspection agencies' fee ("2% of scope") shows as a number box with a plain
// suffix and is written back in the same form (Tom, 2026-10-18: "Close the gap").
describe('FeeInput, percent of the project', () => {
  it('shows the number and writes "N% of scope" back', () => {
    const onChange = vi.fn();
    render(<FeeInput value="2% of scope" onChange={onChange} />);
    const box = screen.getByLabelText("Fee, percent of the project's cost") as HTMLInputElement;
    expect(box.value).toBe('2');
    expect(screen.getByText("% of the project's cost")).toBeTruthy();
    fireEvent.change(box, { target: { value: '3.5' } });
    expect(onChange).toHaveBeenCalledWith('3.5% of scope');
  });
});
