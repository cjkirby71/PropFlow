import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStats } from '../hooks/useApi';
import { Users, Kanban, Building2, CheckSquare, TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIPELINE_LABELS = {
  residential_lease: 'Residential Lease',
  commercial_sale: 'Commercial Sale',
  commercial_lease: 'Commercial Lease',
};

const COLORS = ['#E0E7FF', '#FEF08A', '#D9F99D', '#FED7AA', '#BBF7D0', '#C7D2FE', '#FDE68A'];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: stats, isLoading: loading, error } = useDashboardStats();

  if (loading) return <div className="p-6 sm:p-8" data-testid="dashboard-loading"><div className="animate-pulse space-y-4"><div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48" /><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-200 dark:bg-slate-700 rounded-lg" />)}</div></div></div>;

  if (error) return <div className="p-6 sm:p-8"><div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">Failed to load dashboard. Please try again.</div></div>;

  const statCards = [
    { label: 'Total Contacts', value: stats?.total_contacts || 0, icon: Users, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400', path: '/contacts' },
    { label: 'Active Deals', value: stats?.total_deals || 0, icon: Kanban, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400', path: '/pipeline' },
    { label: 'Properties', value: stats?.total_properties || 0, icon: Building2, color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400', path: '/properties' },
    { label: 'Open Tasks', value: stats?.open_tasks || 0, icon: CheckSquare, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400', path: '/tasks' },
  ];

  const pipelineChartData = Object.entries(stats?.pipeline_stats || {}).map(([key, stages]) => ({
    name: PIPELINE_LABELS[key] || key,
    deals: Object.values(stages).reduce((a, b) => a + b, 0),
    value: stats?.deal_values?.[key] || 0,
  }));

  const stageBreakdown = [];
  Object.entries(stats?.pipeline_stats || {}).forEach(([pt, stages]) => {
    Object.entries(stages).forEach(([stage, count]) => {
      if (count > 0) stageBreakdown.push({ name: `${stage}`, count, pipeline: PIPELINE_LABELS[pt] });
    });
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Overview of your real estate operations</p>
        </div>
        <Button onClick={() => navigate('/contacts')} className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 gap-2" data-testid="dashboard-add-contact-btn">
          <Users className="w-4 h-4" /> Add Contact
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, path }) => (
          <button key={label} onClick={() => navigate(path)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-lg p-4 sm:p-5 text-left hover:shadow-md transition-shadow group" data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, '-')}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mt-1">{label}</p>
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-lg p-5" data-testid="pipeline-value-chart">
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Pipeline Value
          </h3>
          {pipelineChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={pipelineChartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => `$${v.toLocaleString()}`} contentStyle={{ borderRadius: 8, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0' }} />
                <Bar dataKey="value" fill="#2563EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">No deal data yet. Create your first deal.</div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-lg p-5" data-testid="stage-breakdown-chart">
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-4">Deal Stage Breakdown</h3>
          {stageBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={stageBreakdown} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, count }) => `${name}: ${count}`} labelLine={false}>
                  {stageBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">No deals in any stage yet.</div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-lg p-5" data-testid="recent-activities-section">
        <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-4">Recent Activity</h3>
        {stats?.recent_activities?.length > 0 ? (
          <div className="space-y-3">
            {stats.recent_activities.map((a, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{a.activity_type?.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 dark:text-slate-300">{a.description}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{a.activity_type} &middot; {new Date(a.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">No recent activity. Start logging calls, emails, and notes.</p>
        )}
      </div>
    </div>
  );
}
