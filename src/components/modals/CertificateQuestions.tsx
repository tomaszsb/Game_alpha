// src/components/modals/CertificateQuestions.tsx
//
// The certificate step (Tom, 2026-10-18, Review Q4 + Q5): three short "was it fun?"
// questions and two or three "why did that happen?" questions from the student's
// own game, all optional, answered right above "Print certificate". The "why"
// answers print on the certificate for the teacher. All answers are saved on the
// server (name, game code, answers, date; nothing else) so Tom can read them.

import React, { useState } from 'react';
import { colors } from '../../styles/theme';
import { openCertificate } from '../../utils/certificate';
import { FUN_QUESTIONS, type CertificateAnswers, type WhyQuestion } from '../../utils/certificateQuestions';
import { getBackendURL } from '../../utils/networkDetection';

interface Props {
  playerName: string;
  gameCode: string | null;
  whyQuestions: WhyQuestion[];
}

/** Sends the answers; never blocks or fails the certificate. */
export async function saveCertificateAnswers(
  body: { name: string; gameCode: string | null; answers: CertificateAnswers },
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const { answers } = body;
  const any = answers.playAgain || answers.mostBoring.trim() || answers.bestPart.trim() || answers.why.some(w => w.answer.trim());
  if (!any) return false;
  try {
    const res = await fetchFn(`${getBackendURL()}/api/class-answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: body.name,
        gameCode: body.gameCode ?? '',
        fun: { playAgain: answers.playAgain, mostBoring: answers.mostBoring, bestPart: answers.bestPart },
        why: answers.why,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const boxStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', fontSize: 15, padding: '8px 10px',
  borderRadius: 6, border: `1px solid ${colors.border.primary}`, fontFamily: 'inherit', resize: 'vertical',
};
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: 14, margin: '12px 0 4px' };

export function CertificateQuestions({ playerName, gameCode, whyQuestions }: Props): JSX.Element {
  const [playAgain, setPlayAgain] = useState<CertificateAnswers['playAgain']>('');
  const [mostBoring, setMostBoring] = useState('');
  const [bestPart, setBestPart] = useState('');
  const [why, setWhy] = useState<string[]>(() => whyQuestions.map(() => ''));
  const [saved, setSaved] = useState(false);

  const onPrint = () => {
    const whyAnswers = whyQuestions.map((q, i) => ({ question: q.question, answer: why[i] ?? '' }));
    // Open the tab first, inside the click, or the browser blocks it as a pop-up.
    if (!openCertificate(playerName, whyAnswers)) {
      window.alert('Your browser blocked the certificate window. Allow pop-ups for this site and try again.');
    }
    if (!saved) {
      void saveCertificateAnswers({
        name: playerName, gameCode,
        answers: { playAgain, mostBoring, bestPart, why: whyAnswers },
      }).then(ok => { if (ok) setSaved(true); });
    }
  };

  return (
    <div data-testid="certificate-questions" style={{ textAlign: 'left', maxWidth: 560, margin: '0 auto' }}>
      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 16 }}>Before you print</p>
      <p style={{ margin: 0, fontSize: 13, color: colors.text.secondary }}>
        All optional. Your answers to the last questions print on your certificate for your teacher.
      </p>

      <span style={labelStyle}>{FUN_QUESTIONS.playAgain}</span>
      <div role="radiogroup" aria-label={FUN_QUESTIONS.playAgain} style={{ display: 'flex', gap: 8 }}>
        {(['yes', 'maybe', 'no'] as const).map(v => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={playAgain === v}
            data-testid={`cert-play-again-${v}`}
            onClick={() => setPlayAgain(playAgain === v ? '' : v)}
            style={{
              flex: 1, minHeight: 44, fontSize: 15, cursor: 'pointer', borderRadius: 6,
              border: `2px solid ${playAgain === v ? colors.primary.main : colors.border.primary}`,
              background: playAgain === v ? colors.primary.light : 'transparent',
              color: colors.text.primary,
            }}
          >
            {v === 'yes' ? 'Yes' : v === 'maybe' ? 'Maybe' : 'No'}
          </button>
        ))}
      </div>

      <label style={labelStyle} htmlFor="cert-most-boring">{FUN_QUESTIONS.mostBoring}</label>
      <textarea id="cert-most-boring" data-testid="cert-most-boring" rows={2} maxLength={500} style={boxStyle}
        value={mostBoring} onChange={e => setMostBoring(e.target.value)} />

      <label style={labelStyle} htmlFor="cert-best-part">{FUN_QUESTIONS.bestPart}</label>
      <textarea id="cert-best-part" data-testid="cert-best-part" rows={2} maxLength={500} style={boxStyle}
        value={bestPart} onChange={e => setBestPart(e.target.value)} />

      {whyQuestions.map((q, i) => (
        <React.Fragment key={q.id}>
          <label style={labelStyle} htmlFor={`cert-why-${q.id}`}>{q.question}</label>
          <textarea id={`cert-why-${q.id}`} data-testid={`cert-why-${q.id}`} rows={2} maxLength={500} style={boxStyle}
            value={why[i] ?? ''} onChange={e => setWhy(prev => prev.map((v, j) => (j === i ? e.target.value : v)))} />
        </React.Fragment>
      ))}

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <button
          type="button"
          data-testid="print-certificate"
          onClick={onPrint}
          style={{ padding: '10px 18px', fontSize: '15px', cursor: 'pointer', minHeight: 44 }}
        >
          Print certificate
        </button>
      </div>
    </div>
  );
}
