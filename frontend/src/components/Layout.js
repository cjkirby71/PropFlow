import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useElaraUI } from '../contexts/ElaraContext';
import ElaraDrawer from './ElaraDrawer';
import {
  LayoutDashboard, Users, Building2, Kanban, CheckSquare, Settings, LogOut, Menu, X, Sparkles, Search, CalendarDays, FileText, TrendingUp, Zap, Moon, Sun, Command, Inbox as InboxIcon
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/inbox', icon: InboxIcon, label: 'Inbox' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/properties', icon: Building2, label: 'Properties' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/sequences', icon: Zap, label: 'Sequences' },
  { to: '/analytics', icon: TrendingUp, label: 'Analytics' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/templates', icon: FileText, label: 'Templates' },
  { to: '/elara', icon: Sparkles, label: 'Elara' },
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
  const { openDrawer } = useElaraUI();
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
      <div className="flex h-screen bg-[#F7F9FB] dark:bg-slate-900 transition-colors duration-200" data-testid="app-layout">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        {/* Sidebar */}
        <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 border-r border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/95 backdrop-blur-sm flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`} data-testid="sidebar">
          <div className="flex items-center justify-between h-[68px] px-5 border-b border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-teal-700 flex items-center justify-center shadow-premium">
                <Building2 className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-heading text-[18px] font-bold text-slate-900 dark:text-slate-100 tracking-tight">PropFlow</span>
            </div>
            <button className="md:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>
          <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-ring'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`
                }
                data-testid={`sidebar-nav-${label.toLowerCase()}`}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-brand" aria-hidden="true" />
                    )}
                    <Icon className={`w-4.5 h-4.5 flex-shrink-0 transition-transform ${isActive ? 'text-brand dark:text-brand-ring' : 'group-hover:scale-110'}`} strokeWidth={isActive ? 2.5 : 2} />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="px-3 py-4 border-t border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
              <div className="avatar-ring w-9 h-9 text-[13px]" style={{ fontFamily: "'Cabinet Grotesk', 'IBM Plex Sans', sans-serif" }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.name || 'User'}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-[13px] font-medium text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-700 dark:hover:text-rose-400 transition-all duration-200"
              data-testid="logout-button"
            >
              <LogOut className="w-4.5 h-4.5" strokeWidth={2} />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-[68px] border-b border-slate-200 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-xl flex items-center px-4 sm:px-6 gap-4 sticky top-0 z-30" data-testid="top-bar">
            <button className="md:hidden" onClick={() => setSidebarOpen(true)} data-testid="mobile-menu-toggle">
              <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <form onSubmit={handleSearch} className="flex-1 max-w-md">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-brand transition-colors" />
                    <Input
                      ref={searchRef}
                      placeholder="Search contacts, deals..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-16 bg-slate-50 dark:bg-slate-700/60 border-slate-200 dark:border-slate-600/70 h-10 text-sm rounded-lg dark:text-slate-200 dark:placeholder:text-slate-500 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
                      data-testid="global-search-input"
                    />
                    <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-600/60 border border-slate-200 dark:border-slate-500/60 rounded shadow-sm">
                      {modKey}+K
                    </kbd>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Press <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-600 rounded text-[10px] font-mono">{modKey}+K</kbd> to search</p>
                </TooltipContent>
              </Tooltip>
            </form>
            <div className="flex items-center gap-1.5">
              {/* New Contact shortcut hint */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 gap-1.5 hidden sm:flex h-9 rounded-lg"
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
                    className="h-9 w-9 p-0 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-brand dark:hover:text-brand-ring"
                    data-testid="dark-mode-toggle"
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</p>
                </TooltipContent>
              </Tooltip>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => openDrawer()}
                className="gap-1.5 h-9 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 text-amber-700 dark:text-amber-300 hover:from-amber-100 hover:to-amber-200 dark:hover:from-amber-900/30 dark:hover:to-amber-900/20 hover:shadow-sm border border-amber-200/60 dark:border-amber-700/40"
                data-testid="ai-assistant-button"
                title="Ask Elara"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-semibold">Ask Elara</span>
              </Button>
            </div>
          </header>
          {/* Page content */}
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
            <Outlet />
          </main>
          {/* Mobile Bottom Navigation */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-700/60 z-40 shadow-premium-xl">
            <div className="flex items-center justify-around h-16 px-2">
              {mobileNavItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-all duration-200 ${
                      isActive
                        ? 'text-brand dark:text-brand-ring'
                        : 'text-slate-500 dark:text-slate-400'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} strokeWidth={isActive ? 2.5 : 2} />
                      <span className="text-[11px] font-semibold">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
        {/* Floating Elara drawer (global, only inside auth'd layout) */}
        <ElaraDrawer />
      </div>
    </TooltipProvider>
  );
}
