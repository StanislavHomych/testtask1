import { buildConflictName, toNameKey } from './name-key';

describe('toNameKey', () => {
  it('trims and case-folds names', () => {
    expect(toNameKey('  Contracts.PDF  ')).toBe('contracts.pdf');
  });
});

describe('buildConflictName', () => {
  it('keeps the original name on the first attempt', () => {
    expect(buildConflictName('report.pdf', 1)).toBe('report.pdf');
  });

  it('inserts a numeric suffix before the extension', () => {
    expect(buildConflictName('report.pdf', 2)).toBe('report (1).pdf');
    expect(buildConflictName('report.pdf', 3)).toBe('report (2).pdf');
  });

  it('suffixes folder names without an extension', () => {
    expect(buildConflictName('Legal', 2)).toBe('Legal (1)');
  });
});
