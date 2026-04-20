import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  LayoutGrid, Users, Building2, Radio, Phone, Megaphone, FileSignature,
  TrendingUp, Target, Download, HelpCircle, Calendar, Sparkles, ChevronDown,
  Mail, MessageSquare, CheckCheck, ArrowUpRight, ArrowDownRight, Minus, School,
  LineChart as LineIcon, BarChart3, DollarSign, Activity, Home, Shield,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, Cell,
} from 'recharts';
import { useLeasingReport, useBenchmarks } from '../hooks/useApi';
import api from '../lib/api';

// ═══════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'overview',       label: 'Overview',             icon: LayoutGrid },
  { id: 'agents',         label: 'Agent Activity',       icon: Users },
  { id: 'properties',     label: 'Properties & Units',   icon: Building2 },
  { id: 'sources',        label: 'Lead Sources',         icon: Radio },
  { id: 'calls_texts',    label: 'Calls & Texts',        icon: Phone },
  { id: 'marketing',      label: 'Marketing',            icon: Megaphone },
  { id: 'applications',   label: 'Lease Applications',   icon: FileSignature },
  { id: 'renewals',       label: 'Renewals & Retention', icon: TrendingUp },
  { id: 'goals',          label: 'Agent Goals',          icon: Target },
  { id: 'benchmarks',     label: 'Network Benchmarks',   icon: Shield, admin: true },
];

const RANGES = [
  { id: '7d',              label: 'Last 7 days' },
  { id: '30d',             label: 'Last 30 days' },
  { id: '60d',             label: 'Last 60 days' },
  { id: '90d',             label: 'Last 90 days' },
  { id: 'fall_preseason',  label: 'Fall Pre-Lease Season' },
];

// ── Shared shells ─────────────────────────────────────────────────────────
function Card({ children, className = '', testid }) {
  return (
    <div data-testid={testid} className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-sm dark:shadow-premium p-5 ${className}`}>
      {children}
    </div>
  );
}

function KPI({ label, value, delta, icon: Icon, accent = 'text-brand', suffix = '' }) {
  const up = delta > 0;
  const down = delta < 0;
  return (
    <Card testid={`kpi-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="relative overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className="font-heading text-[28px] font-bold text-slate-900 dark:text-slate-100 mt-1.5 leading-none">
            {value}<span className="text-[16px] ml-0.5 text-slate-500 dark:text-slate-400">{suffix}</span>
          </p>
        </div>
        {Icon && (
          <div className={`w-9 h-9 rounded-lg bg-brand/10 dark:bg-brand/20 flex items-center justify-center ${accent}`}>
            <Icon className="w-4 h-4" strokeWidth={2.5} />
          </div>
        )}
      </div>
      {delta != null && (
        <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold">
          {up && <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" /> +{Math.abs(delta)}%</span>}
          {down && <span className="text-rose-600 dark:text-rose-400 inline-flex items-center gap-0.5"><ArrowDownRight className="w-3 h-3" /> -{Math.abs(delta)}%</span>}
          {!up && !down && <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-0.5"><Minus className="w-3 h-3" /> flat</span>}
          <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">vs previous period</span>
        </div>
      )}
    </Card>
  );
}

function SectionTitle({ children, desc }) {
  return (
    <div className="mb-3 mt-6 first:mt-0">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">{children}</h4>
      {desc && <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 px-1">{desc}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const [tab, setTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30d');
  const [scope, setScope] = useState('me');
  const [zone, setZone] = useState('all');
  const [showHelp, setShowHelp] = useState(false);

  const { data: report, isLoading } = useLeasingReport({ dateRange, scope });
  const { data: bench } = useBenchmarks({ dateRange, universityZone: zone });

  const handleExport = async () => {
    try {
      const res = await api.get('/reports/leasing/export.csv', {
        params: { date_range: dateRange, scope },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leasing_report_${dateRange}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report exported');
    } catch { toast.error('Export failed'); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto space-y-5" data-testid="analytics-page">
      {/* Header + controls */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Reporting</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Leasing performance, agent activity, and network benchmarks</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" className="h-9 text-[12px]" onClick={() => setShowHelp(true)} data-testid="how-reporting-works">
            <HelpCircle className="w-3.5 h-3.5 mr-1.5" /> How reporting works
          </Button>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="h-9 w-[110px] text-[12px]" data-testid="scope-select"><Users className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="me">Just me</SelectItem>
              <SelectItem value="everyone">Whole team</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="h-9 w-[170px] text-[12px]" data-testid="range-select"><Calendar className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-9 text-[12px]" onClick={handleExport} data-testid="export-button">
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 border-b border-slate-200 dark:border-slate-700/60 overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8" data-testid="analytics-tabs">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-[12px] sm:text-[13px] font-semibold border-b-2 whitespace-nowrap transition ${
                active
                  ? 'border-brand text-brand dark:text-brand-ring'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              data-testid={`analytics-tab-${t.id}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.admin && <Badge className="ml-1 text-[9px] border-0 bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-ring">Beta</Badge>}
            </button>
          );
        })}
      </div>

      {tab === 'overview'     && <OverviewTab report={report} isLoading={isLoading} />}
      {tab === 'agents'       && <AgentsTab report={report} />}
      {tab === 'properties'   && <PropertiesTab report={report} />}
      {tab === 'sources'      && <SourcesTab report={report} />}
      {tab === 'calls_texts'  && <CallsTextsTab report={report} />}
      {tab === 'marketing'    && <MarketingTab />}
      {tab === 'applications' && <ApplicationsTab report={report} />}
      {tab === 'renewals'     && <RenewalsTab report={report} />}
      {tab === 'goals'        && <GoalsTab report={report} />}
      {tab === 'benchmarks'   && <BenchmarksTab bench={bench} zone={zone} setZone={setZone} />}

      <HowReportingDialog open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════
function OverviewTab({ report, isLoading }) {
  if (isLoading) return <SkeletonGrid />;
  const ov = report?.overview || {};
  return (
    <div className="space-y-6" data-testid="overview-tab">
      <SectionTitle desc="Key leasing metrics across the selected period">Overview</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="New contacts"     value={ov.new_contacts ?? 0}   icon={Users}        />
        <KPI label="Signed leases"    value={ov.signed_leases ?? 0}  icon={CheckCheck}   accent="text-emerald-600 dark:text-emerald-400" />
        <KPI label="Occupancy rate"   value={ov.occupancy_rate ?? 0} icon={Home}         suffix="%" />
        <KPI label="Pipeline value"   value={'$' + (ov.pipeline_value || 0).toLocaleString()} icon={DollarSign} accent="text-amber-600 dark:text-amber-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card testid="velocity-chart">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[14px] font-bold text-slate-900 dark:text-slate-100">Lead velocity</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">New contacts per week (last 8 weeks)</p>
            </div>
            <LineIcon className="w-4 h-4 text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={ov.velocity || []}>
              <defs>
                <linearGradient id="velocityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0F766E" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#0F766E" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
              <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 12, color: '#f1f5f9' }} />
              <Area type="monotone" dataKey="count" stroke="#0F766E" strokeWidth={2} fill="url(#velocityGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card testid="funnel-chart">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[14px] font-bold text-slate-900 dark:text-slate-100">Lease application funnel</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Inquiry → Lease Signed</p>
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={report?.applications_funnel || []} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" horizontal={false} />
              <XAxis type="number" stroke="#94a3b8" fontSize={11} />
              <YAxis dataKey="stage" type="category" stroke="#94a3b8" fontSize={11} width={130} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 12, color: '#f1f5f9' }} />
              <Bar dataKey="count" fill="#0F766E" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENTS
// ═══════════════════════════════════════════════════════════════════════════
function AgentsTab({ report }) {
  const agents = report?.agents || [];
  return (
    <div className="space-y-4" data-testid="agents-tab">
      <SectionTitle desc="Activity rollup per agent across the selected period">Agent activity</SectionTitle>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/60 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="text-left py-2 px-2 font-semibold">Agent</th>
                <th className="text-right py-2 px-2 font-semibold">Calls</th>
                <th className="text-right py-2 px-2 font-semibold">Emails</th>
                <th className="text-right py-2 px-2 font-semibold">SMS</th>
                <th className="text-right py-2 px-2 font-semibold">Meetings</th>
                <th className="text-right py-2 px-2 font-semibold">Notes</th>
                <th className="text-right py-2 px-2 font-semibold">Leases signed</th>
                <th className="text-right py-2 px-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 && (
                <tr><td colSpan="8" className="py-8 text-center text-slate-500 dark:text-slate-400">No agent activity recorded in this range.</td></tr>
              )}
              {agents.map(a => (
                <tr key={a.user_id} className="border-b border-slate-100 dark:border-slate-700/40 hover:bg-slate-50/60 dark:hover:bg-slate-900/40" data-testid={`agent-row-${a.user_id}`}>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand/15 dark:bg-brand/25 text-brand dark:text-brand-ring font-bold text-[11px] flex items-center justify-center">
                        {(a.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{a.name}</span>
                    </div>
                  </td>
                  <td className="text-right py-2.5 px-2 text-slate-700 dark:text-slate-300">{a.calls}</td>
                  <td className="text-right py-2.5 px-2 text-slate-700 dark:text-slate-300">{a.emails}</td>
                  <td className="text-right py-2.5 px-2 text-slate-700 dark:text-slate-300">{a.sms}</td>
                  <td className="text-right py-2.5 px-2 text-slate-700 dark:text-slate-300">{a.meetings}</td>
                  <td className="text-right py-2.5 px-2 text-slate-700 dark:text-slate-300">{a.notes}</td>
                  <td className="text-right py-2.5 px-2 font-bold text-emerald-600 dark:text-emerald-400">{a.leases_signed}</td>
                  <td className="text-right py-2.5 px-2 font-bold text-slate-900 dark:text-slate-100">{a.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTIES & UNITS
// ═══════════════════════════════════════════════════════════════════════════
function PropertiesTab({ report }) {
  const props = report?.properties || [];
  const ov = report?.overview || {};
  return (
    <div className="space-y-4" data-testid="properties-tab">
      <SectionTitle desc="Inventory health, occupancy, and velocity">Properties & units</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Total units"        value={ov.total_properties ?? 0} icon={Building2} />
        <KPI label="Active listings"    value={ov.active_listings ?? 0}  icon={Home} />
        <KPI label="Occupancy"          value={ov.occupancy_rate ?? 0}   icon={CheckCheck} suffix="%" accent="text-emerald-600 dark:text-emerald-400" />
        <KPI label="Vacancy cost / day" value={'$' + (report?.vacancy_days_cost || 0).toLocaleString()} icon={DollarSign} accent="text-rose-600 dark:text-rose-400" />
      </div>
      <Card>
        <h3 className="text-[13px] font-bold text-slate-900 dark:text-slate-100 mb-3">Recent properties</h3>
        {props.length === 0 ? (
          <p className="text-[12px] text-slate-500 dark:text-slate-400 py-6 text-center">No properties yet. Add listings on the Properties page.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {props.slice(0, 10).map(p => (
              <li key={p.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] border-0 ${
                    p.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                    p.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}>{p.status}</Badge>
                  <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300">${(p.price || 0).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCES
// ═══════════════════════════════════════════════════════════════════════════
function SourcesTab({ report }) {
  const sources = report?.sources || [];
  const signedBy = report?.signed_by_source || [];
  return (
    <div className="space-y-4" data-testid="sources-tab">
      <SectionTitle desc="Where leads come from and which sources convert">Lead sources</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-[13px] font-bold text-slate-900 dark:text-slate-100 mb-3">Source report</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sources.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
              <XAxis dataKey="source" stroke="#94a3b8" fontSize={10} interval={0} angle={-25} textAnchor="end" height={60} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 12, color: '#f1f5f9' }} />
              <Bar dataKey="count" fill="#0F766E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="text-[13px] font-bold text-slate-900 dark:text-slate-100 mb-3">Signed leases by source</h3>
          {signedBy.length === 0 ? (
            <p className="text-[12px] text-slate-500 dark:text-slate-400 py-6 text-center">No signed leases yet in this range.</p>
          ) : (
            <ul className="space-y-1.5">
              {signedBy.map(s => (
                <li key={s.source} className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 w-28">{s.source}</span>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-700/50 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-brand" style={{ width: `${Math.min(100, s.count * 10)}%` }} />
                  </div>
                  <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 w-6 text-right">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CALLS & TEXTS
// ═══════════════════════════════════════════════════════════════════════════
function CallsTextsTab({ report }) {
  const ct = report?.calls_texts || {};
  return (
    <div className="space-y-4" data-testid="calls-tab">
      <SectionTitle desc="Outbound communication volume and mix">Calls & texts</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPI label="Calls"  value={ct.calls ?? 0} icon={Phone} accent="text-sky-600 dark:text-sky-400" />
        <KPI label="SMS"    value={ct.sms ?? 0}   icon={MessageSquare} accent="text-emerald-600 dark:text-emerald-400" />
        <KPI label="Emails" value={ct.emails ?? 0} icon={Mail} accent="text-amber-600 dark:text-amber-400" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Placeholder-but-structured tabs
// ═══════════════════════════════════════════════════════════════════════════
function MarketingTab() {
  return (
    <div className="space-y-4" data-testid="marketing-tab">
      <SectionTitle desc="Campaign performance, UTM attribution, and batch outreach">Marketing</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PlaceholderCard icon={Mail} title="Batch emails" desc="Open rate, click rate, opt-outs per campaign" />
        <PlaceholderCard icon={Building2} title="Properties engagement" desc="Listing views, inquiries, tour requests" />
        <PlaceholderCard icon={Megaphone} title="Marketing UTM report" desc="Source → lead attribution by utm_campaign" />
      </div>
    </div>
  );
}

function ApplicationsTab({ report }) {
  const funnel = report?.applications_funnel || [];
  const total = funnel[0]?.count || 1;
  return (
    <div className="space-y-4" data-testid="applications-tab">
      <SectionTitle desc="Conversion from inquiry to signed lease">Lease application funnel</SectionTitle>
      <Card>
        <ul className="space-y-2">
          {funnel.map((f, i) => {
            const pct = Math.round((f.count / total) * 100);
            return (
              <li key={f.stage} className="flex items-center gap-3">
                <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 w-44">{f.stage}</span>
                <div className="flex-1 bg-slate-100 dark:bg-slate-700/50 rounded-md h-8 overflow-hidden relative">
                  <div className="h-full bg-gradient-to-r from-brand to-brand-dark" style={{ width: `${Math.max(4, pct)}%` }} />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-white drop-shadow">
                    {f.count} · {pct}%
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function RenewalsTab({ report }) {
  const upcoming = report?.renewals?.upcoming_90d ?? 0;
  return (
    <div className="space-y-4" data-testid="renewals-tab">
      <SectionTitle desc="Upcoming renewals, offered, renewed, vacated">Renewals & retention</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPI label="Upcoming (next 90 days)" value={upcoming} icon={Calendar} accent="text-brand" />
        <PlaceholderCard icon={CheckCheck} title="Renewed" desc="Tenants who signed renewal offers" mini />
        <PlaceholderCard icon={ArrowDownRight} title="Vacated" desc="Tenants who moved out" mini />
      </div>
    </div>
  );
}

function GoalsTab({ report }) {
  const agents = report?.agents || [];
  return (
    <div className="space-y-4" data-testid="goals-tab">
      <SectionTitle desc="Monthly targets and progress toward each agent's goals">Agent goals</SectionTitle>
      <Card>
        {agents.length === 0 ? (
          <p className="text-[12px] text-slate-500 dark:text-slate-400 py-6 text-center">No agents with activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {agents.map(a => {
              const target = 10; // default leases-signed target
              const pct = Math.min(100, Math.round((a.leases_signed / target) * 100));
              return (
                <li key={a.user_id} className="flex items-center gap-3">
                  <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 w-36 truncate">{a.name}</span>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-700/50 rounded-md h-6 overflow-hidden relative">
                    <div className={`h-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-brand' : 'bg-amber-400'}`} style={{ width: `${Math.max(4, pct)}%` }} />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white drop-shadow">{a.leases_signed} / {target} leases</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-10 text-right">{pct}%</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PlaceholderCard({ icon: Icon, title, desc, mini }) {
  return (
    <Card className={mini ? 'opacity-80' : ''}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
          <Badge className="mt-2 bg-amber-100 text-amber-700 border-0 text-[10px] dark:bg-amber-900/30 dark:text-amber-300">Coming soon</Badge>
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARKS — anonymous network comparison
// ═══════════════════════════════════════════════════════════════════════════
function BenchmarksTab({ bench, zone, setZone }) {
  if (!bench) return <SkeletonGrid />;
  const rows = bench.rows || [];

  const perfColor = (percentile) => {
    if (percentile >= 75) return 'text-emerald-600 dark:text-emerald-400';
    if (percentile >= 50) return 'text-brand dark:text-brand-ring';
    if (percentile >= 25) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  const fmt = (v, unit) => {
    if (unit === '$')      return '$' + Number(v).toLocaleString();
    if (unit === '$/day')  return '$' + Number(v).toFixed(0);
    if (unit === '%')      return Number(v).toFixed(1) + '%';
    if (unit === 'hrs')    return Number(v).toFixed(1) + ' hrs';
    if (unit === 'days')   return Number(v).toFixed(1) + ' days';
    return v;
  };

  return (
    <div className="space-y-4" data-testid="benchmarks-tab">
      <Card className="bg-gradient-to-br from-brand/5 to-amber-50/40 dark:from-brand/15 dark:to-amber-900/10 border-brand/20 dark:border-brand/30">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand/15 text-brand dark:text-brand-ring flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[14px] font-bold text-slate-900 dark:text-slate-100">Anonymous network benchmarks</h3>
              <Badge className="text-[10px] border-0 bg-brand/15 text-brand dark:bg-brand/20 dark:text-brand-ring">Beta</Badge>
            </div>
            <p className="text-[12px] text-slate-600 dark:text-slate-300 mt-1">
              Compare your brokerage to Austin-metro peers. Strictly aggregated & anonymized — requires opt-in, minimum 5 brokerages, and a 7-day delay.
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                bench.min_threshold_met ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              }`}>
                {bench.opted_in_count} brokerage{bench.opted_in_count === 1 ? '' : 's'} opted in · {bench.min_threshold_met ? 'Live data' : 'Showing peer snapshot (need 5+ for live)'}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">· {bench.delay_days}-day delay · No PII</span>
            </div>
          </div>
          <div>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger className="h-9 w-[200px] text-[12px]" data-testid="zone-select">
                <School className="w-3.5 h-3.5 mr-1" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(bench.university_zones || []).map(z => (
                  <SelectItem key={z.id} value={z.id}>{z.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {rows.map(r => {
          const diff = r.yours - r.peer_average;
          const better = r.lower_is_better ? diff < 0 : diff > 0;
          return (
            <Card key={r.id} testid={`benchmark-${r.id}`}>
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-[12px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{r.label}</h4>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${perfColor(r.percentile)} bg-slate-50 dark:bg-slate-900/40`}>
                  P{r.percentile}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Your brokerage</p>
                  <p className={`font-heading text-[22px] font-bold leading-none mt-1 ${better ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                    {fmt(r.yours, r.unit)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Austin peers</p>
                  <p className="font-heading text-[22px] font-bold leading-none mt-1 text-slate-500 dark:text-slate-400">
                    {fmt(r.peer_average, r.unit)}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-[54px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={r.sparkline}>
                    <defs>
                      <linearGradient id={`sp-${r.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={better ? '#10b981' : '#f43f5e'} stopOpacity={0.35}/>
                        <stop offset="95%" stopColor={better ? '#10b981' : '#f43f5e'} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke={better ? '#10b981' : '#f43f5e'} strokeWidth={1.5} fill={`url(#sp-${r.id})`} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className={`text-[10px] font-semibold mt-1 ${better ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {better ? '▲ Above' : '▼ Below'} peer average
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl animate-pulse" />)}
    </div>
  );
}

function HowReportingDialog({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="how-reporting-dialog">
        <DialogHeader>
          <DialogTitle>How reporting works</DialogTitle>
          <DialogDescription className="text-[12px]">Where the numbers come from and how to trust them.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-[13px] text-slate-700 dark:text-slate-300">
          <p><strong className="text-slate-900 dark:text-slate-100">Per-period windows.</strong> Every metric is computed from the selected date range (contact created_at, deal updated_at, activity created_at).</p>
          <p><strong className="text-slate-900 dark:text-slate-100">Agent activity.</strong> Rolls up calls / emails / SMS / meetings / notes from the activities collection. Leases signed come from deals reaching Lease Signed / Move-In / Active Tenant stages in the window.</p>
          <p><strong className="text-slate-900 dark:text-slate-100">Funnel.</strong> Stage counts for the lease_applications pipeline, ordered Inquiry → Tour → Application → Screening → Approved → Lease Signed.</p>
          <p><strong className="text-slate-900 dark:text-slate-100">Network benchmarks.</strong> Strictly anonymized & aggregated. Shown only when 5+ brokerages have opted in; otherwise we display an Austin-metro peer snapshot. Data delayed 7 days and stripped of PII.</p>
          <p><strong className="text-slate-900 dark:text-slate-100">Exports.</strong> The "Export CSV" button downloads everything you see for the current range and scope.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
