/* @vitest-pool forks */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SchoolBrandingStrip } from '../../../src/components/classroom/SchoolBrandingStrip';
import * as api from '../../../src/components/classroom/schoolBrandingApi';

describe('SchoolBrandingStrip', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => cleanup());

  it('is folded away until opened, so the classroom row does not grow', () => {
    const spy = vi.spyOn(api, 'fetchSchoolBranding');
    render(<SchoolBrandingStrip instanceId="room-1" />);
    expect(screen.queryByLabelText('School name')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('shows the saved name and logo, and saves a new name', async () => {
    vi.spyOn(api, 'fetchSchoolBranding').mockResolvedValue({ schoolName: 'Farmingdale', logoVersion: 4 });
    const save = vi.spyOn(api, 'saveSchoolName').mockResolvedValue({ success: true });
    render(<SchoolBrandingStrip instanceId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: /School name/ }));
    const input = await screen.findByLabelText('School name') as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('Farmingdale'));
    expect(screen.getByAltText('Farmingdale logo')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'Farmingdale State' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith('room-1', 'Farmingdale State', undefined));
    expect(await screen.findByRole('status')).toHaveTextContent('School name saved.');
  });

  it("uploads a picked file and shows the server's plain refusal", async () => {
    vi.spyOn(api, 'fetchSchoolBranding').mockResolvedValue({ schoolName: null, logoVersion: null });
    const up = vi.spyOn(api, 'uploadLogo').mockResolvedValue({ success: false, error: 'Use a PNG or JPEG under 1 MB' });
    const { container } = render(<SchoolBrandingStrip instanceId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: /School name/ }));
    expect(await screen.findByText('No logo yet.')).toBeInTheDocument();
    const file = new File([new Uint8Array(10)], 'x.png', { type: 'image/png' });
    fireEvent.change(container.querySelector('input[type=file]') as HTMLInputElement, { target: { files: [file] } });
    await waitFor(() => expect(up).toHaveBeenCalled());
    expect(await screen.findByRole('status')).toHaveTextContent('Use a PNG or JPEG under 1 MB');
  });

  it('removes the logo only after the teacher confirms', async () => {
    vi.spyOn(api, 'fetchSchoolBranding').mockResolvedValue({ schoolName: 'F', logoVersion: 2 });
    const rm = vi.spyOn(api, 'removeLogo').mockResolvedValue({ success: true });
    const confirm = vi.spyOn(window, 'confirm');
    render(<SchoolBrandingStrip instanceId="room-1" />);
    fireEvent.click(screen.getByRole('button', { name: /School name/ }));
    const btn = await screen.findByRole('button', { name: 'Remove logo' });
    confirm.mockReturnValueOnce(false);
    fireEvent.click(btn);
    expect(rm).not.toHaveBeenCalled();
    confirm.mockReturnValueOnce(true);
    fireEvent.click(btn);
    await waitFor(() => expect(rm).toHaveBeenCalledWith('room-1', undefined));
  });
});
