import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  LayoutDashboard, Users, Building2, Kanban, CheckSquare, Settings, LogOut, Menu, X, Sparkles, Search, CalendarDays, FileText, TrendingUp, Zap, Moon, Sun, Command
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/properties', icon: Building2, label: 'Properties' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/sequences', icon: Zap, label: 'Sequences' },
  { to: '/analytics', icon: TrendingUp, label: 'Analytics' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/templates', icon: FileText, label: 'Templates' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const mobileNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/contacts?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const handler = (e) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      // Ctrl/Cmd + K → focus global search
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        searchRef.current?.focus();
      }

      // Ctrl/Cmd + N → navigate to contacts and signal "add new"
      if (e.key === 'n' || e.key === 'N') {
        // Only intercept if not in a text input / textarea
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        // Navigate to contacts with ?new=1 param to trigger the add dialog
        navigate('/contacts?new=1');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen bg-[#F9FAFB] dark:bg-slate-900 transition-colors duration-200" data-testid="app-layout">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-gray-900/40 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        {/* Sidebar */}
        <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 border-r border-slate-200 dark:border-slate-700 bg-[#F3F4F6] dark:bg-slate-800 flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`} data-testid="sidebar">
          <div className="flex items-center justify-between h-16 px-5 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-100 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-white dark:text-slate-900" />
              </div>
              <span className="font-heading text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">PropFlow</span>
            </div>
            <button className="md:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                  }`
                }
                data-testid={`sidebar-nav-${label.toLowerCase()}`}
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="px-3 py-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-600 flex items-center justify-center text-white text-xs font-semibold">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-md text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-400 transition-colors"
              data-testid="logout-button"
            >
              <LogOut className="w-4.5 h-4.5" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-16 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl flex items-center px-4 sm:px-6 gap-4 sticky top-0 z-30" data-testid="top-bar">
            <button className="md:hidden" onClick={() => setSidebarOpen(true)} data-testid="mobile-menu-toggle">
              <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <form onSubmit={handleSearch} className="flex-1 max-w-md">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <Input
                      ref={searchRef}
                      placeholder="Search contacts, deals..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-16 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 h-9 text-sm dark:text-slate-200 dark:placeholder:text-slate-500"
                      data-testid="global-search-input"
                    />
                    <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded">
                      {modKey}+K
                    </kbd>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Press <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-600 rounded text-[10px] font-mono">{modKey}+K</kbd> to search</p>
                </TooltipContent>
              </Tooltip>
            </form>
            <div className="flex items-center gap-1">
              {/* New Contact shortcut hint */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 gap-1.5 hidden sm:flex"
                    onClick={() => navigate('/contacts?new=1')}
                    data-testid="new-contact-shortcut"
                  >
                    <Users className="w-4 h-4" />
                    <kbd className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-600 border border-slate-200 dark:border-slate-500 px-1 py-0.5 rounded">{modKey}+N</kbd>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">New Contact</p>
                </TooltipContent>
              </Tooltip>

              {/* Dark mode toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleTheme}
                    className="h-9 w-9 p-0 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    data-testid="dark-mode-toggle"
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</p>
                </TooltipContent>
              </Tooltip>

              <Button variant="ghost" size="sm" className="text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 gap-1.5" data-testid="ai-assistant-button">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">AI</span>
              </Button>
            </div>
          </header>
          {/* Page content */}
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
            <Outlet />
          </main>
          {/* Mobile Bottom Navigation */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-40">
            <div className="flex items-center justify-around h-16 px-2">
              {mobileNavItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors ${
                      isActive
                        ? 'text-slate-900 dark:text-slate-100'
                        : 'text-slate-500 dark:text-slate-400'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </TooltipProvider>
  );
}
