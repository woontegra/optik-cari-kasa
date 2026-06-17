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

/** GS1 group separator ve okuyucu kontrol karakterleri */
const CONTROL_CHARS = /[\x00-\x1F\x7F\u001D]/g;

const GS1_AI_FIXED: Record<string, number> = {
  '01': 14,
  '17': 6,
};

const GS1_KNOWN_AIS = ['01', '17', '10', '21'];

export function normalizeBarcode(rawCode: string): string {
  return rawCode
    .replace(CONTROL_CHARS, '')
    .replace(/[\r\n\t ]+/g, '')
    .trim();
}

export function detectBarcodeType(cleaned: string): BarcodeType {
  if (!cleaned) return 'UNKNOWN';
  if (/^https?:\/\//i.test(cleaned) || cleaned.includes('://')) return 'QRCODE';
  if (/\(01\)|\(17\)|\(10\)|\(21\)/.test(cleaned)) return 'GS1_DATAMATRIX';
  if (/^01\d{14}/.test(cleaned) && cleaned.length > 16) return 'GS1_DATAMATRIX';
  if (/^\d{8,14}$/.test(cleaned)) return 'BARCODE';
  if (/^[A-Za-z0-9\-_.]+$/.test(cleaned) && cleaned.length >= 4) return 'BARCODE';
  return 'UNKNOWN';
}

function formatGs1Date(yymmdd: string): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const year = yy >= 50 ? 1900 + yy : 2000 + yy;
  return `${year}-${mm}-${dd}`;
}

function parseGs1Parentheses(code: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const re = /\((\d{2})\)([^()]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    fields[m[1]] = m[2].trim();
  }
  return fields;
}

function readVariableField(code: string, start: number, currentAi: string): { value: string; nextPos: number } {
  const following = GS1_KNOWN_AIS.filter((ai) => ai !== currentAi);
  for (let i = start; i < code.length - 1; i++) {
    const two = code.substring(i, i + 2);
    if (!following.includes(two)) continue;
    if (currentAi === '10' && two === '21') {
      return { value: code.substring(start, i), nextPos: i };
    }
    if (currentAi === '21') break;
  }
  return { value: code.substring(start), nextPos: code.length };
}

function parseGs1Concatenated(code: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let pos = 0;
  while (pos < code.length - 1) {
    const ai = code.substring(pos, pos + 2);
    if (!GS1_KNOWN_AIS.includes(ai)) break;
    pos += 2;

    if (GS1_AI_FIXED[ai]) {
      const len = GS1_AI_FIXED[ai];
      if (pos + len > code.length) break;
      fields[ai] = code.substring(pos, pos + len);
      pos += len;
      continue;
    }

    if (ai === '10' || ai === '21') {
      const { value, nextPos } = readVariableField(code, pos, ai);
      fields[ai] = value;
      pos = nextPos;
      continue;
    }
    break;
  }
  return fields;
}

function gtinToBarcode(gtin: string): string {
  const g = gtin.replace(/\D/g, '');
  if (g.length === 14 && g.startsWith('0')) return g.slice(1);
  return g;
}

function mapGs1Fields(fields: Record<string, string>): Partial<ParsedBarcode> {
  const result: Partial<ParsedBarcode> = {};
  if (fields['01']) {
    result.gtin = fields['01'];
    result.barcode = gtinToBarcode(fields['01']);
  }
  if (fields['17']) {
    result.expiryDate = formatGs1Date(fields['17']);
  }
  if (fields['10']) {
    result.lotNo = fields['10'];
  }
  if (fields['21']) {
    result.serialNo = fields['21'];
  }
  return result;
}

export function parseScannedCode(rawCode: string): ParsedBarcode {
  const errors: string[] = [];
  const raw = rawCode ?? '';
  const normalized = normalizeBarcode(raw);

  if (!normalized) {
    return { raw, normalized: '', type: 'UNKNOWN', errors: ['Boş barkod okuması.'] };
  }

  const type = detectBarcodeType(normalized);
  const base: ParsedBarcode = { raw, normalized, type, errors };

  if (type === 'QRCODE') {
    return { ...base, barcode: normalized };
  }

  if (type === 'GS1_DATAMATRIX') {
    let fields: Record<string, string>;
    if (normalized.includes('(01)') || normalized.includes('(17)')) {
      fields = parseGs1Parentheses(normalized);
    } else {
      fields = parseGs1Concatenated(normalized);
    }

    if (!fields['01'] && !fields['10'] && !fields['21']) {
      errors.push('GS1 karekod içeriği çözümlenemedi.');
    }

    const mapped = mapGs1Fields(fields);
    return {
      ...base,
      ...mapped,
      errors: errors.length ? errors : undefined,
    };
  }

  if (/^\d{13}$/.test(normalized)) {
    return { ...base, type: 'BARCODE', barcode: normalized, gtin: `0${normalized}` };
  }

  return { ...base, type: type === 'UNKNOWN' ? 'BARCODE' : type, barcode: normalized };
}

/** Ürün araması için aday kod listesi (öncelik sırasıyla) */
export function buildSearchCandidates(parsed: ParsedBarcode, rawCode?: string): string[] {
  const set = new Set<string>();
  const add = (v?: string | null) => {
    const t = v?.trim();
    if (t) set.add(t);
  };

  add(rawCode);
  add(parsed.raw);
  add(parsed.normalized);
  add(parsed.barcode);
  add(parsed.gtin);

  if (parsed.gtin) {
    add(gtinToBarcode(parsed.gtin));
    if (parsed.gtin.length === 14 && parsed.gtin.startsWith('0')) {
      add(parsed.gtin.slice(1));
    }
  }

  return [...set];
}
