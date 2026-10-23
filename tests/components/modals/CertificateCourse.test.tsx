import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CertificateQuestions } from '../../../src/components/modals/CertificateQuestions';

describe('CertificateQuestions: course pick', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('picks one course at a time, and the pick goes to the printed page and the server', () => {
    const written: string[] = [];
    const win = { document: { open: vi.fn(), write: (h: string) => written.push(h), close: vi.fn(), getElementById: () => null } };
    vi.stubGlobal('open', vi.fn(() => win));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    render(<CertificateQuestions playerName="Maya" gameCode="G-ABC" whyQuestions={[]} />);
    fireEvent.click(screen.getByTestId('cert-course-350'));
    fireEvent.click(screen.getByTestId('cert-course-409'));
    expect(screen.getByTestId('cert-course-350').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('cert-course-409').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/red bug button/)).toBeTruthy();

    fireEvent.click(screen.getByTestId('print-certificate'));
    expect(written[0]).toMatch(/data-course="409"><i class="box">&#10003;/);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.course).toBe('409');
  });
});

describe('CertificateQuestions: the name on the certificate', () => {
  afterEach(() => vi.unstubAllGlobals());

  const setup = () => {
    const written: string[] = [];
    const win = { document: { open: vi.fn(), write: (h: string) => written.push(h), close: vi.fn(), getElementById: () => null } };
    const openMock = vi.fn(() => win);
    vi.stubGlobal('open', openMock);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    return { written, openMock, fetchMock };
  };

  it('a default name ("Player 1") asks for a real one, will not print without it, then uses it on the page and in the saved answers', () => {
    const { written, openMock, fetchMock } = setup();
    render(<CertificateQuestions playerName="Player 1" gameCode="G-ABC" whyQuestions={[]} />);
    fireEvent.click(screen.getByTestId('cert-course-409'));

    fireEvent.click(screen.getByTestId('print-certificate'));
    expect(screen.getByTestId('cert-name-missing')).toBeTruthy();
    expect(openMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('cert-name'), { target: { value: '  Kossi Mensah ' } });
    expect(screen.queryByTestId('cert-name-missing')).toBeNull();
    fireEvent.click(screen.getByTestId('print-certificate'));
    expect(written[0]).toContain('Kossi Mensah');
    expect(written[0]).not.toContain('Player 1');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).name).toBe('Kossi Mensah');
  });

  it('a real name shows no new box and is used as it is', () => {
    const { written, fetchMock } = setup();
    render(<CertificateQuestions playerName="Maya" gameCode="G-ABC" whyQuestions={[]} />);
    expect(screen.queryByTestId('cert-name')).toBeNull();
    fireEvent.click(screen.getByTestId('cert-course-350'));
    fireEvent.click(screen.getByTestId('print-certificate'));
    expect(written[0]).toContain('Maya');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).name).toBe('Maya');
  });

  it('only the exact game default counts as default ("Player 12" yes, "Playerson" and "Player One" no)', async () => {
    const { isDefaultPlayerName } = await import('../../../src/components/modals/CertificateQuestions');
    expect(isDefaultPlayerName('Player 1')).toBe(true);
    expect(isDefaultPlayerName('Player 12')).toBe(true);
    expect(isDefaultPlayerName('Playerson')).toBe(false);
    expect(isDefaultPlayerName('Player One')).toBe(false);
    expect(isDefaultPlayerName('Maya')).toBe(false);
  });
});
