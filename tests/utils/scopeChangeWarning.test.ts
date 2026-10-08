import { describe, it, expect } from 'vitest';
import { scopeRollCanAddWork, showScopeApprovalWarning } from '../../src/utils/scopeChangeWarning';

const wRoll = [{ effect_type: 'cards', card_type: 'W' }];
const feeRoll = [{ effect_type: 'money', card_type: undefined }];

describe('scopeChangeWarning (fb:21473ad9)', () => {
  it('a roll that can draw work packages can add work; others cannot', () => {
    expect(scopeRollCanAddWork(wRoll)).toBe(true);
    expect(scopeRollCanAddWork(feeRoll)).toBe(false);
    expect(scopeRollCanAddWork([])).toBe(false);
  });
  it('warns only while a DOB approval is held at such a roll', () => {
    expect(showScopeApprovalWarning({ dobApprovalStatus: 'approved' }, wRoll)).toBe(true);
    expect(showScopeApprovalWarning({ dobApprovalStatus: 'none' }, wRoll)).toBe(false);
    expect(showScopeApprovalWarning({ dobApprovalStatus: 'approved' }, feeRoll)).toBe(false);
    expect(showScopeApprovalWarning({}, wRoll)).toBe(false);
  });
});
