import React, { useState } from 'react';
import { Activity, Search, Send, Eye, Plus, RefreshCw, Bot, Brain, AlertCircle, FileText, CheckCircle2, Cog, Inbox } from 'lucide-react';
import { useElaraActivity } from '../hooks/useElara';

const CATEGORY_META = {
  search: { icon: Search, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300' },
  create: { icon: Plus, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300' },
  update: { icon: RefreshCw, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300' },
  send: { icon: Send, color: 'text-brand bg-brand/10 dark:bg-brand/20 dark:text-brand-ring' },
  note: { icon: FileText, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300' },
  view: { icon: Eye, color: 'text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-300' },
  memory: { icon: Brain, color: 'text-fuchsia-600 bg-fuchsia-100 dark:bg-fuchsia-900/30 dark:text-fuchsia-300' },
  llm: { icon: Bot, color: 'text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300' },
  approval: { icon: CheckCircle2, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300' },
  system: { icon: Cog, color: 'text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-300' },
};

/**
 * Crew Activity Feed — what Elara (and external agents on this tenant) have done.
 */
export default function CrewActivityFeed({ variant = 'full', limit = 25 }) {
  const [filter, setFilter] = useState('all');
  const { data, isLoading, refetch, isFetching } = useElaraActivity({ limit, category: filter === 'all' ? undefined : filter });
  const items = data?.items || [];

  const compact = variant === 'compact';

  return (
    <div className={compact ? '' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4'} data-testid="crew-activity-feed">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-brand" /> Crew activity
            {isFetching && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
          </h3>
          {!compact && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Recent actions by Elara and any external agents using your service tokens.</p>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="text-[10.5px] text-slate-500 dark:text-slate-400 hover:text-brand px-1.5 py-0.5 rounded transition flex-shrink-0"
          title="Refresh"
          data-testid="crew-activity-refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1 scroll-thin">
        {[
          { id: 'all', label: 'All' },
          { id: 'llm', label: 'AI chat' },
          { id: 'send', label: 'Outreach' },
          { id: 'create', label: 'Created' },
          { id: 'update', label: 'Updated' },
          { id: 'memory', label: 'Memory' },
          { id: 'approval', label: 'Approvals' },
        ].map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={`text-[10.5px] font-semibold px-2 py-1 rounded-full transition whitespace-nowrap ${
              filter === c.id
                ? 'bg-brand text-white'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            data-testid={`crew-activity-filter-${c.id}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (<div key={i} className="h-14 bg-slate-100 dark:bg-slate-700/60 rounded-lg animate-pulse" />))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8" data-testid="crew-activity-empty">
          <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-[12px] text-slate-500 dark:text-slate-400">No activity yet.</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Use Elara to start working — your crew's actions show here.</p>
        </div>
      ) : (
        <ul className="space-y-1" data-testid="crew-activity-list">
          {items.map((a) => {
            const meta = CATEGORY_META[a.category] || CATEGORY_META.system;
            const Icon = meta.icon;
            const failed = a.status !== 'ok';
            return (
              <li
                key={a.id}
                className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/40 transition"
                data-testid={`crew-activity-item-${a.id}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${failed ? 'text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300' : meta.color}`}>
                  {failed ? <AlertCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">{a.label}</span>
                    {a.target_name && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">·&nbsp;{a.target_name}</span>
                    )}
                    {failed && (<span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold uppercase">Failed</span>)}
                  </div>
                  {a.summary && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-snug">{a.summary}</p>
                  )}
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{formatRelative(a.created_at)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatRelative(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch { return ''; }
}
