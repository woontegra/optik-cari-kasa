import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { getModuleForPath, MODULE_LABELS, type ModuleId } from '@/theme/modules';

interface PageTitleBarProps {
  title: string;
  module?: ModuleId | null;
  children?: ReactNode;
}

export default function PageTitleBar({ title, module, children }: PageTitleBarProps) {
  const location = useLocation();
  const mod = module === undefined ? getModuleForPath(location.pathname) : module;

  return (
    <div className="page-title-bar">
      <div className="page-title-left">
        {mod && <span className={`module-badge module-${mod}`}>{MODULE_LABELS[mod]}</span>}
        <h2 className="page-title">{title}</h2>
      </div>
      {children}
    </div>
  );
}
