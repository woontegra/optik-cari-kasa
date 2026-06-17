export type BarcodeType = 'BARCODE' | 'GS1_DATAMATRIX' | 'QRCODE' | 'UNKNOWN';

export interface ParsedBarcode {
  raw: string;
  normalized: string;
  type: BarcodeType;
  gtin?: string;
  barcode?: string;
  serialNo?: string;
  lotNo?: string;
  expiryDate?: string;
  ubbCode?: string;
  utsProductNo?: string;
  errors?: string[];
}

export interface ScanResolveResult {
  product: import('@/types/electron').Product | null;
  parsed: ParsedBarcode;
  matchedBy?: string;
}

export function formatScanNote(parsed: ParsedBarcode): string {
  const parts: string[] = [];
  if (parsed.serialNo) parts.push(`Seri: ${parsed.serialNo}`);
  if (parsed.lotNo) parts.push(`Lot: ${parsed.lotNo}`);
  if (parsed.expiryDate) parts.push(`SKT: ${parsed.expiryDate}`);
  return parts.join(' | ');
}

export function lineKey(productId: number, serialNo?: string): string {
  return serialNo ? `${productId}:${serialNo}` : String(productId);
}
