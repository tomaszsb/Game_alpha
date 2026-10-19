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
