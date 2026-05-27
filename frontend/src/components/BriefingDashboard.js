import React from 'react';
import { Sparkles, AlertCircle, CheckCircle2, Inbox, DollarSign, Users, ListTodo, Zap, MessageSquare, ChevronRight } from 'lucide-react';
import { useElaraBriefing } from '../hooks/useElara';
import { useElaraUI } from '../contexts/ElaraContext';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Link } from 'react-router-dom';

/**
 * Daily Briefing Dashboard widget — top of the /elara command center.
 * Shows: greeting, 6 KPI tiles, top 3 priorities, mood indicator.
 */
export default function BriefingDashboard({ onAskElara }) {
  const { data, isLoading, isError, refetch } = useElaraBriefing(true);
  const { openDrawer, setPendingPrompt } = useElaraUI();

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="briefing-dashboard-loading">
        <div className="h-28 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/60 p-4 flex items-start gap-3" data-testid="briefing-dashboard-error">
        <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-rose-900 dark:text-rose-200">Could not load briefing</p>
          <Button size="sm" variant="outline" className="mt-2 h-8 text-[12px]" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  const { greeting, mood, mood_label, stats = {}, priorities = [] } = data;

  const moodColor = mood === 'busy'
    ? 'from-rose-500 to-amber-500'
    : mood === 'steady'
    ? 'from-brand to-teal-600'
    : 'from-emerald-500 to-teal-500';

  const tiles = [
    { id: 'tasks_due', label: 'Tasks today', value: stats.tasks_due_today || 0, icon: ListTodo, accent: 'text-brand', to: '/tasks' },
    { id: 'overdue', label: 'Overdue', value: stats.tasks_overdue || 0, icon: AlertCircle, accent: 'text-rose-500', urgent: (stats.tasks_overdue || 0) > 0, to: '/tasks' },
    { id: 'unread', label: 'Unread inbox', value: stats.unread_messages || 0, icon: Inbox, accent: 'text-amber-600', to: '/inbox' },
    { id: 'deals', label: 'Open deals', value: stats.open_deals || 0, icon: DollarSign, accent: 'text-emerald-600', sub: stats.open_deals_value ? `$${formatNum(stats.open_deals_value)}` : '', to: '/pipeline' },
    { id: 'contacts', label: 'Contacts', value: stats.total_contacts || 0, icon: Users, accent: 'text-slate-600 dark:text-slate-300', sub: stats.stale_contacts ? `${stats.stale_contacts} stale` : '', to: '/contacts' },
    { id: 'approvals', label: 'Approvals', value: stats.approvals_pending || 0, icon: Zap, accent: 'text-purple-600', urgent: (stats.approvals_pending || 0) > 0 },
  ];

  const askElara = (prompt) => {
    if (onAskElara) onAskElara(prompt);
    else { setPendingPrompt(prompt); openDrawer(); }
  };

  return (
    <div className="space-y-4" data-testid="briefing-dashboard">
      {/* Greeting card */}
      <div className={`rounded-xl bg-gradient-to-br ${moodColor} text-white p-5 shadow-premium dark:shadow-premium-xl relative overflow-hidden`} data-testid="briefing-greeting-card">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,white,transparent_50%)]" />
        <div className="relative flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-white/20 text-white border-0 text-[10px] uppercase tracking-wider font-bold">{mood_label}</Badge>
            </div>
            <p className="text-[14px] leading-relaxed font-medium" data-testid="briefing-greeting-text">{greeting}</p>
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5" data-testid="briefing-kpis">
        {tiles.map((t) => {
          const Icon = t.icon;
          const inner = (
            <div className={`bg-white dark:bg-slate-800 border ${t.urgent ? 'border-rose-300 dark:border-rose-700/60' : 'border-slate-200 dark:border-slate-700/60'} rounded-lg p-3 hover:shadow-premium hover:border-brand/30 transition-all duration-200 h-full`} data-testid={`briefing-kpi-${t.id}`}>
              <div className="flex items-center justify-between mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${t.accent}`} />
                {t.urgent && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
              </div>
              <p className="text-[20px] font-bold text-slate-900 dark:text-slate-100 leading-none">{t.value}</p>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">{t.label}</p>
              {t.sub && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{t.sub}</p>}
            </div>
          );
          return t.to ? (
            <Link key={t.id} to={t.to} className="block">{inner}</Link>
          ) : (
            <div key={t.id}>{inner}</div>
          );
        })}
      </div>

      {/* Top priorities */}
      {priorities.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4" data-testid="briefing-priorities">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900 dark:text-slate-100">Today's top priorities</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Elara picked these from your tasks &amp; inbox.</p>
            </div>
            <Badge className="bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-ring border-0 text-[10px] font-bold">{priorities.length}</Badge>
          </div>
          <div className="space-y-2">
            {priorities.map((p, i) => (
              <div
                key={p.id || i}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/40 hover:border-brand/30 transition group"
                data-testid={`briefing-priority-${i}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                  p.type === 'task_overdue' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' :
                  p.priority === 'high' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                  'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate">{p.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.type === 'task_overdue' && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold uppercase">Overdue</span>}
                    {p.type === 'task_today' && <span className="text-[10px] text-brand font-semibold uppercase">Due today</span>}
                    {p.priority && <Badge className="text-[9px] px-1.5 py-0 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-0">{p.priority}</Badge>}
                    {p.due_at && <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatDateTime(p.due_at)}</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10.5px] text-brand hover:bg-brand/10 opacity-0 group-hover:opacity-100 transition"
                  onClick={() => askElara(`Help me work through this: ${p.title}`)}
                  data-testid={`briefing-priority-ask-${i}`}
                >
                  Ask Elara <ChevronRight className="w-3 h-3 ml-0.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick prompts */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4" data-testid="briefing-quick-prompts">
        <h3 className="text-[13px] font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-brand" /> Ask Elara
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { id: 'q1', t: 'Summarize my pipeline & what to push forward' },
            { id: 'q2', t: 'Draft a warm follow-up SMS to my hottest lead' },
            { id: 'q3', t: "Who's gone cold and needs re-engagement?" },
            { id: 'q4', t: 'What renewals are coming up in the next 60 days?' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => askElara(p.t)}
              className="text-left text-[12px] font-medium px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:border-brand/40 hover:bg-brand/5 dark:hover:bg-brand/10 transition"
              data-testid={`briefing-prompt-${p.id}`}
            >
              {p.t}
            </button>
          ))}
        </div>
      </div>

      {/* Caught-up state */}
      {(stats.tasks_due_today || 0) === 0 && (stats.tasks_overdue || 0) === 0 && (stats.unread_messages || 0) === 0 && (stats.approvals_pending || 0) === 0 && (
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800/60 p-4 flex items-center gap-3" data-testid="briefing-caught-up">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-emerald-900 dark:text-emerald-200">You're all caught up.</p>
            <p className="text-[11.5px] text-emerald-700 dark:text-emerald-300">Great time to prospect, learn the market, or build a new sequence.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatNum(n) {
  const num = Number(n) || 0;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}k`;
  return num.toLocaleString();
}

function formatDateTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
