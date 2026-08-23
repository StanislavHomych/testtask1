import { looksLikePdf } from './pdf';

describe('looksLikePdf', () => {
  it('accepts a PDF magic header', () => {
    expect(looksLikePdf(Buffer.from('%PDF-1.7\n...'))).toBe(true);
  });

  it('rejects non-PDF bytes', () => {
    expect(looksLikePdf(Buffer.from('<html>'))).toBe(false);
    expect(looksLikePdf(Buffer.from(''))).toBe(false);
  });
});
