'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { navItemsForRole } from '@/lib/nav-items';

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const navItems = navItemsForRole(user.role);

  return (
    <aside
      className={`flex flex-col shrink-0 bg-sidebar text-white transition-[width] ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      <div
        data-testid="sidebar-header"
        className={`flex items-center gap-2 border-b border-white/10 px-4 py-4 ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent font-bold text-white">
          S
        </div>
        {!collapsed && <span className="font-bold">SariKo</span>}
      </div>

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={`flex items-center gap-2 border-b border-white/10 px-4 py-3 text-sm text-white/70 hover:text-white ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        ☰{!collapsed && <span>Collapse</span>}
      </button>

      <nav className="flex-1 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`mx-2 my-0.5 flex rounded-md px-3 py-2 text-sm font-medium ${
                isActive ? 'bg-sidebar-active text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span
                data-testid={`nav-item-content-${item.label}`}
                className={collapsed ? 'flex w-full justify-center' : 'flex items-center gap-3'}
              >
                <span>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </span>
            </Link>
          );
        })}
      </nav>

      <div
        data-testid="sidebar-footer"
        className={`flex items-center gap-2 border-t border-white/10 p-2.5 ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        <Link
          href="/profile"
          aria-label={`${user.username} — ${user.role}`}
          className={`flex flex-1 items-center gap-2 rounded-md p-1.5 hover:bg-white/5 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold uppercase">
            {user.username[0]}
          </span>
          {!collapsed && (
            <span className="overflow-hidden">
              <span className="block truncate text-sm font-semibold">{user.username}</span>
              <span className="block text-xs capitalize text-white/60">{user.role.replace('_', ' ')}</span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={logout}
            aria-label="Log out"
            className="shrink-0 rounded-md p-1.5 text-white/60 hover:bg-white/5 hover:text-white"
          >
            ⎋
          </button>
        )}
      </div>
    </aside>
  );
}
