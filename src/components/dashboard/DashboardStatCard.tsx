import type { ModuleId } from '@/theme/modules';

export type AlertLevel = 'none' | 'neutral' | 'warning' | 'critical' | 'success' | 'pending';
export type ValueTone = 'default' | 'success' | 'danger' | 'warning' | 'muted';

interface DashboardStatCardProps {
  icon: string;
  label: string;
  value: string;
  hint?: string;
  module: ModuleId;
  size?: 'hero' | 'compact';
  alert?: AlertLevel;
  valueTone?: ValueTone;
  onClick?: () => void;
}

export default function DashboardStatCard({
  icon,
  label,
  value,
  hint,
  module,
  size = 'compact',
  alert = 'none',
  valueTone = 'default',
  onClick,
}: DashboardStatCardProps) {
  const alertClass =
    alert === 'critical'
      ? 'alert-critical'
      : alert === 'warning'
        ? 'alert-warning'
        : alert === 'success'
          ? 'alert-success'
          : alert === 'pending'
            ? 'alert-pending'
            : alert === 'neutral'
              ? 'alert-neutral'
              : '';

  const valClass =
    valueTone === 'success'
      ? 'val-success'
      : valueTone === 'danger'
        ? 'val-danger'
        : valueTone === 'warning'
          ? 'val-warning'
          : valueTone === 'muted'
            ? 'val-muted'
            : '';

  const Tag = onClick ? 'button' : 'div';
  const extra = onClick ? { type: 'button' as const, onClick } : {};

  return (
    <Tag
      className={`dash-card module-${module} ${size} ${alertClass} ${onClick ? 'dash-card-link' : ''}`.trim()}
      {...extra}
    >
      <div className="dash-card-top">
        <span className="dash-card-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="dash-card-label">{label}</span>
      </div>
      <div className={`dash-card-value ${valClass}`.trim()}>{value}</div>
      {hint && <div className="dash-card-hint">{hint}</div>}
    </Tag>
  );
}
