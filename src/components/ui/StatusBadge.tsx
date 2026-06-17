import { statusBadgeClass } from '@/theme/status';

interface StatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  if (!status) return <span className={`status-badge status-muted ${className}`.trim()}>-</span>;
  return <span className={`${statusBadgeClass(status)} ${className}`.trim()}>{status}</span>;
}
