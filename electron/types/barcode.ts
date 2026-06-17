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
  product: Record<string, unknown> | null;
  parsed: ParsedBarcode;
  matchedBy?: string;
}
