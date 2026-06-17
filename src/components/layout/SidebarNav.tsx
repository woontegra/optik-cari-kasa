import { useCallback, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  MENU_GROUPS,
  filterVisibleMenuGroups,
  findActiveMenuGroup,
  isMenuItemActive,
  menuItemKey,
  type MenuItemDef,
} from '@/types/navigation';

const STORAGE_KEY = 'woontegra_sidebar_collapsed';

function loadCollapsedGroups(allGroupIds: string[]): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    /* ignore */
  }
  return new Set(allGroupIds.filter((id) => id !== 'home'));
}

function saveCollapsedGroups(collapsed: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]));
}

function itemTo(item: MenuItemDef) {
  if (item.search) {
    return { pathname: item.path, search: item.search };
  }
  return item.path;
}

export default function SidebarNav() {
  const { hasPermission } = useAuth();
  const location = useLocation();
  const visibleGroups = useMemo(
    () => filterVisibleMenuGroups(MENU_GROUPS, hasPermission),
    [hasPermission]
  );

  const activeGroupId = useMemo(
    () => findActiveMenuGroup(location.pathname, location.search, visibleGroups),
    [location.pathname, location.search, visibleGroups]
  );

  const groupIds = useMemo(() => visibleGroups.map((g) => g.id), [visibleGroups]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() =>
    loadCollapsedGroups(groupIds)
  );

  const isExpanded = useCallback(
    (groupId: string) => !collapsedGroups.has(groupId),
    [collapsedGroups]
  );

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      saveCollapsedGroups(next);
      return next;
    });
  };

  return (
    <nav className="sidebar-nav">
      {visibleGroups.map((group) => {
        const expanded = isExpanded(group.id);
        const groupActive = activeGroupId === group.id;
        const singleItem = group.items.length === 1 && group.id === 'home';

        if (singleItem) {
          const item = group.items[0];
          return (
            <NavLink
              key={group.id}
              to={itemTo(item)}
              className={({ isActive }) =>
                `nav-item nav-item-top${isActive || isMenuItemActive(location.pathname, location.search, item) ? ' active' : ''}`
              }
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          );
        }

        return (
          <div key={group.id} className={`nav-group${groupActive ? ' nav-group-active' : ''}`}>
            <button
              type="button"
              className={`nav-group-header${expanded ? ' expanded' : ''}`}
              onClick={() => toggleGroup(group.id)}
              aria-expanded={expanded}
            >
              <span className="nav-group-left">
                <span className="nav-icon">{group.icon}</span>
                <span className="nav-group-label">{group.label}</span>
              </span>
              <span className="nav-chevron">{expanded ? '▾' : '▸'}</span>
            </button>
            {expanded && (
              <div className="nav-group-items">
                {group.items.map((item) => (
                  <NavLink
                    key={menuItemKey(item)}
                    to={itemTo(item)}
                    className={() =>
                      `nav-item nav-item-child${
                        isMenuItemActive(location.pathname, location.search, item) ? ' active' : ''
                      }`
                    }
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
