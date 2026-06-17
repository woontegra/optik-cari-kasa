export function parseOpticNumber(value: string): number | null {
  if (!value?.trim()) return null;
  const cleaned = value.replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatAxis(axis: number): number {
  let a = axis;
  while (a > 180) a -= 180;
  while (a < 0) a += 180;
  if (a === 0) return 180;
  return Math.round(a);
}

export interface TransposeInput {
  sph: string;
  cyl: string;
  axis: string;
}

export interface TransposeResult {
  sph: string;
  cyl: string;
  axis: string;
}

/** Optik transpoze: SPH+CYL, CYL*-1, AXIS+90 (0-180 normalize) */
export function transposeOptic(input: TransposeInput): TransposeResult | null {
  const sph = parseOpticNumber(input.sph);
  const cyl = parseOpticNumber(input.cyl);
  const axis = parseOpticNumber(input.axis);
  if (sph == null || cyl == null || axis == null) return null;
  if (cyl === 0) return null;

  const newSph = sph + cyl;
  const newCyl = cyl * -1;
  const newAxis = formatAxis(axis + 90);

  const fmt = (n: number) => {
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}`;
  };

  return {
    sph: fmt(newSph),
    cyl: fmt(newCyl),
    axis: String(newAxis),
  };
}
