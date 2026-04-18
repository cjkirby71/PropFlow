import React, { useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useApiKeys, useCreateApiKey, useDeleteApiKey, useTeamMembers, useInviteTeamMember, useRemoveTeamMember, useWebhooks, useCreateWebhook, useDeleteWebhook, useToggleWebhook } from '../hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Copy, Trash2, Eye, EyeOff, Users, Webhook, UserPlus, Shield, Globe, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';

const WEBHOOK_EVENTS = [
  { value: 'new_lead', label: 'New Lead Created' },
  { value: 'deal_stage_change', label: 'Deal Stage Change' },
  { value: 'email_sent', label: 'Email Sent' },
  { value: 'sms_sent', label: 'SMS Sent' },
  { value: 'new_activity', label: 'New Activity Logged' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('api-keys');

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6" data-testid="settings-page">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage API keys, team, webhooks, and integrations</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="settings-tabs">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="api-keys" className="data-[state=active]:bg-white gap-1.5"><Key className="w-3.5 h-3.5" /> API Keys</TabsTrigger>
          <TabsTrigger value="team" className="data-[state=active]:bg-white gap-1.5"><Users className="w-3.5 h-3.5" /> Team</TabsTrigger>
          <TabsTrigger value="webhooks" className="data-[state=active]:bg-white gap-1.5"><Webhook className="w-3.5 h-3.5" /> Webhooks</TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-white gap-1.5"><Globe className="w-3.5 h-3.5" /> Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys"><APIKeysSection /></TabsContent>
        <TabsContent value="team"><TeamSection isAdmin={user?.role === 'admin'} /></TabsContent>
        <TabsContent value="webhooks"><WebhooksSection /></TabsContent>
        <TabsContent value="integrations"><IntegrationsSection /></TabsContent>
      </Tabs>
    </div>
  );
}

function APIKeysSection() {
  const [showAdd, setShowAdd] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [showKeys, setShowKeys] = useState({});
  const queryClient = useQueryClient();

  const { data: keys = [], isLoading: loading } = useApiKeys();
  const deleteKey = useDeleteApiKey();

  const handleCreate = async () => {
    try {
      const { data } = await api.post('/api-keys', { name: newKeyName || 'API Key' });
      setNewKey(data.key);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    } catch (err) { alert(err.response?.data?.detail || err.message); }
  };
  const handleDelete = (keyPreview) => {
    if (!window.confirm('Delete this API key?')) return;
    deleteKey.mutate(keyPreview);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 sm:p-6" data-testid="api-keys-section">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><Key className="w-5 h-5 text-slate-500" /> API Keys</h2>
          <p className="text-sm text-slate-500 mt-0.5">Connect your MaxClaw agent or external integrations</p>
        </div>
        <Dialog open={showAdd} onOpenChange={o => { setShowAdd(o); if (!o) { setNewKey(''); setNewKeyName(''); } }}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 text-white hover:bg-slate-800 gap-2" data-testid="create-api-key-button"><Plus className="w-4 h-4" /> Create Key</Button>
          </DialogTrigger>
          <DialogContent data-testid="create-api-key-dialog">
            <DialogHeader><DialogTitle>Create API Key</DialogTitle></DialogHeader>
            {!newKey ? (
              <div className="space-y-4">
                <div><Label className="text-sm font-medium text-slate-700 mb-1.5 block">Key Name</Label><Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="e.g., MaxClaw Agent" className="bg-white border-slate-300" data-testid="api-key-name-input" /></div>
                <Button onClick={handleCreate} className="w-full bg-slate-900 text-white hover:bg-slate-800" data-testid="generate-api-key-button">Generate Key</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-md p-3"><p className="text-sm text-green-800 font-medium mb-2">Key created! Copy it now - you won't see it again.</p><div className="flex items-center gap-2"><code className="flex-1 text-xs bg-white border border-green-200 rounded px-2 py-1.5 font-mono break-all">{newKey}</code><Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(newKey)} data-testid="copy-api-key-button"><Copy className="w-4 h-4" /></Button></div></div>
                <div className="bg-slate-900 rounded-lg p-4"><p className="text-xs text-slate-400 mb-1 font-mono"># Usage with MaxClaw agent</p><code className="text-xs text-green-400 font-mono">X-API-Key: {newKey}</code></div>
                <Button variant="outline" onClick={() => { setShowAdd(false); setNewKey(''); }} className="w-full">Done</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div> :
        keys.length === 0 ? <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg"><Key className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">No API keys yet.</p></div> :
        <div className="space-y-3" data-testid="api-keys-list">
          {keys.map((k, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors" data-testid={`api-key-item-${i}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><p className="text-sm font-medium text-slate-900">{k.name}</p><Badge variant={k.active ? 'default' : 'secondary'} className="text-xs">{k.active ? 'Active' : 'Inactive'}</Badge></div>
                <div className="flex items-center gap-2 mt-1"><code className="text-xs text-slate-500 font-mono">{showKeys[i] ? k.full_key : k.key_preview}</code><button onClick={() => setShowKeys(p => ({...p, [i]: !p[i]}))} className="text-slate-400 hover:text-slate-600">{showKeys[i] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button></div>
                <p className="text-xs text-slate-400 mt-0.5">Created {new Date(k.created_at).toLocaleDateString()}{k.last_used && ` · Last used ${new Date(k.last_used).toLocaleDateString()}`}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(k.full_key)}><Copy className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(k.key_preview)} className="text-red-500 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

function TeamSection({ isAdmin }) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'agent' });
  const [inviteResult, setInviteResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: members = [], isLoading: loading } = useTeamMembers();
  const removeMember = useRemoveTeamMember();

  const handleInvite = async () => {
    try {
      const { data } = await api.post('/team/invite', inviteForm);
      setInviteResult(data);
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    } catch (err) { alert(err.response?.data?.detail || err.message); }
  };

  const handleRemove = (id) => {
    if (!window.confirm('Remove this team member?')) return;
    removeMember.mutate(id);
  };

  const handleRoleChange = async (id, role) => {
    try { await api.put(`/team/members/${id}/role`, { role }); queryClient.invalidateQueries({ queryKey: ['team-members'] }); } catch {}
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 sm:p-6" data-testid="team-section">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><Users className="w-5 h-5 text-slate-500" /> Team Members</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage your team and their roles</p>
        </div>
        {isAdmin && (
          <Dialog open={showInvite} onOpenChange={o => { setShowInvite(o); if (!o) { setInviteResult(null); setInviteForm({ email: '', name: '', role: 'agent' }); } }}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 text-white hover:bg-slate-800 gap-2" data-testid="invite-member-button"><UserPlus className="w-4 h-4" /> Invite Member</Button>
            </DialogTrigger>
            <DialogContent data-testid="invite-member-dialog">
              <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
              {!inviteResult ? (
                <div className="space-y-4">
                  <div><Label className="text-sm font-medium text-slate-700 mb-1.5 block">Name</Label><Input value={inviteForm.name} onChange={e => setInviteForm({...inviteForm, name: e.target.value})} placeholder="John Doe" className="bg-white border-slate-300" data-testid="invite-name-input" /></div>
                  <div><Label className="text-sm font-medium text-slate-700 mb-1.5 block">Email</Label><Input type="email" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})} placeholder="john@company.com" className="bg-white border-slate-300" data-testid="invite-email-input" /></div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Role</Label>
                    <Select value={inviteForm.role} onValueChange={v => setInviteForm({...inviteForm, role: v})}>
                      <SelectTrigger className="bg-white" data-testid="invite-role-select"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="agent">Agent</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleInvite} className="w-full bg-slate-900 text-white hover:bg-slate-800" data-testid="invite-submit-button">Send Invite</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <p className="text-sm text-green-800 font-medium mb-2">Member invited!</p>
                    <p className="text-sm text-slate-700">Email: <strong>{inviteResult.email}</strong></p>
                    <p className="text-sm text-slate-700">Temp Password: <code className="bg-white border rounded px-1.5 py-0.5 font-mono text-xs">{inviteResult.temp_password}</code></p>
                    <p className="text-xs text-slate-500 mt-2">Share these credentials securely with the team member.</p>
                  </div>
                  <Button variant="outline" onClick={() => { setShowInvite(false); setInviteResult(null); }} className="w-full">Done</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div> :
        <div className="space-y-3" data-testid="team-members-list">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg" data-testid={`team-member-${m.id}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center"><span className="text-sm font-semibold text-slate-600">{m.name?.charAt(0)?.toUpperCase()}</span></div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{m.name}</p>
                  <p className="text-xs text-slate-500">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <Select value={m.role} onValueChange={v => handleRoleChange(m.id, v)}>
                    <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="agent">Agent</SelectItem></SelectContent>
                  </Select>
                ) : (
                  <Badge variant={m.role === 'admin' ? 'default' : 'secondary'} className="text-xs flex items-center gap-1"><Shield className="w-3 h-3" /> {m.role}</Badge>
                )}
                {isAdmin && <Button variant="ghost" size="sm" onClick={() => handleRemove(m.id)} className="text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>}
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

function WebhooksSection() {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ url: '', name: '', events: [] });
  const queryClient = useQueryClient();

  const { data: webhooks = [], isLoading: loading } = useWebhooks();
  const deleteWebhook = useDeleteWebhook();
  const toggleWebhook = useToggleWebhook();

  const handleCreate = async () => {
    if (!form.url || form.events.length === 0) return alert('URL and at least one event required');
    try {
      await api.post('/webhooks', form);
      setShowAdd(false);
      setForm({ url: '', name: '', events: [] });
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    } catch (err) { alert(err.response?.data?.detail || err.message); }
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this webhook?')) return;
    deleteWebhook.mutate(id);
  };

  const handleToggle = (id) => {
    toggleWebhook.mutate(id);
  };

  const toggleEvent = (evt) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(evt) ? f.events.filter(e => e !== evt) : [...f.events, evt]
    }));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 sm:p-6" data-testid="webhooks-section">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><Webhook className="w-5 h-5 text-slate-500" /> Webhooks</h2>
          <p className="text-sm text-slate-500 mt-0.5">Get real-time notifications when events occur in your CRM</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 text-white hover:bg-slate-800 gap-2" data-testid="create-webhook-button"><Plus className="w-4 h-4" /> Add Webhook</Button>
          </DialogTrigger>
          <DialogContent data-testid="create-webhook-dialog">
            <DialogHeader><DialogTitle>Create Webhook</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label className="text-sm font-medium text-slate-700 mb-1.5 block">Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="MaxClaw Notifications" className="bg-white border-slate-300" data-testid="webhook-name-input" /></div>
              <div><Label className="text-sm font-medium text-slate-700 mb-1.5 block">URL</Label><Input value={form.url} onChange={e => setForm({...form, url: e.target.value})} placeholder="https://your-agent.com/webhook" className="bg-white border-slate-300" data-testid="webhook-url-input" /></div>
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-2 block">Events</Label>
                <div className="space-y-2">
                  {WEBHOOK_EVENTS.map(evt => (
                    <label key={evt.value} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={form.events.includes(evt.value)} onCheckedChange={() => toggleEvent(evt.value)} data-testid={`webhook-event-${evt.value}`} />
                      <span className="text-sm text-slate-700">{evt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full bg-slate-900 text-white hover:bg-slate-800" data-testid="webhook-submit-button">Create Webhook</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div> :
        webhooks.length === 0 ? <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg"><Webhook className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">No webhooks configured. Add one to get real-time notifications.</p></div> :
        <div className="space-y-3" data-testid="webhooks-list">
          {webhooks.map(w => (
            <div key={w.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg" data-testid={`webhook-item-${w.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><p className="text-sm font-medium text-slate-900">{w.name}</p><Badge variant={w.active ? 'default' : 'secondary'} className="text-xs">{w.active ? 'Active' : 'Paused'}</Badge></div>
                <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">{w.url}</p>
                <div className="flex items-center gap-1 mt-1 flex-wrap">{w.events?.map(e => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}</div>
                {w.last_triggered && <p className="text-xs text-slate-400 mt-0.5">Last triggered: {new Date(w.last_triggered).toLocaleString()}</p>}
              </div>
              <div className="flex items-center gap-1 ml-3">
                <Button variant="ghost" size="sm" onClick={() => handleToggle(w.id)} data-testid={`webhook-toggle-${w.id}`}>
                  {w.active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(w.id)} className="text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

function IntegrationsSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [autoAssign, setAutoAssign] = useState(user?.auto_assign || false);
  const { useApi } = require('../hooks/useApi');
  const { updateUserSettingsMutation } = useApi();
  
  const updateSettings = updateUserSettingsMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    }
  });

  const handleAutoAssignToggle = async () => {
    const newValue = !autoAssign;
    setAutoAssign(newValue);
    await updateSettings.mutateAsync({ auto_assign: newValue });
  };

  return (
    <div className="space-y-4" data-testid="integrations-section">
      {/* Round-Robin Assignment */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Round-Robin Lead Assignment</h3>
              <p className="text-xs text-slate-500 mt-0.5">Automatically distribute new contacts and deals to agents with the fewest open deals</p>
            </div>
          </div>
          <Button
            variant={autoAssign ? "default" : "outline"}
            size="sm"
            onClick={handleAutoAssignToggle}
            disabled={updateSettings.isPending}
          >
            {autoAssign ? <ToggleRight className="w-4 h-4 mr-1" /> : <ToggleLeft className="w-4 h-4 mr-1" />}
            {autoAssign ? 'Enabled' : 'Disabled'}
          </Button>
        </div>
        {autoAssign && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-xs text-green-700">✓ Auto-assignment is active. New contacts and deals will be distributed fairly across your team.</p>
          </div>
        )}
      </div>

      {/* Google Calendar Sync */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Google Calendar Sync</h3>
              <p className="text-xs text-slate-500 mt-0.5">Sync PropFlow tasks and activities with Google Calendar</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs border-amber-200 text-amber-700">Coming Soon</Badge>
        </div>
        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-md p-3">
          <p className="text-xs text-slate-600">Full Google Calendar integration will be available soon. Requires Google OAuth credentials.</p>
        </div>
      </div>

      {/* Brevo */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0"><Globe className="w-5 h-5 text-blue-600" /></div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Brevo Email</h3>
              <p className="text-xs text-slate-500 mt-0.5">Send emails directly from PropFlow using your brokerage address (free: 300 emails/day)</p>
              <p className="text-xs text-slate-400 mt-1">Sender: craig@respaceteam.com</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs border-amber-200 text-amber-700">Add API Key</Badge>
        </div>
        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-md p-3">
          <p className="text-xs text-slate-600">To enable: Add <code className="bg-white px-1 rounded text-xs font-mono">BREVO_API_KEY</code> in your backend .env file.</p>
          <p className="text-xs text-slate-500 mt-1">Get your key at <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">brevo.com</a> (Settings &gt; SMTP & API &gt; API Keys)</p>
        </div>
      </div>

      {/* Twilio */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0"><Globe className="w-5 h-5 text-red-600" /></div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Twilio SMS</h3>
              <p className="text-xs text-slate-500 mt-0.5">Send text messages to leads directly from contact pages</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs border-amber-200 text-amber-700">Add API Key</Badge>
        </div>
        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-md p-3">
          <p className="text-xs text-slate-600">To enable: Add <code className="bg-white px-1 rounded text-xs font-mono">TWILIO_ACCOUNT_SID</code>, <code className="bg-white px-1 rounded text-xs font-mono">TWILIO_AUTH_TOKEN</code>, and <code className="bg-white px-1 rounded text-xs font-mono">TWILIO_PHONE_NUMBER</code> in your backend .env file.</p>
          <p className="text-xs text-slate-500 mt-1">Get credentials at <a href="https://www.twilio.com/console" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">twilio.com</a></p>
        </div>
      </div>

      {/* AI */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0"><Globe className="w-5 h-5 text-amber-600" /></div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">AI Features (OpenAI GPT-5.2)</h3>
              <p className="text-xs text-slate-500 mt-0.5">AI email drafts, lead scoring, activity summaries</p>
            </div>
          </div>
          <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-200">Connected</Badge>
        </div>
      </div>

      {/* API Docs */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">API Reference</h3>
        <div className="space-y-2">
          {[
            { method: 'POST', path: '/api/contacts', desc: 'Create contact' },
            { method: 'POST', path: '/api/contacts/import', desc: 'CSV import' },
            { method: 'GET', path: '/api/contacts/export', desc: 'CSV export' },
            { method: 'POST', path: '/api/deals', desc: 'Create deal' },
            { method: 'POST', path: '/api/sequences', desc: 'Create drip sequence' },
            { method: 'GET', path: '/api/reports', desc: 'Analytics & reporting' },
            { method: 'POST', path: '/api/activities', desc: 'Log activity' },
            { method: 'POST', path: '/api/tasks', desc: 'Create task' },
            { method: 'POST', path: '/api/email/send', desc: 'Send email' },
            { method: 'POST', path: '/api/sms/send', desc: 'Send SMS' },
            { method: 'POST', path: '/api/ai/draft-email', desc: 'AI email draft' },
            { method: 'POST', path: '/api/ai/lead-score', desc: 'AI lead scoring' },
          ].map((ep, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
              <Badge className={`text-xs font-mono w-14 justify-center ${ep.method === 'POST' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{ep.method}</Badge>
              <code className="text-xs text-slate-700 font-mono">{ep.path}</code>
              <span className="text-xs text-slate-500 ml-auto">{ep.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
