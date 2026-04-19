import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeasingOverview } from '../hooks/useApi';
import {
  Users, Clock, TrendingUp, Home, Calendar as CalendarIcon, ArrowRight,
  ArrowUpRight, ArrowDownRight, MapPin, CheckCircle2, PhoneCall,
  Mail as MailIcon, MessageSquare, StickyNote, Wrench, FileSignature, Tag,
  ListTodo, Filter, RefreshCcw, Users2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AreaChart, Area, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmtNum = (n) =>
  typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—';
const fmtMoney = (n) =>
  typeof n === 'number'
    ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : '—';
const fmtPct = (n) => (typeof n === 'number' ? `${n.toFixed(1)}%` : '—');

function humanizeSpeed(hours) {
  if (hours == null || Number.isNaN(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(1)} hr`;
  return `${(hours / 24).toFixed(1)} d`;
}
function humanizeRelative(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const s = Math.floor(diffMs / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    const days = Math.floor(s / 86400);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}
function fmtTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity type → icon + color + label (leasing-centric)
// ─────────────────────────────────────────────────────────────────────────────
const ACTIVITY_META = {
  call:        { icon: PhoneCall,      label: 'Call',                 cls: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300' },
  email:       { icon: MailIcon,       label: 'Email',                cls: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' },
  sms:         { icon: MessageSquare,  label: 'SMS',                  cls: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' },
  note:        { icon: StickyNote,     label: 'Note',                 cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  meeting:     { icon: CalendarIcon,   label: 'Tour Booked',          cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
  maintenance: { icon: Wrench,         label: 'Maintenance Logged',   cls: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
  stage_change:{ icon: Tag,            label: 'Stage Change',         cls: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200' },
};

function inferActivityKind(a) {
  const desc = (a?.description || '').toLowerCase();
  if (desc.includes('application')) return { icon: FileSignature, label: 'Application Submitted', cls: 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300' };
  if (desc.includes('renewal')) return { icon: FileSignature, label: 'Renewal Sent', cls: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300' };
  if (desc.includes('maintenance')) return ACTIVITY_META.maintenance;
  if (desc.includes('tour')) return ACTIVITY_META.meeting;
  return ACTIVITY_META[a?.activity_type] || ACTIVITY_META.note;
}

// ─────────────────────────────────────────────────────────────────────────────
// Growth indicator
// ─────────────────────────────────────────────────────────────────────────────
function GrowthPill({ pct, lowerIsBetter = false }) {
  if (pct == null || Number.isNaN(pct) || pct === 0) {
    return <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">—</span>;
  }
  const isPositive = pct > 0;
  const isGood = lowerIsBetter ? !isPositive : isPositive;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  const colorCls = isGood
    ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
    : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded ${colorCls}`}>
      <Icon className="w-3 h-3" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini sparkline
// ─────────────────────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#2563EB', height = 40 }) {
  const safe = Array.isArray(data) && data.length > 0 ? data : [{ date: '', value: 0 }, { date: '', value: 0 }];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={safe} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" hide />
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <RTooltip
          cursor={false}
          contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#e2e8f0', padding: '4px 8px' }}
          labelStyle={{ color: '#94a3b8', fontSize: 10 }}
          formatter={(v) => [fmtNum(v), '']}
        />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#sg-${color})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Card shell
// ─────────────────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, growthPct, lowerIsBetter, sparkData, color = '#2563EB', onClick, children, testId }) {
  return (
    <button
      onClick={onClick}
      className="group text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all p-4 flex flex-col min-h-[150px]"
      data-testid={testId}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}1A`, color }}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</span>
        </div>
        {growthPct !== undefined && <GrowthPill pct={growthPct} lowerIsBetter={lowerIsBetter} />}
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums leading-none">{value}</span>
        {sub && <span className="text-xs text-slate-500 dark:text-slate-400">{sub}</span>}
      </div>
      {children && <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{children}</div>}
      <div className="mt-auto pt-2 -mx-1">
        {sparkData && sparkData.length > 0 ? (
          <Sparkline data={sparkData} color={color} height={40} />
        ) : (
          <div className="h-[40px]" />
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action-type badge for recent activity table
// ─────────────────────────────────────────────────────────────────────────────
function ActivityBadge({ activity }) {
  const meta = inferActivityKind(activity);
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
const RANGE_LABEL = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' };

export default function DashboardPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState('30d');
  const [scope, setScope] = useState('me');

  const { data, isLoading, error, refetch, isFetching } = useLeasingOverview(range, scope);

  const kpis = data?.kpis || {};
  const tours = data?.todays_action_items?.tours || [];
  const tasks = data?.todays_action_items?.tasks || [];
  const recent = data?.recent_activity || [];

  const inquiriesSpark = useMemo(
    () => (kpis.new_inquiries?.sparkline || []).map((p) => ({ date: p.date, value: p.value })),
    [kpis.new_inquiries]
  );
  const speedSpark = useMemo(
    () => (kpis.avg_speed_to_first_contact?.sparkline || []).map((p) => ({ date: p.date, value: p.value })),
    [kpis.avg_speed_to_first_contact]
  );
  const velocitySpark = useMemo(
    () => (kpis.lease_up_velocity?.sparkline || []).map((p) => ({ date: p.date, value: p.value })),
    [kpis.lease_up_velocity]
  );

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6" data-testid="dashboard-loading">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48" />
            <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded w-80" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[150px] bg-slate-200 dark:bg-slate-700 rounded-xl" />
            ))}
          </div>
          <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          <div className="h-72 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 sm:p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          Failed to load dashboard. Please try again.
        </div>
      </div>
    );
  }

  const renewals = kpis.upcoming_renewals || { d30: { count: 0, monthly_rent_total: 0 }, d60: { count: 0, monthly_rent_total: 0 }, d90: { count: 0, monthly_rent_total: 0 } };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6" data-testid="dashboard-page">
      {/* ── Header + Filters ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Residential leasing overview · {RANGE_LABEL[range] || range}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2" data-testid="dashboard-filters">
          {/* Scope toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => setScope('me')}
              className={`px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1 ${
                scope === 'me'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
              data-testid="scope-me-btn"
            >
              <Users className="w-3.5 h-3.5" /> Me
            </button>
            <button
              onClick={() => setScope('everyone')}
              className={`px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1 ${
                scope === 'everyone'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
              data-testid="scope-everyone-btn"
            >
              <Users2 className="w-3.5 h-3.5" /> Everyone
            </button>
          </div>

          {/* Range pills */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {['7d', '30d', '90d'].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium ${
                  range === r
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
                data-testid={`range-${r}-btn`}
              >
                {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-[34px]"
            data-testid="dashboard-refresh-btn"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── KPI Row (5 cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiCard
          icon={Users}
          label="New Inquiries / Tours"
          value={fmtNum(kpis.new_inquiries?.value ?? 0)}
          sub={`vs ${fmtNum(kpis.new_inquiries?.previous ?? 0)} prior`}
          growthPct={kpis.new_inquiries?.growth_pct}
          lowerIsBetter={false}
          sparkData={inquiriesSpark}
          color="#2563EB"
          onClick={() => navigate('/pipeline')}
          testId="kpi-new-inquiries"
        />

        <KpiCard
          icon={Clock}
          label="Speed to 1st Contact"
          value={humanizeSpeed(kpis.avg_speed_to_first_contact?.value_hours)}
          sub={kpis.avg_speed_to_first_contact?.sample_size ? `n=${kpis.avg_speed_to_first_contact.sample_size}` : 'no data'}
          growthPct={kpis.avg_speed_to_first_contact?.growth_pct}
          lowerIsBetter={true}
          sparkData={speedSpark}
          color="#A855F7"
          onClick={() => navigate('/contacts')}
          testId="kpi-speed-to-contact"
        />

        <KpiCard
          icon={TrendingUp}
          label="Lease-Up Velocity"
          value={
            kpis.lease_up_velocity?.value_days != null
              ? `${kpis.lease_up_velocity.value_days.toFixed(1)} d`
              : '—'
          }
          sub={kpis.lease_up_velocity?.sample_size ? `${kpis.lease_up_velocity.sample_size} signed` : 'no signed'}
          growthPct={kpis.lease_up_velocity?.growth_pct}
          lowerIsBetter={true}
          sparkData={velocitySpark}
          color="#10B981"
          onClick={() => navigate('/pipeline')}
          testId="kpi-lease-velocity"
        />

        <KpiCard
          icon={Home}
          label="Occupancy Rate"
          value={fmtPct(kpis.current_occupancy_rate?.value_pct)}
          sub={`${kpis.current_occupancy_rate?.units_occupied ?? 0} / ${kpis.current_occupancy_rate?.units_total ?? 0} units`}
          sparkData={[]}
          color="#F59E0B"
          onClick={() => navigate('/properties')}
          testId="kpi-occupancy"
        />

        {/* Upcoming Renewals — custom content (3 buckets) */}
        <button
          onClick={() => navigate('/contacts')}
          className="group text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all p-4 flex flex-col min-h-[150px]"
          data-testid="kpi-upcoming-renewals"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Upcoming Renewals</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {[
              { label: '30d', data: renewals.d30 },
              { label: '60d', data: renewals.d60 },
              { label: '90d', data: renewals.d90 },
            ].map(({ label, data: b }) => (
              <div key={label} className="rounded-md bg-slate-50 dark:bg-slate-700/50 p-2">
                <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">{label}</div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">{b?.count ?? 0}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">{fmtMoney(b?.monthly_rent_total || 0)}/mo</div>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-2 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <ArrowRight className="w-3 h-3" /> View renewal pipeline
          </div>
        </button>
      </div>

      {/* ── Today's Tours & Action Items ── */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden" data-testid="todays-action-items">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Today's Tours & Action Items
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {tours.length} tour{tours.length === 1 ? '' : 's'} · {tasks.length} task{tasks.length === 1 ? '' : 's'} due today
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate('/calendar')} className="text-xs">
            Open Calendar
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-700">
          {/* Tours column */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tours Today</span>
            </div>
            {tours.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic py-4 text-center">No tours scheduled today</p>
            ) : (
              <ul className="space-y-2" data-testid="tours-list">
                {tours.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                    onClick={() => t.contact_id && navigate(`/contacts/${t.contact_id}`)}
                  >
                    <div className="w-9 h-9 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center flex-shrink-0 text-[11px] font-semibold tabular-nums">
                      {fmtTime(t.start)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{t.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                        {t.contact_name && <span className="truncate">{t.contact_name}</span>}
                        {t.location && (
                          <>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="inline-flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3" />
                              {t.location}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tasks column */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ListTodo className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Action Items Due Today</span>
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic py-4 text-center">No tasks due today. You're all caught up 🎉</p>
            ) : (
              <ul className="space-y-2" data-testid="tasks-list">
                {tasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                    onClick={() => navigate('/tasks')}
                  >
                    <div
                      className={`w-1.5 rounded-full flex-shrink-0 self-stretch ${
                        t.priority === 'high'
                          ? 'bg-rose-500'
                          : t.priority === 'low'
                          ? 'bg-slate-300 dark:bg-slate-600'
                          : 'bg-amber-500'
                      }`}
                    />
                    <CheckCircle2 className="w-4 h-4 text-slate-300 dark:text-slate-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{t.title}</p>
                      {t.contact_name && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">For: {t.contact_name}</p>}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase flex-shrink-0 ${
                        t.priority === 'high'
                          ? 'border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20'
                          : t.priority === 'low'
                          ? 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                          : 'border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20'
                      }`}
                    >
                      {t.priority}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden" data-testid="recent-activity-section">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              Recent Activity
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Latest {recent.length} event{recent.length === 1 ? '' : 's'} · {RANGE_LABEL[range] || range}</p>
          </div>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 italic py-8 text-center px-5">
            No activity yet. Log a call, email, or note on a contact to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 text-left">Name</th>
                  <th className="px-4 py-2.5 text-left">Contact</th>
                  <th className="px-4 py-2.5 text-left">Last Activity</th>
                  <th className="px-4 py-2.5 text-left">Time</th>
                  <th className="px-4 py-2.5 text-left">Stage</th>
                  <th className="px-4 py-2.5 text-left">Assigned</th>
                  <th className="px-4 py-2.5 text-left">Unit / Property</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60" data-testid="recent-activity-rows">
                {recent.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                    onClick={() => a.contact_id && navigate(`/contacts/${a.contact_id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex-shrink-0">
                          {(a.contact_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[160px]">{a.contact_name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex flex-col gap-0.5">
                        {a.contact_email && <span className="truncate max-w-[180px]">{a.contact_email}</span>}
                        {a.contact_phone && <span className="text-slate-400 dark:text-slate-500">{a.contact_phone}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ActivityBadge activity={a} />
                      </div>
                      {a.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 max-w-[240px]">{a.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{humanizeRelative(a.created_at)}</td>
                    <td className="px-4 py-3">
                      {a.stage ? (
                        <Badge variant="outline" className="text-[10px] font-medium">{a.stage}</Badge>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 truncate max-w-[140px]">{a.assigned_to_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 truncate max-w-[180px]">{a.unit || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
