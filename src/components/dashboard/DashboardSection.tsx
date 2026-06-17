import { useEffect, useState, type ReactNode } from 'react';
import type { ModuleId } from '@/theme/modules';

const STORAGE_KEY = 'woontegra_dashboard_sections';

function loadExpanded(sectionId: string, defaultOpen: boolean): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      if (typeof parsed[sectionId] === 'boolean') return parsed[sectionId];
    }
  } catch {
    /* ignore */
  }
  return defaultOpen;
}

function saveExpanded(sectionId: string, open: boolean) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    parsed[sectionId] = open;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

interface DashboardSectionProps {
  id: string;
  title: string;
  defaultOpen?: boolean;
  tone?: ModuleId;
  children: ReactNode;
}

export default function DashboardSection({ id, title, defaultOpen = true, tone = 'home', children }: DashboardSectionProps) {
  const [open, setOpen] = useState(() => loadExpanded(id, defaultOpen));

  useEffect(() => {
    saveExpanded(id, open);
  }, [id, open]);

  return (
    <section className={`dashboard-section section-tone-${tone}`}>
      <div className="dashboard-section-header" onClick={() => setOpen((v) => !v)} role="button" tabIndex={0}>
        <h3>
          <span className={`section-tone-dot module-${tone}`} aria-hidden="true" />
          {title}
        </h3>
        <button type="button" className="dashboard-section-toggle" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
          {open ? 'Gizle ▴' : 'Göster ▾'}
        </button>
      </div>
      {open && <div className="dashboard-section-body">{children}</div>}
    </section>
  );
}
