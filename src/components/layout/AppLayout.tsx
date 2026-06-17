import { Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import SidebarNav from './SidebarNav';
import './AppLayout.css';

export default function AppLayout() {
  const { session, logout } = useAuth();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-title">Woontegra</div>
          <div className="brand-sub">Optik Desktop</div>
        </div>
        <SidebarNav />
        <div className="sidebar-footer">v1.0.0</div>
      </aside>
      <div className="main-area">
        <header className="app-header">
          <div className="header-left">
            <span className="header-title">Woontegra Optik Desktop</span>
          </div>
          <div className="header-right">
            <span className="header-user">
              {session?.fullName || session?.username}
              {session?.role ? <span className="header-role"> ({session.role})</span> : null}
            </span>
            <button type="button" className="btn btn-sm" onClick={() => logout()}>
              Çıkış
            </button>
            <span className="header-date">
              {new Date().toLocaleDateString('tr-TR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
