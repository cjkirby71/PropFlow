import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  useApiKeys, useDeleteApiKey, useTeamMembers, useRemoveTeamMember,
  useWebhooks, useDeleteWebhook, useToggleWebhook,
  useOrgSettings, useUpdateOrgSettings, useSettingsSummary, useSequences,
  useTemplates, useProperties,
  useBrokerageSheetStatus, useEnableBrokerageSheet, useSyncBrokerageSheet,
  useShareBrokerageSheet, useRevokeBrokerageSheetShare, useDisconnectBrokerageSheet,
  useStartSheetsOAuth,
} from '../hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';
import {
  Key, Plus, Copy, Trash2, Eye, EyeOff, Users, Webhook, UserPlus, Shield,
  Globe, ToggleLeft, ToggleRight, LayoutGrid, Shuffle, Building2, Zap,
  FileText, Plug, Tags, TrendingUp, ChevronRight, Sparkles, Home,
  Wrench, Mail, MessageSquare, Briefcase, ExternalLink, Calendar,
  CircleCheck, CircleAlert, Save, Sheet as SheetIcon, RefreshCw, Link as LinkIcon,
  Lock, GraduationCap,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import ElaraServiceTokensCard from '../components/ElaraServiceTokensCard';

// ═══════════════════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'overview',     label: 'Overview',           icon: LayoutGrid },
  { id: 'team',         label: 'Team',               icon: Users },
  { id: 'lead_flow',    label: 'Lead Flow',          icon: Shuffle },
  { id: 'properties',   label: 'Properties & Units', icon: Building2 },
  { id: 'sequences',    label: 'Sequences',          icon: Zap },
  { id: 'templates',    label: 'Email & SMS Templates', icon: FileText },
  { id: 'integrations', label: 'Integrations',       icon: Plug },
  { id: 'custom',       label: 'Custom Fields',      icon: Tags },
  { id: 'renewals',     label: 'Renewals & Retention', icon: TrendingUp },
];

// ─── Shared card shell ─────────────────────────────────────────────────────
function Card({ children, className = '', testid, onClick }) {
  const Cmp = onClick ? 'button' : 'div';
  return (
    <Cmp
      onClick={onClick}
      data-testid={testid}
      className={`text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-sm dark:shadow-premium p-5 transition ${onClick ? 'hover:shadow-premium hover:border-brand/40 cursor-pointer w-full' : ''} ${className}`}
    >
      {children}
    </Cmp>
  );
}

function CardHeader({ icon: Icon, title, description, accent = 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-ring', right }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={`w-10 h-10 rounded-lg ${accent} flex items-center justify-center shrink-0`}>
            <Icon className="w-5 h-5" strokeWidth={2.2} />
          </div>
        )}
        <div>
          <h3 className="text-[14px] font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          {description && <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const navigate = useNavigate();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto space-y-5" data-testid="settings-page">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Admin & Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your team, leasing workflows, integrations, and customizations</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 border-b border-slate-200 dark:border-slate-700/60 overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8" data-testid="settings-tabs">
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
              data-testid={`settings-tab-${t.id}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview'     && <OverviewTab onGo={setTab} navigate={navigate} />}
      {tab === 'team'         && <TeamTab isAdmin={user?.role === 'admin'} />}
      {tab === 'lead_flow'    && <LeadFlowTab />}
      {tab === 'properties'   && <PropertiesTab navigate={navigate} />}
      {tab === 'sequences'    && <SequencesTab navigate={navigate} />}
      {tab === 'templates'    && <TemplatesTab navigate={navigate} />}
      {tab === 'integrations' && <IntegrationsTab />}
      {tab === 'custom'       && <CustomFieldsTab />}
      {tab === 'renewals'     && <RenewalsTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════
function OverviewTab({ onGo, navigate }) {
  const { data: summary } = useSettingsSummary();
  const { data: settings } = useOrgSettings();
  const s = summary || {};

  const quickCards = [
    { id: 'team',         icon: Users,      label: 'Team',              count: s.team_members,     desc: 'Invite agents & set roles',       accent: 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-ring' },
    { id: 'lead_flow',    icon: Shuffle,    label: 'Lead Flow',         count: null,               desc: 'Round-robin & distribution',      accent: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
    { id: 'properties',   icon: Building2,  label: 'Properties & Units',count: s.properties,       desc: 'Inventory, availability rules',   accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    { id: 'sequences',    icon: Zap,        label: 'Sequences',         count: s.active_sequences, desc: `${s.sequences || 0} total · auto drip campaigns`, accent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    { id: 'templates',    icon: FileText,   label: 'Templates',         count: s.templates,        desc: 'Email & SMS boilerplates',        accent: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
    { id: 'integrations', icon: Plug,       label: 'Integrations',      count: s.webhooks + s.api_keys, desc: 'Brevo, Twilio, Google, API',  accent: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
    { id: 'custom',       icon: Tags,       label: 'Custom Fields',     count: (settings?.custom_fields?.length) || 0, desc: 'Tag & field customization', accent: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
    { id: 'renewals',     icon: TrendingUp, label: 'Renewals & Retention', count: null,             desc: `${settings?.renewals?.rent_increase_percent ?? 3}% default increase`, accent: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
  ];

  return (
    <div className="space-y-6" data-testid="overview-tab">
      {/* Business card */}
      <Card testid="company-card">
        <CardHeader icon={Briefcase} title="Business Registration" description="Core company information shown on proposals & lease documents" />
        <CompanyForm />
      </Card>

      {/* Quick-nav grid */}
      <div>
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 px-1">Sections</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {quickCards.map(c => {
            const Icon = c.icon;
            return (
              <Card key={c.id} testid={`quick-card-${c.id}`} onClick={() => onGo(c.id)}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${c.accent} flex items-center justify-center shrink-0`}>
                    <Icon className="w-5 h-5" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{c.label}</h3>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </div>
                    {c.count != null && <p className="text-[22px] font-heading font-bold text-slate-800 dark:text-slate-100 mt-1 leading-none">{c.count}</p>}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{c.desc}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Import card */}
      <Card testid="import-card">
        <CardHeader icon={Sparkles} title="Import data" description="Migrate contacts, properties, or deals from another CRM or a CSV" accent="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          right={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-9 text-[12px]" onClick={() => navigate('/contacts?new=1')} data-testid="import-contacts">Contacts CSV</Button>
              <Button size="sm" variant="outline" className="h-9 text-[12px]" onClick={() => navigate('/properties')} data-testid="import-properties">Properties CSV</Button>
            </div>
          }
        />
      </Card>
    </div>
  );
}

// ─── Company form ─────────────────────────────────────────────────────────
function CompanyForm() {
  const { data: settings } = useOrgSettings();
  const update = useUpdateOrgSettings();
  const [form, setForm] = useState({ name: '', business_registration: '', address: '', phone: '', website: '' });

  useEffect(() => {
    if (settings?.company) {
      setForm({
        name: settings.company.name || '',
        business_registration: settings.company.business_registration || '',
        address: settings.company.address || '',
        phone: settings.company.phone || '',
        website: settings.company.website || '',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await update.mutateAsync({ company: form });
      toast.success('Company info saved');
    } catch { toast.error('Could not save'); }
  };

  return (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <Label className="text-[12px] font-semibold mb-1.5 block">Company name</Label>
        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9 text-[13px]" placeholder="PropFlow Realty LLC" data-testid="company-name" />
      </div>
      <div>
        <Label className="text-[12px] font-semibold mb-1.5 block">Business registration #</Label>
        <Input value={form.business_registration} onChange={e => setForm({ ...form, business_registration: e.target.value })} className="h-9 text-[13px]" placeholder="EIN / Broker license" data-testid="company-reg" />
      </div>
      <div>
        <Label className="text-[12px] font-semibold mb-1.5 block">Phone</Label>
        <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-9 text-[13px]" placeholder="+1-555-0123" data-testid="company-phone" />
      </div>
      <div>
        <Label className="text-[12px] font-semibold mb-1.5 block">Website</Label>
        <Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="h-9 text-[13px]" placeholder="https://propflow.com" data-testid="company-website" />
      </div>
      <div className="sm:col-span-2">
        <Label className="text-[12px] font-semibold mb-1.5 block">Address</Label>
        <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="h-9 text-[13px]" placeholder="123 Broadway, New York, NY" data-testid="company-address" />
      </div>
      <div className="sm:col-span-2 flex justify-end">
        <Button onClick={handleSave} disabled={update.isPending} className="bg-brand hover:bg-brand-dark text-white h-9 text-[13px]" data-testid="company-save">
          <Save className="w-3.5 h-3.5 mr-1.5" /> {update.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TEAM (preserves existing invite logic)
// ═══════════════════════════════════════════════════════════════════════════
function TeamTab({ isAdmin }) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'agent' });
  const [inviteResult, setInviteResult] = useState(null);
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useTeamMembers();
  const removeMember = useRemoveTeamMember();

  const handleInvite = async () => {
    try {
      const { data } = await api.post('/team/invite', inviteForm);
      setInviteResult(data);
      qc.invalidateQueries({ queryKey: ['team-members'] });
    } catch (err) { toast.error(err.response?.data?.detail || err.message); }
  };

  const handleRemove = (id) => {
    if (!window.confirm('Remove this team member?')) return;
    removeMember.mutate(id);
  };

  const handleRoleChange = async (id, role) => {
    try { await api.put(`/team/members/${id}/role`, { role }); qc.invalidateQueries({ queryKey: ['team-members'] }); } catch {}
  };

  return (
    <div className="space-y-4" data-testid="team-tab">
      <Card>
        <CardHeader
          icon={Users}
          title="Team members"
          description="Invite agents, promote admins, and remove access when needed"
          right={isAdmin && (
            <Dialog open={showInvite} onOpenChange={o => { setShowInvite(o); if (!o) { setInviteResult(null); setInviteForm({ email: '', name: '', role: 'agent' }); } }}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9 text-[13px] bg-brand hover:bg-brand-dark text-white" data-testid="invite-member-button"><UserPlus className="w-3.5 h-3.5 mr-1.5" /> Invite</Button>
              </DialogTrigger>
              <DialogContent data-testid="invite-member-dialog">
                <DialogHeader><DialogTitle>Invite team member</DialogTitle></DialogHeader>
                {!inviteResult ? (
                  <div className="space-y-3">
                    <div><Label className="text-[12px] font-semibold mb-1.5 block">Name</Label><Input value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })} className="h-9 text-[13px]" data-testid="invite-name-input" /></div>
                    <div><Label className="text-[12px] font-semibold mb-1.5 block">Email</Label><Input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} className="h-9 text-[13px]" data-testid="invite-email-input" /></div>
                    <div>
                      <Label className="text-[12px] font-semibold mb-1.5 block">Role</Label>
                      <Select value={inviteForm.role} onValueChange={v => setInviteForm({ ...inviteForm, role: v })}>
                        <SelectTrigger className="h-9 text-[13px]" data-testid="invite-role-select"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="agent">Agent</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleInvite} className="w-full bg-brand hover:bg-brand-dark text-white h-9 text-[13px]" data-testid="invite-submit-button">Send invite</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/60 rounded-md p-3">
                      <p className="text-[13px] text-emerald-800 dark:text-emerald-300 font-semibold mb-2">Member invited!</p>
                      <p className="text-[12px] text-slate-700 dark:text-slate-300">Email: <strong>{inviteResult.email}</strong></p>
                      <p className="text-[12px] text-slate-700 dark:text-slate-300">Temp password: <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 font-mono text-[11px]">{inviteResult.temp_password}</code></p>
                    </div>
                    <Button variant="outline" onClick={() => { setShowInvite(false); setInviteResult(null); }} className="w-full h-9 text-[13px]">Done</Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        />
        {isLoading ? (
          <div className="mt-4 space-y-2">{[1, 2].map(i => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-700/60 rounded-lg animate-pulse" />)}</div>
        ) : (
          <div className="mt-4 space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700/60 rounded-lg bg-slate-50/60 dark:bg-slate-900/40" data-testid={`team-member-${m.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand/15 dark:bg-brand/25 text-brand dark:text-brand-ring font-bold text-[12px] flex items-center justify-center">
                    {(m.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{m.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin ? (
                    <Select value={m.role} onValueChange={v => handleRoleChange(m.id, v)}>
                      <SelectTrigger className="w-[110px] h-8 text-[12px]"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="agent">Agent</SelectItem></SelectContent>
                    </Select>
                  ) : (
                    <Badge className="text-[10px] flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"><Shield className="w-3 h-3" /> {m.role}</Badge>
                  )}
                  {isAdmin && <Button variant="ghost" size="sm" onClick={() => handleRemove(m.id)} className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"><Trash2 className="w-3.5 h-3.5" /></Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LEAD FLOW / ROUND-ROBIN
// ═══════════════════════════════════════════════════════════════════════════
function LeadFlowTab() {
  const { data: settings } = useOrgSettings();
  const update = useUpdateOrgSettings();
  const lf = settings?.lead_flow || {};
  const [form, setForm] = useState(lf);

  useEffect(() => { if (settings?.lead_flow) setForm(settings.lead_flow); }, [settings]);

  const handleSave = async () => {
    try { await update.mutateAsync({ lead_flow: form }); toast.success('Lead flow rules saved'); }
    catch { toast.error('Could not save'); }
  };

  const toggle = () => setForm(f => ({ ...f, round_robin_enabled: !f.round_robin_enabled }));

  return (
    <div className="space-y-4" data-testid="lead-flow-tab">
      <Card>
        <CardHeader
          icon={Shuffle}
          title="Round-robin lead distribution"
          description="Automatically assign new contacts and deals to the agent with the fewest open deals"
          accent="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
          right={
            <Button size="sm" variant={form.round_robin_enabled ? 'default' : 'outline'} className={`h-9 text-[13px] ${form.round_robin_enabled ? 'bg-brand hover:bg-brand-dark' : ''}`} onClick={toggle} data-testid="rr-toggle">
              {form.round_robin_enabled ? <ToggleRight className="w-4 h-4 mr-1.5" /> : <ToggleLeft className="w-4 h-4 mr-1.5" />}
              {form.round_robin_enabled ? 'Enabled' : 'Disabled'}
            </Button>
          }
        />
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-[12px] font-semibold mb-1.5 block">Distribution strategy</Label>
            <Select value={form.strategy || 'least_busy'} onValueChange={v => setForm({ ...form, strategy: v })}>
              <SelectTrigger className="h-9 text-[13px]" data-testid="rr-strategy"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="least_busy">Least busy (fewest open deals)</SelectItem>
                <SelectItem value="random">Random</SelectItem>
                <SelectItem value="weighted">Weighted (by role/capacity)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 dark:text-slate-300 select-none cursor-pointer">
              <Checkbox checked={!!form.business_hours_only} onCheckedChange={(v) => setForm({ ...form, business_hours_only: !!v })} data-testid="rr-hours-only" /> Business hours only
            </label>
          </div>
          <div>
            <Label className="text-[12px] font-semibold mb-1.5 block">Business hours start</Label>
            <Input type="time" value={form.business_hours_start || '09:00'} onChange={e => setForm({ ...form, business_hours_start: e.target.value })} className="h-9 text-[13px]" data-testid="rr-start" />
          </div>
          <div>
            <Label className="text-[12px] font-semibold mb-1.5 block">Business hours end</Label>
            <Input type="time" value={form.business_hours_end || '18:00'} onChange={e => setForm({ ...form, business_hours_end: e.target.value })} className="h-9 text-[13px]" data-testid="rr-end" />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3 pt-1">
            <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 dark:text-slate-300 select-none cursor-pointer">
              <Checkbox checked={!!form.weekend_assignment} onCheckedChange={(v) => setForm({ ...form, weekend_assignment: !!v })} data-testid="rr-weekend" /> Assign on weekends
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={handleSave} disabled={update.isPending} className="bg-brand hover:bg-brand-dark text-white h-9 text-[13px]" data-testid="lead-flow-save">
            <Save className="w-3.5 h-3.5 mr-1.5" /> {update.isPending ? 'Saving...' : 'Save rules'}
          </Button>
        </div>
        {form.round_robin_enabled && (
          <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/60 rounded-md p-3">
            <p className="text-[12px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <CircleCheck className="w-4 h-4" /> Auto-assignment is active. New contacts and deals will be distributed fairly.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTIES & UNITS (links to existing PropertiesPage + availability rules)
// ═══════════════════════════════════════════════════════════════════════════
function PropertiesTab({ navigate }) {
  const { data: properties = [] } = useProperties();
  const active = properties.filter(p => p.status === 'active').length;
  return (
    <div className="space-y-4" data-testid="properties-tab">
      <Card>
        <CardHeader
          icon={Building2}
          title="Properties & Units"
          description="Inventory, availability rules, and unit-level settings"
          accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          right={
            <Button size="sm" variant="outline" className="h-9 text-[13px]" onClick={() => navigate('/properties')} data-testid="open-properties">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open Properties
            </Button>
          }
        />
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Total units" value={properties.length} />
          <Stat label="Active listings" value={active} />
          <Stat label="Leased" value={properties.filter(p => p.status === 'pending').length} />
          <Stat label="Closed" value={properties.filter(p => p.status === 'closed').length} />
        </div>
      </Card>

      <Card>
        <CardHeader icon={Home} title="Availability rules" description="Defaults applied when listings are auto-synced from IDX / MLS" accent="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" />
        <AvailabilityRulesForm />
      </Card>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/60 rounded-lg px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-heading text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 leading-none">{value}</p>
    </div>
  );
}

function AvailabilityRulesForm() {
  const { data: settings } = useOrgSettings();
  const update = useUpdateOrgSettings();
  const current = settings?.renewals || {};
  const [form, setForm] = useState({ default_notice_days: current.default_notice_days || 60 });
  useEffect(() => { if (settings?.renewals) setForm({ default_notice_days: settings.renewals.default_notice_days || 60 }); }, [settings]);

  const save = async () => {
    try { await update.mutateAsync({ renewals: { ...current, default_notice_days: Number(form.default_notice_days) } }); toast.success('Availability rule saved'); }
    catch { toast.error('Could not save'); }
  };

  return (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
      <div>
        <Label className="text-[12px] font-semibold mb-1.5 block">Mark unit as "available" N days before lease end</Label>
        <Input type="number" min={0} max={180} value={form.default_notice_days} onChange={e => setForm({ default_notice_days: e.target.value })} className="h-9 text-[13px]" data-testid="avail-notice-days" />
      </div>
      <Button onClick={save} className="bg-brand hover:bg-brand-dark text-white h-9 text-[13px]" data-testid="avail-save">
        <Save className="w-3.5 h-3.5 mr-1.5" /> Save rule
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SEQUENCES & TEMPLATES (link tabs)
// ═══════════════════════════════════════════════════════════════════════════
function SequencesTab({ navigate }) {
  const { data: sequences = [] } = useSequences();
  return (
    <div className="space-y-4" data-testid="sequences-tab">
      <Card>
        <CardHeader
          icon={Zap}
          title="Sequences & automations"
          description="Multi-step email/SMS drip campaigns triggered on contact events"
          accent="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          right={
            <Button size="sm" variant="outline" className="h-9 text-[13px]" onClick={() => navigate('/sequences')} data-testid="open-sequences">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open Sequences
            </Button>
          }
        />
        {sequences.length === 0 ? (
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-4">No sequences yet — head to <button onClick={() => navigate('/sequences')} className="text-brand font-semibold underline">Sequences</button> to create your first drip.</p>
        ) : (
          <ul className="mt-4 space-y-1.5">
            {sequences.slice(0, 6).map(s => (
              <li key={s.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-brand" />
                  <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{s.name}</span>
                  <Badge className={`text-[10px] ${s.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'} border-0`}>
                    {s.active ? 'Active' : 'Paused'}
                  </Badge>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{s.steps?.length || 0} steps · trigger: {s.trigger}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function TemplatesTab({ navigate }) {
  const { data: emails = [] } = useTemplates('email');
  const { data: sms = [] } = useTemplates('sms');
  return (
    <div className="space-y-4" data-testid="templates-tab">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardHeader icon={Mail} title="Email templates" description={`${emails.length} saved templates`} accent="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" />
          <Button size="sm" variant="outline" className="mt-3 h-9 text-[13px]" onClick={() => navigate('/templates')}>
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Manage
          </Button>
        </Card>
        <Card>
          <CardHeader icon={MessageSquare} title="SMS templates" description={`${sms.length} saved templates`} accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" />
          <Button size="sm" variant="outline" className="mt-3 h-9 text-[13px]" onClick={() => navigate('/templates')}>
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Manage
          </Button>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATIONS (API Keys + Webhooks + 3rd-party status)
// ═══════════════════════════════════════════════════════════════════════════
function IntegrationsTab() {
  const qc = useQueryClient();
  const { data: keys = [], isLoading: keysLoading } = useApiKeys();
  const { data: webhooks = [], isLoading: webhooksLoading } = useWebhooks();
  const deleteKey = useDeleteApiKey();
  const deleteWebhook = useDeleteWebhook();
  const toggleWebhook = useToggleWebhook();

  const [showAddKey, setShowAddKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [showAddHook, setShowAddHook] = useState(false);
  const [hookForm, setHookForm] = useState({ url: '', name: '', events: [] });
  const [showKeys, setShowKeys] = useState({});

  const createKey = async () => {
    try {
      const { data } = await api.post('/api-keys', { name: newKeyName || 'API Key' });
      setNewKey(data.key);
      qc.invalidateQueries({ queryKey: ['api-keys'] });
    } catch (err) { toast.error(err.response?.data?.detail || err.message); }
  };
  const createHook = async () => {
    if (!hookForm.url || hookForm.events.length === 0) return toast.error('URL and at least one event required');
    try {
      await api.post('/webhooks', hookForm);
      setShowAddHook(false);
      setHookForm({ url: '', name: '', events: [] });
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook created');
    } catch (err) { toast.error(err.response?.data?.detail || err.message); }
  };
  const toggleEvent = (evt) => setHookForm(f => ({ ...f, events: f.events.includes(evt) ? f.events.filter(e => e !== evt) : [...f.events, evt] }));

  const WEBHOOK_EVENTS = [
    { value: 'new_lead', label: 'New Lead Created' },
    { value: 'deal_stage_change', label: 'Deal Stage Change' },
    { value: 'email_sent', label: 'Email Sent' },
    { value: 'sms_sent', label: 'SMS Sent' },
    { value: 'new_activity', label: 'New Activity Logged' },
  ];

  return (
    <div className="space-y-4" data-testid="integrations-tab">
      <BrokerageSheetCard />

      {/* Elara Service Tokens — for external CrewAI / agent integrations */}
      <ElaraServiceTokensCard />

      {/* Third-party status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ThirdPartyCard icon={Mail} name="Brevo Email" desc="Transactional email via Brevo (300/day free)" env="BREVO_API_KEY" link="https://app.brevo.com/settings/keys/api" accent="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" />
        <ThirdPartyCard icon={MessageSquare} name="Twilio SMS" desc="Send/receive SMS from your contacts" env="TWILIO_ACCOUNT_SID" link="https://www.twilio.com/console" accent="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" />
        <ThirdPartyCard icon={Globe} name="IDX / Zillow" desc="Inbound listing leads via webhook" env="" link="/webhooks-docs" accent="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" placeholder />
        <ThirdPartyCard icon={Calendar} name="Microsoft 365 Calendar" desc="Two-way sync for tours & showings" env="" link="" accent="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" placeholder />
        <ThirdPartyCard icon={Sparkles} name="AI (GPT-5.2)" desc="Drafts, scoring, summaries" env="EMERGENT_LLM_KEY" link="" accent="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" connected />
        <ThirdPartyCard icon={Calendar} name="Google Calendar" desc="Sync tasks & activities with Google Calendar" env="GOOGLE_CLIENT_ID" link="" accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" />
      </div>

      {/* API Keys */}
      <Card>
        <CardHeader
          icon={Key}
          title="API Keys"
          description="Connect external agents, automations, or headless integrations"
          right={
            <Dialog open={showAddKey} onOpenChange={o => { setShowAddKey(o); if (!o) { setNewKey(''); setNewKeyName(''); } }}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-brand hover:bg-brand-dark text-white h-9 text-[13px]" data-testid="create-api-key-button"><Plus className="w-3.5 h-3.5 mr-1.5" /> Create key</Button>
              </DialogTrigger>
              <DialogContent data-testid="create-api-key-dialog">
                <DialogHeader><DialogTitle>Create API key</DialogTitle></DialogHeader>
                {!newKey ? (
                  <div className="space-y-3">
                    <div><Label className="text-[12px] font-semibold mb-1.5 block">Key name</Label><Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="e.g., Zapier" className="h-9 text-[13px]" data-testid="api-key-name-input" /></div>
                    <Button onClick={createKey} className="w-full bg-brand hover:bg-brand-dark text-white h-9 text-[13px]" data-testid="generate-api-key-button">Generate</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/60 rounded-md p-3">
                      <p className="text-[12px] text-emerald-800 dark:text-emerald-300 font-semibold mb-2">Key created! Copy it now — it won't be shown again.</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-[11px] bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded px-2 py-1.5 font-mono break-all">{newKey}</code>
                        <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(newKey)} data-testid="copy-api-key-button"><Copy className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => { setShowAddKey(false); setNewKey(''); }} className="w-full h-9 text-[13px]">Done</Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          }
        />
        {keysLoading ? (
          <div className="mt-4 space-y-2">{[1,2].map(i => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-700/60 rounded-lg animate-pulse" />)}</div>
        ) : keys.length === 0 ? (
          <div className="mt-4 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg py-6 text-center">
            <Key className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-[12px] text-slate-500 dark:text-slate-400">No API keys yet.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2" data-testid="api-keys-list">
            {keys.map((k, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700/60 rounded-lg bg-slate-50/70 dark:bg-slate-900/40" data-testid={`api-key-item-${i}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{k.name}</p>
                    <Badge className={`text-[10px] border-0 ${k.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{k.active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{showKeys[i] ? k.full_key : k.key_preview}</code>
                    <button onClick={() => setShowKeys(p => ({ ...p, [i]: !p[i] }))} className="text-slate-400 dark:text-slate-500 hover:text-brand">{showKeys[i] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(k.full_key)}><Copy className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (!window.confirm('Delete this API key?')) return; deleteKey.mutate(k.key_preview); }} className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader
          icon={Webhook}
          title="Webhooks"
          description="Real-time notifications when events occur in PropFlow"
          right={
            <Dialog open={showAddHook} onOpenChange={setShowAddHook}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-brand hover:bg-brand-dark text-white h-9 text-[13px]" data-testid="create-webhook-button"><Plus className="w-3.5 h-3.5 mr-1.5" /> Add webhook</Button>
              </DialogTrigger>
              <DialogContent data-testid="create-webhook-dialog">
                <DialogHeader><DialogTitle>Create webhook</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label className="text-[12px] font-semibold mb-1.5 block">Name</Label><Input value={hookForm.name} onChange={e => setHookForm({ ...hookForm, name: e.target.value })} className="h-9 text-[13px]" data-testid="webhook-name-input" /></div>
                  <div><Label className="text-[12px] font-semibold mb-1.5 block">URL</Label><Input value={hookForm.url} onChange={e => setHookForm({ ...hookForm, url: e.target.value })} placeholder="https://..." className="h-9 text-[13px]" data-testid="webhook-url-input" /></div>
                  <div>
                    <Label className="text-[12px] font-semibold mb-2 block">Events</Label>
                    <div className="space-y-1.5">
                      {WEBHOOK_EVENTS.map(evt => (
                        <label key={evt.value} className="flex items-center gap-2 cursor-pointer text-[13px] text-slate-700 dark:text-slate-300">
                          <Checkbox checked={hookForm.events.includes(evt.value)} onCheckedChange={() => toggleEvent(evt.value)} data-testid={`webhook-event-${evt.value}`} /> {evt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button onClick={createHook} className="w-full bg-brand hover:bg-brand-dark text-white h-9 text-[13px]" data-testid="webhook-submit-button">Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          }
        />
        {webhooksLoading ? (
          <div className="mt-4 space-y-2">{[1,2].map(i => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-700/60 rounded-lg animate-pulse" />)}</div>
        ) : webhooks.length === 0 ? (
          <div className="mt-4 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg py-6 text-center">
            <Webhook className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-[12px] text-slate-500 dark:text-slate-400">No webhooks configured.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2" data-testid="webhooks-list">
            {webhooks.map(w => (
              <div key={w.id} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700/60 rounded-lg bg-slate-50/70 dark:bg-slate-900/40" data-testid={`webhook-item-${w.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{w.name}</p>
                    <Badge className={`text-[10px] border-0 ${w.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{w.active ? 'Active' : 'Paused'}</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">{w.url}</p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">{w.events?.map(e => <Badge key={e} className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-0">{e}</Badge>)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggleWebhook.mutate(w.id)} data-testid={`webhook-toggle-${w.id}`}>
                    {w.active ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (!window.confirm('Delete this webhook?')) return; deleteWebhook.mutate(w.id); }} className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ThirdPartyCard({ icon: Icon, name, desc, env, link, accent, connected, placeholder }) {
  const status = connected ? { label: 'Connected', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' } :
                 placeholder ? { label: 'Coming soon', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' } :
                 { label: 'Needs API key', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' };
  return (
    <Card>
      <CardHeader icon={Icon} title={name} description={desc} accent={accent}
        right={<Badge className={`text-[10px] border-0 ${status.cls}`}>{status.label}</Badge>}
      />
      {!connected && env && (
        <div className="mt-3 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/60 rounded-md p-3">
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            Add <code className="bg-white dark:bg-slate-800 px-1 rounded font-mono text-[10px]">{env}</code> in backend <code>.env</code> to enable.
            {link && <> — <a href={link} target="_blank" rel="noreferrer" className="text-brand font-semibold hover:underline">Get key</a></>}
          </p>
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM FIELDS / TAGS / CUSTOM STAGES
// ═══════════════════════════════════════════════════════════════════════════
function CustomFieldsTab() {
  const { data: settings } = useOrgSettings();
  const update = useUpdateOrgSettings();
  const [newField, setNewField] = useState({ label: '', type: 'text', entity: 'contact' });
  const [newTag, setNewTag] = useState({ name: '', color: 'brand', entity: 'contact' });

  const fields = settings?.custom_fields || [];
  const tags = settings?.tags || [];

  const addField = async () => {
    if (!newField.label.trim()) return toast.error('Label required');
    const id = newField.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) + '_' + Date.now().toString(36).slice(-4);
    const next = [...fields, { ...newField, id, required: false }];
    try { await update.mutateAsync({ custom_fields: next }); toast.success('Field added'); setNewField({ label: '', type: 'text', entity: 'contact' }); }
    catch { toast.error('Could not save'); }
  };
  const removeField = async (id) => {
    try { await update.mutateAsync({ custom_fields: fields.filter(f => f.id !== id) }); }
    catch { toast.error('Could not remove'); }
  };

  const addTag = async () => {
    if (!newTag.name.trim()) return toast.error('Name required');
    const id = newTag.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30) + '_' + Date.now().toString(36).slice(-4);
    try { await update.mutateAsync({ tags: [...tags, { ...newTag, id }] }); toast.success('Tag added'); setNewTag({ name: '', color: 'brand', entity: 'contact' }); }
    catch { toast.error('Could not save'); }
  };
  const removeTag = async (id) => {
    try { await update.mutateAsync({ tags: tags.filter(t => t.id !== id) }); } catch {}
  };

  return (
    <div className="space-y-4" data-testid="custom-tab">
      <Card>
        <CardHeader icon={Tags} title="Custom fields" description="Add leasing-specific fields to contacts, deals, or properties" />
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Input value={newField.label} onChange={e => setNewField({ ...newField, label: e.target.value })} placeholder="Field label (e.g. Preferred Move-in)" className="h-9 text-[13px] flex-1" data-testid="new-field-label" />
          <Select value={newField.type} onValueChange={v => setNewField({ ...newField, type: v })}>
            <SelectTrigger className="h-9 text-[13px] sm:w-[120px]" data-testid="new-field-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="select">Select</SelectItem>
              <SelectItem value="boolean">Yes/No</SelectItem>
            </SelectContent>
          </Select>
          <Select value={newField.entity} onValueChange={v => setNewField({ ...newField, entity: v })}>
            <SelectTrigger className="h-9 text-[13px] sm:w-[130px]" data-testid="new-field-entity"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="contact">Contact</SelectItem>
              <SelectItem value="deal">Deal</SelectItem>
              <SelectItem value="property">Property</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addField} className="bg-brand hover:bg-brand-dark text-white h-9 text-[13px]" data-testid="add-field">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add field
          </Button>
        </div>
        {fields.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {fields.map(f => (
              <li key={f.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/60" data-testid={`field-${f.id}`}>
                <div className="flex items-center gap-2">
                  <Badge className="text-[10px] border-0 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">{f.entity}</Badge>
                  <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{f.label}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">· {f.type}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeField(f.id)} className="text-rose-500"><Trash2 className="w-3.5 h-3.5" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader icon={Tags} title="Tags" description="Color-coded labels for segmentation and quick filtering" accent="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" />
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Input value={newTag.name} onChange={e => setNewTag({ ...newTag, name: e.target.value })} placeholder="Tag name (e.g. Luxury Seeker)" className="h-9 text-[13px] flex-1" data-testid="new-tag-name" />
          <Select value={newTag.color} onValueChange={v => setNewTag({ ...newTag, color: v })}>
            <SelectTrigger className="h-9 text-[13px] sm:w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['brand', 'sky', 'emerald', 'amber', 'rose', 'violet'].map(c =>
                <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={addTag} className="bg-brand hover:bg-brand-dark text-white h-9 text-[13px]" data-testid="add-tag">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add tag
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {tags.map(t => (
              <span key={t.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand/10 dark:bg-brand/20 text-brand dark:text-brand-ring text-[11px] font-semibold border border-brand/30" data-testid={`tag-${t.id}`}>
                {t.name}
                <button onClick={() => removeTag(t.id)} className="hover:text-rose-500"><Trash2 className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RENEWALS & RETENTION
// ═══════════════════════════════════════════════════════════════════════════
function RenewalsTab() {
  const { data: settings } = useOrgSettings();
  const { data: sequences = [] } = useSequences();
  const update = useUpdateOrgSettings();
  const [form, setForm] = useState({});
  const [newMaint, setNewMaint] = useState({ name: '', sla_hours: 24, color: 'sky' });

  useEffect(() => { if (settings?.renewals) setForm(settings.renewals); }, [settings]);

  const maintenance = settings?.maintenance_types || [];

  const save = async () => {
    try {
      await update.mutateAsync({ renewals: { ...form, rent_increase_percent: Number(form.rent_increase_percent), default_notice_days: Number(form.default_notice_days), retention_target_score: Number(form.retention_target_score) } });
      toast.success('Renewal defaults saved');
    } catch { toast.error('Could not save'); }
  };

  const addMaint = async () => {
    if (!newMaint.name.trim()) return toast.error('Name required');
    const id = newMaint.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
    try { await update.mutateAsync({ maintenance_types: [...maintenance, { ...newMaint, id, sla_hours: Number(newMaint.sla_hours) }] }); toast.success('Type added'); setNewMaint({ name: '', sla_hours: 24, color: 'sky' }); }
    catch { toast.error('Could not save'); }
  };
  const removeMaint = async (id) => {
    try { await update.mutateAsync({ maintenance_types: maintenance.filter(m => m.id !== id) }); } catch {}
  };

  return (
    <div className="space-y-4" data-testid="renewals-tab">
      <Card>
        <CardHeader icon={TrendingUp} title="Renewals & retention defaults" description="Applied when generating renewal offers or scoring tenant retention" accent="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" />
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-[12px] font-semibold mb-1.5 block">Default renewal sequence</Label>
            <Select value={form.default_sequence_id || ''} onValueChange={v => setForm({ ...form, default_sequence_id: v === 'none' ? '' : v })}>
              <SelectTrigger className="h-9 text-[13px]" data-testid="renewal-sequence"><SelectValue placeholder="Pick a sequence" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {sequences.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[12px] font-semibold mb-1.5 block">Default rent increase (%)</Label>
            <Input type="number" step="0.1" min={0} max={50} value={form.rent_increase_percent ?? 3} onChange={e => setForm({ ...form, rent_increase_percent: e.target.value })} className="h-9 text-[13px]" data-testid="rent-increase" />
          </div>
          <div>
            <Label className="text-[12px] font-semibold mb-1.5 block">Renewal notice (days before lease end)</Label>
            <Input type="number" min={0} max={180} value={form.default_notice_days ?? 60} onChange={e => setForm({ ...form, default_notice_days: e.target.value })} className="h-9 text-[13px]" data-testid="notice-days" />
          </div>
          <div>
            <Label className="text-[12px] font-semibold mb-1.5 block">Retention target score</Label>
            <Input type="number" min={0} max={100} value={form.retention_target_score ?? 70} onChange={e => setForm({ ...form, retention_target_score: e.target.value })} className="h-9 text-[13px]" data-testid="retention-target" />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 dark:text-slate-300 select-none cursor-pointer">
              <Checkbox checked={!!form.auto_send_offer} onCheckedChange={(v) => setForm({ ...form, auto_send_offer: !!v })} data-testid="auto-send-offer" /> Automatically send renewal offer at notice date
            </label>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} className="bg-brand hover:bg-brand-dark text-white h-9 text-[13px]" data-testid="renewals-save">
            <Save className="w-3.5 h-3.5 mr-1.5" /> Save defaults
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader icon={Wrench} title="Maintenance types" description="Categories used on maintenance tickets with default SLAs" accent="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Input value={newMaint.name} onChange={e => setNewMaint({ ...newMaint, name: e.target.value })} placeholder="Type (e.g. Locksmith)" className="h-9 text-[13px] flex-1" data-testid="new-maint-name" />
          <Input type="number" min={1} max={720} value={newMaint.sla_hours} onChange={e => setNewMaint({ ...newMaint, sla_hours: e.target.value })} placeholder="SLA hrs" className="h-9 text-[13px] sm:w-[120px]" data-testid="new-maint-sla" />
          <Button onClick={addMaint} className="bg-brand hover:bg-brand-dark text-white h-9 text-[13px]" data-testid="add-maint">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add
          </Button>
        </div>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {maintenance.map(m => (
            <li key={m.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/60" data-testid={`maint-${m.id}`}>
              <div className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{m.name}</span>
                <Badge className="text-[10px] border-0 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">SLA {m.sla_hours}h</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeMaint(m.id)} className="text-rose-500"><Trash2 className="w-3.5 h-3.5" /></Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// PHASE 19 — BROKERAGE PRE-LEASE GOOGLE SHEET
// ═══════════════════════════════════════════════════════════════════════════
function BrokerageSheetCard() {
  const { data: status, isLoading } = useBrokerageSheetStatus();
  const enable = useEnableBrokerageSheet();
  const sync = useSyncBrokerageSheet();
  const share = useShareBrokerageSheet();
  const revokeShare = useRevokeBrokerageSheetShare();
  const disconnect = useDisconnectBrokerageSheet();
  const startOAuth = useStartSheetsOAuth();
  const [busy, setBusy] = React.useState('');

  if (isLoading) {
    return (
      <Card>
        <div className="h-24 bg-slate-100 dark:bg-slate-700/60 rounded-lg animate-pulse" />
      </Card>
    );
  }
  if (!status) return null;

  const gate = (() => {
    if (!status.is_admin)         return { kind: 'admin_only', title: 'Brokerage admin only', desc: 'Ask a brokerage admin in your team to enable this feature.' };
    if (!status.feature_available) return { kind: 'plan',      title: 'Upgrade to Brokerage Pro', desc: 'The pre-lease Google Sheet is available on the Brokerage Pro and Enterprise plans.' };
    if (!status.keys_configured)   return { kind: 'keys',      title: 'Google OAuth not configured', desc: 'Your tech admin needs to set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend .env file, then restart the server.' };
    if (!status.connected)         return { kind: 'connect',   title: 'Connect Google Sheets',    desc: 'Authorize PropFlow to create and maintain your Brokerage Pre-Lease List in your own Google Drive.' };
    return null;
  })();

  const connectGoogle = async () => {
    try {
      const res = await startOAuth.mutateAsync();
      if (res?.auth_url) window.location.href = res.auth_url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not start Google OAuth');
    }
  };

  const handleEnable = async () => {
    setBusy('enable');
    try { await enable.mutateAsync(); toast.success('Brokerage Pre-Lease Sheet created in your Google Drive'); }
    catch (e) { toast.error(e?.response?.data?.detail || 'Could not create sheet'); }
    setBusy('');
  };

  const handleSync = async () => {
    setBusy('sync');
    try { const res = await sync.mutateAsync(); toast.success(`Synced ${res.data?.rows ?? 0} listings`); }
    catch (e) { toast.error('Sync failed'); }
    setBusy('');
  };

  const handleShare = async () => {
    setBusy('share');
    try { await share.mutateAsync(); toast.success('View-only link created'); }
    catch (e) { toast.error(e?.response?.data?.detail || 'Could not create share link'); }
    setBusy('');
  };

  const handleRevoke = async () => {
    if (!window.confirm('Revoke the public view-only link?')) return;
    try { await revokeShare.mutateAsync(); toast.success('Share link revoked'); }
    catch { toast.error('Could not revoke'); }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect PropFlow from Google Sheets? The spreadsheet remains in your Drive.')) return;
    try { await disconnect.mutateAsync(); toast.success('Disconnected'); }
    catch { toast.error('Could not disconnect'); }
  };

  const copyLink = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  return (
    <Card className="bg-gradient-to-br from-emerald-50/70 via-white to-brand/5 dark:from-emerald-900/15 dark:via-slate-800 dark:to-brand/10 border-emerald-200/70 dark:border-emerald-800/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <SheetIcon className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[14px] font-bold text-slate-900 dark:text-slate-100">Brokerage Pre-Lease Sheet</h3>
              <Badge className="text-[10px] border-0 bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-ring">Brokerage Pro</Badge>
              <Badge className="text-[10px] border-0 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                <GraduationCap className="w-3 h-3 mr-0.5" /> Student rental
              </Badge>
            </div>
            <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5 max-w-xl">
              Auto-sync every active listing from every agent into a single shareable Google Sheet. PropFlow maintains the "Live Listings" tab; you own and edit everything else.
            </p>
          </div>
        </div>
        {status.connected && status.enabled && (
          <Badge className="text-[10px] border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 shrink-0">
            <CircleCheck className="w-3 h-3 mr-0.5" /> Active
          </Badge>
        )}
      </div>

      {/* GATE STATES */}
      {gate && (
        <div className="mt-4 bg-white/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/60 rounded-lg p-4 flex items-start gap-3" data-testid={`brokerage-sheet-gate-${gate.kind}`}>
          <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
            {gate.kind === 'admin_only' ? <Lock className="w-4 h-4" /> :
             gate.kind === 'plan'       ? <Sparkles className="w-4 h-4" /> :
             gate.kind === 'keys'       ? <Key className="w-4 h-4" /> :
                                          <LinkIcon className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{gate.title}</p>
            <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5">{gate.desc}</p>
            {gate.kind === 'keys' && (
              <div className="mt-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-md p-2.5 space-y-1">
                <p className="text-[11px] text-slate-600 dark:text-slate-400">Redirect URI to register in Google Cloud Console:</p>
                <code className="block text-[11px] font-mono text-slate-800 dark:text-slate-200 break-all bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                  {status.redirect_uri}
                </code>
                <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-1">
                  Scopes: <code className="text-[10px]">spreadsheets</code>, <code className="text-[10px]">drive.file</code>, <code className="text-[10px]">userinfo.email</code>
                </p>
              </div>
            )}
            {gate.kind === 'connect' && (
              <Button size="sm" onClick={connectGoogle} className="mt-3 h-9 text-[13px] bg-brand hover:bg-brand-dark text-white" data-testid="connect-google-sheets">
                <LinkIcon className="w-3.5 h-3.5 mr-1.5" /> Connect Google Sheets
              </Button>
            )}
            {gate.kind === 'plan' && (
              <Button size="sm" variant="outline" className="mt-3 h-9 text-[13px]" disabled data-testid="upgrade-pro">Contact sales to upgrade</Button>
            )}
          </div>
        </div>
      )}

      {/* READY STATE */}
      {!gate && !status.enabled && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={handleEnable} disabled={busy === 'enable'} className="h-9 text-[13px] bg-brand hover:bg-brand-dark text-white" data-testid="create-brokerage-sheet">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> {busy === 'enable' ? 'Creating sheet…' : 'Create the sheet in my Drive'}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDisconnect} className="h-9 text-[12px] text-rose-500" data-testid="disconnect-sheets">
            Disconnect Google
          </Button>
        </div>
      )}

      {/* ENABLED — main dashboard */}
      {!gate && status.enabled && status.sheet_url && (
        <div className="mt-4 space-y-3" data-testid="brokerage-sheet-active">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Stat label="Listings synced"  value={status.last_row_count ?? 0} />
            <Stat label="Last synced"       value={status.last_synced_at ? new Date(status.last_synced_at).toLocaleTimeString() : '—'} />
            <Stat label="Status"            value={status.last_sync_status === 'error' ? 'Error' : 'Live'} />
            <Stat label="Share link"        value={status.share_url ? 'Active' : 'Off'} />
          </div>

          {status.last_sync_status === 'error' && (
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/60 rounded-md p-3">
              <p className="text-[12px] text-rose-800 dark:text-rose-300 font-semibold">Last sync failed</p>
              <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5 font-mono break-all">{status.last_sync_error}</p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <a href={status.sheet_url} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="h-9 text-[13px]" data-testid="open-sheet">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open in Google Sheets
              </Button>
            </a>
            <Button size="sm" variant="outline" className="h-9 text-[13px]" onClick={handleSync} disabled={busy === 'sync'} data-testid="sync-now">
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${busy === 'sync' ? 'animate-spin' : ''}`} /> Sync now
            </Button>
            {!status.share_url ? (
              <Button size="sm" onClick={handleShare} disabled={busy === 'share'} className="h-9 text-[13px] bg-brand hover:bg-brand-dark text-white" data-testid="share-sheet">
                <LinkIcon className="w-3.5 h-3.5 mr-1.5" /> Create view-only link
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" className="h-9 text-[13px]" onClick={() => copyLink(status.share_url)} data-testid="copy-share-link">
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy view link
                </Button>
                <Button size="sm" variant="ghost" className="h-9 text-[13px] text-rose-500" onClick={handleRevoke} data-testid="revoke-share">
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Revoke access
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={handleDisconnect} className="h-9 text-[12px] text-slate-500 ml-auto" data-testid="disconnect-sheets-active">
              Disconnect
            </Button>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/60 rounded-lg p-3 text-[12px] text-slate-600 dark:text-slate-400">
            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> What PropFlow writes to</p>
            <ul className="list-disc ml-5 space-y-0.5">
              <li>Only the <code className="bg-white dark:bg-slate-800 px-1 rounded font-mono text-[11px]">Live Listings</code> tab — never any tab you add (Instructions, Pricing Notes, etc.).</li>
              <li>Refreshed every 60 seconds with every active listing across your team.</li>
              <li>Columns: Property · Unit # · Address · Rent · Availability · Status · Proximity to Campus · Bus Routes · Pet Policy · Last Updated · Listing Agent.</li>
              <li>You own the spreadsheet in full — add tabs, formulas, formatting; PropFlow won't touch them.</li>
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
