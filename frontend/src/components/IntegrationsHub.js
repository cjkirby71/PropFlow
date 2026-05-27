import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Home, TrendingUp, Workflow, Layers, CheckCircle2, ExternalLink, Lock, Sparkles, Loader2, MessageSquare,
  Table, Mail, Bot, ArrowRightLeft, Building2, ShieldCheck, FileCheck, FileSignature, CalendarClock,
  Database, PhoneCall, MapPin, Landmark, Cloud, GitBranch, Zap, Hash, Square, BookOpen, Calendar, Package,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useElaraIntegrations, useTenantMe, useUpdateTenant } from '../hooks/useElara';

// Map icon names (from backend catalog) to lucide components
const ICON_MAP = {
  MessageSquare, Table, Sparkles, Bot, Mail, Home, ArrowRightLeft, Building2, ShieldCheck, FileCheck, FileSignature,
  CalendarClock, Database, PhoneCall, TrendingUp, MapPin, Landmark, Workflow, Cloud, GitBranch, Zap, Hash, Square,
  BookOpen, Calendar, Layers,
};

const INDUSTRY_ICON = { Home, TrendingUp, Workflow, Layers };

const CATEGORY_LABELS = {
  communications: 'Communications',
  data_sync: 'Data Sync',
  ai: 'AI & Agents',
  lead_source: 'Lead Sources',
  property_mgmt: 'Property Mgmt',
  screening: 'Tenant Screening',
  documents: 'Documents',
  scheduling: 'Scheduling',
  data: 'Data Enrichment',
  finance: 'Finance',
  crm: 'CRM Bridges',
  automation: 'Automation',
  productivity: 'Productivity',
  knowledge: 'Knowledge',
};

/**
 * Integrations Hub — where Elara proactively suggests + helps set up integrations.
 * Tabs: Suggested for you | Connected | Browse all
 * Industry selector at top.
 */
export default function IntegrationsHub() {
  const [industryOverride, setIndustryOverride] = useState(null);
  const { data: tenantMe } = useTenantMe();
  const updateTenant = useUpdateTenant();
  const effectiveIndustry = industryOverride || tenantMe?.industry || 'real_estate_leasing';
  const { data, isLoading } = useElaraIntegrations(effectiveIndustry);
  const [tab, setTab] = useState('suggested');

  const handleSetIndustry = async (industryId) => {
    setIndustryOverride(industryId);
    try {
      await updateTenant.mutateAsync({ industry: industryId });
      toast.success('Industry preference saved — suggestions updated.');
    } catch (err) {
      // Non-fatal — override still works for the session
      const detail = err.response?.data?.detail || '';
      if (!String(detail).includes('Only the tenant owner')) {
        toast.error(detail || 'Could not save industry preference');
      }
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-3" data-testid="integrations-hub-loading">
        <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (<div key={i} className="h-24 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />))}
        </div>
      </div>
    );
  }

  const { connected = [], suggested = [], all = [], industries = [] } = data;
  const list = tab === 'connected' ? connected : tab === 'suggested' ? suggested : all;

  return (
    <div className="space-y-4" data-testid="integrations-hub">
      {/* Industry selector */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4" data-testid="industry-selector">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-900/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-bold text-slate-900 dark:text-slate-100">What's your primary use case?</h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">Elara tailors integration suggestions based on what you do. You can change this anytime.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {industries.map((ind) => {
            const Icon = INDUSTRY_ICON[ind.icon] || Layers;
            const active = effectiveIndustry === ind.id;
            return (
              <button
                key={ind.id}
                onClick={() => handleSetIndustry(ind.id)}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition text-left ${
                  active
                    ? 'border-brand bg-brand/5 dark:bg-brand/10 shadow-premium'
                    : 'border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 hover:border-brand/30 hover:bg-brand/5 dark:hover:bg-brand/10'
                }`}
                data-testid={`industry-option-${ind.id}`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-brand dark:text-brand-ring' : 'text-slate-500 dark:text-slate-400'} flex-shrink-0`} />
                <span className={`text-[12px] font-semibold ${active ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200'}`}>{ind.label}</span>
                {active && <CheckCircle2 className="w-3.5 h-3.5 text-brand dark:text-brand-ring ml-auto flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg p-1 w-fit" data-testid="integrations-tabs">
        {[
          { id: 'suggested', label: `Suggested for you (${suggested.length})` },
          { id: 'connected', label: `Connected (${connected.length})` },
          { id: 'all', label: `Browse all (${all.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-[12px] font-semibold px-3 py-1.5 rounded-md transition ${
              tab === t.id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            data-testid={`integrations-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Connected summary banner (only on suggested tab) */}
      {tab === 'suggested' && connected.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3.5 flex items-center gap-3" data-testid="connected-summary">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[12.5px] font-bold text-emerald-900 dark:text-emerald-200">{connected.length} integration{connected.length !== 1 ? 's' : ''} already connected</p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 truncate">{connected.map(c => c.name).join(' · ')}</p>
          </div>
          <Button size="sm" variant="ghost" className="text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 h-7 text-[11px]" onClick={() => setTab('connected')}>View →</Button>
        </div>
      )}

      {/* Integration cards grid */}
      {list.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl" data-testid="integrations-empty">
          <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            {tab === 'connected' ? "Nothing connected yet — pick one from Suggested." : 'No integrations to show.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="integrations-grid">
          {list.map((i) => <IntegrationCard key={i.id} integ={i} />)}
        </div>
      )}
    </div>
  );
}

function IntegrationCard({ integ }) {
  const Icon = ICON_MAP[integ.icon] || Package;
  const isExternal = (integ.setup_url || '').startsWith('http');
  const comingSoon = !!integ.coming_soon;
  const planLocked = integ.plan_required && integ.plan_required !== 'starter';

  return (
    <div
      className={`bg-white dark:bg-slate-800 border-2 rounded-xl p-4 transition hover:shadow-premium-xl ${
        integ.connected
          ? 'border-emerald-300 dark:border-emerald-700/60 ring-1 ring-emerald-100 dark:ring-emerald-900/30'
          : comingSoon
          ? 'border-slate-200 dark:border-slate-700/60 opacity-70'
          : 'border-slate-200 dark:border-slate-700/60 hover:border-brand/40'
      }`}
      data-testid={`integration-card-${integ.id}`}
    >
      <div className="flex items-start gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          integ.connected
            ? 'bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-700 dark:text-emerald-300'
            : 'bg-gradient-to-br from-brand/10 to-amber-100 dark:from-brand/20 dark:to-amber-900/20 text-brand dark:text-brand-ring'
        }`}>
          <Icon className="w-5 h-5" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h4 className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100 leading-tight">{integ.name}</h4>
            {integ.connected && (
              <Badge className="text-[9.5px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0 px-1.5 py-0">
                <CheckCircle2 className="w-2.5 h-2.5 mr-0.5 inline" /> Connected
              </Badge>
            )}
            {comingSoon && (
              <Badge className="text-[9.5px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-0 px-1.5 py-0">Coming soon</Badge>
            )}
            {planLocked && (
              <Badge className="text-[9.5px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-0 px-1.5 py-0">
                <Lock className="w-2.5 h-2.5 mr-0.5 inline" /> {integ.plan_required}
              </Badge>
            )}
          </div>
          <p className="text-[10.5px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">{CATEGORY_LABELS[integ.category] || integ.category}</p>
        </div>
      </div>

      <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed mb-3">{integ.description}</p>

      {integ.status_detail && (
        <div className={`text-[10.5px] mb-3 px-2 py-1 rounded ${
          integ.connected
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
            : 'bg-slate-50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400'
        }`}>
          {integ.status_detail}
        </div>
      )}

      {integ.requires_keys?.length > 0 && (
        <div className="mb-3">
          <p className="text-[9.5px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mb-1">Requires</p>
          <div className="flex flex-wrap gap-1">
            {integ.requires_keys.map((k) => (
              <code key={k} className="text-[10px] bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono">{k}</code>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {integ.connected ? (
          <Button size="sm" variant="outline" className="h-8 text-[11px] flex-1" disabled>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Active
          </Button>
        ) : comingSoon ? (
          <Button size="sm" variant="outline" className="h-8 text-[11px] flex-1" disabled>
            <Loader2 className="w-3.5 h-3.5 mr-1 text-slate-400" /> Coming soon
          </Button>
        ) : isExternal ? (
          <a href={integ.setup_url} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button size="sm" className="w-full h-8 text-[11px] bg-brand hover:bg-brand-dark text-white" data-testid={`integration-setup-${integ.id}`}>
              Setup guide <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </a>
        ) : (
          <a href={integ.setup_url || '#'} className="flex-1">
            <Button size="sm" className="w-full h-8 text-[11px] bg-brand hover:bg-brand-dark text-white" data-testid={`integration-setup-${integ.id}`}>
              Connect →
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
