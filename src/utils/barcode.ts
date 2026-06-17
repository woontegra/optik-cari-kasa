/** Barkod okuyucudan gelen gürültüyü temizler (frontend ön-temizlik; asıl parse backend'de). */
export function sanitizeBarcode(raw: string): string {
  return raw
    .replace(/[\x00-\x1F\x7F\u001D]/g, '')
    .replace(/[\r\n\t ]+/g, '')
    .trim();
}
