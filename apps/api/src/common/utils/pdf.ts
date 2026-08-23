const PDF_MAGIC = Buffer.from('%PDF');

export function looksLikePdf(content: Buffer): boolean {
  if (content.byteLength < PDF_MAGIC.byteLength) {
    return false;
  }
  return content.subarray(0, PDF_MAGIC.byteLength).equals(PDF_MAGIC);
}
