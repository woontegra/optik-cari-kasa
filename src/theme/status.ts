export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'official' | 'muted';

const STATUS_MAP: Array<{ patterns: RegExp[]; tone: StatusTone }> = [
  {
    patterns: [/aktif/i, /tamamland/i, /ödendi$/i, /işlendi/i, /gönderildi işaretlendi/i, /toplandı/i, /onay/i],
    tone: 'success',
  },
  {
    patterns: [/bekl/i, /hazırlan/i, /planland/i, /kısmi/i, /dışa aktarıldı/i, /taslak/i, /hazır$/i, /faturaya hazır/i],
    tone: 'warning',
  },
  {
    patterns: [/hatalı/i, /eksik/i, /iptal/i, /red/i, /gecik/i, /borç/i, /ödenmedi/i],
    tone: 'danger',
  },
  {
    patterns: [/pasif/i, /işlem dışı/i, /kapalı/i, /ertelendi/i],
    tone: 'muted',
  },
  {
    patterns: [/medula/i, /üts/i, /sgk/i, /e-fatura/i, /e-arşiv/i, /titubb/i],
    tone: 'official',
  },
  {
    patterns: [/devam/i, /açık/i, /işlemde/i],
    tone: 'info',
  },
];

export function getStatusTone(status: string | null | undefined): StatusTone {
  if (!status?.trim()) return 'neutral';
  const s = status.trim();
  for (const row of STATUS_MAP) {
    if (row.patterns.some((p) => p.test(s))) return row.tone;
  }
  return 'neutral';
}

export function statusBadgeClass(status: string | null | undefined): string {
  return `status-badge status-${getStatusTone(status)}`;
}
