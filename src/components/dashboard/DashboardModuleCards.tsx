import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { DASHBOARD_MODULES, filterDashboardModules } from '@/types/navigation';
import './DashboardModuleCards.css';

export default function DashboardModuleCards() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const modules = useMemo(
    () => filterDashboardModules(DASHBOARD_MODULES, hasPermission),
    [hasPermission]
  );

  if (!modules.length) return null;

  const go = (path: string, search?: string) => {
    navigate(search ? { pathname: path, search } : path);
  };

  return (
    <section className="dashboard-modules">
      <div className="dashboard-modules-title">Ana Modüller</div>
      <div className="dashboard-modules-grid">
        {modules.map((mod) => (
          <div key={mod.id} className="module-card">
            <div className="module-card-head">
              <span className="module-card-icon">{mod.icon}</span>
              <div>
                <div className="module-card-title">{mod.title}</div>
                <div className="module-card-desc">{mod.description}</div>
              </div>
            </div>
            <div className="module-card-links">
              {mod.quickLinks.map((link) => (
                <button
                  key={`${link.path}${link.search || ''}-${link.label}`}
                  type="button"
                  className="module-quick-link"
                  onClick={() => go(link.path, link.search)}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
