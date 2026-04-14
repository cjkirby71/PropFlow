import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { Key, Plus, Copy, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';

export default function SettingsPage() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [showKeys, setShowKeys] = useState({});

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api-keys');
      setKeys(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    try {
      const { data } = await api.post('/api-keys', { name: newKeyName || 'API Key' });
      setNewKey(data.key);
      fetchKeys();
    } catch (err) {
      alert(err.response?.data?.detail || err.message);
    }
  };

  const handleDelete = async (keyPreview) => {
    if (!window.confirm('Delete this API key?')) return;
    try {
      await api.delete(`/api-keys/${keyPreview}`);
      fetchKeys();
    } catch (err) {
      alert(err.response?.data?.detail || err.message);
    }
  };

  const toggleShow = (i) => setShowKeys(prev => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6" data-testid="settings-page">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage API keys for external agent integration</p>
      </div>

      {/* API Keys Section */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 sm:p-6" data-testid="api-keys-section">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><Key className="w-5 h-5 text-slate-500" /> API Keys</h2>
            <p className="text-sm text-slate-500 mt-0.5">Use these keys to authenticate your MaxClaw agent or other external integrations</p>
          </div>
          <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) { setNewKey(''); setNewKeyName(''); } }}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 text-white hover:bg-slate-800 gap-2" data-testid="create-api-key-button">
                <Plus className="w-4 h-4" /> Create Key
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="create-api-key-dialog">
              <DialogHeader><DialogTitle>Create API Key</DialogTitle></DialogHeader>
              {!newKey ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Key Name</Label>
                    <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="e.g., MaxClaw Agent" className="bg-white border-slate-300" data-testid="api-key-name-input" />
                  </div>
                  <Button onClick={handleCreate} className="w-full bg-slate-900 text-white hover:bg-slate-800" data-testid="generate-api-key-button">Generate Key</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <p className="text-sm text-green-800 font-medium mb-2">Key created! Copy it now - you won't see it again.</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white border border-green-200 rounded px-2 py-1.5 font-mono break-all">{newKey}</code>
                      <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(newKey)} data-testid="copy-api-key-button">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                    <p className="text-xs text-slate-600 font-medium mb-1">Usage with your MaxClaw agent:</p>
                    <code className="text-xs text-slate-500 font-mono">X-API-Key: {newKey}</code>
                  </div>
                  <Button variant="outline" onClick={() => { setShowAdd(false); setNewKey(''); setNewKeyName(''); }} className="w-full">Done</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg" data-testid="api-keys-empty">
            <Key className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No API keys yet. Create one to connect your external agents.</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="api-keys-list">
            {keys.map((k, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors" data-testid={`api-key-item-${i}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">{k.name}</p>
                    <Badge variant={k.active ? 'default' : 'secondary'} className="text-xs">{k.active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs text-slate-500 font-mono">{showKeys[i] ? k.full_key : k.key_preview}</code>
                    <button onClick={() => toggleShow(i)} className="text-slate-400 hover:text-slate-600">
                      {showKeys[i] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Created {new Date(k.created_at).toLocaleDateString()} {k.last_used && `· Last used ${new Date(k.last_used).toLocaleDateString()}`}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(k.full_key)} data-testid={`copy-key-${i}`}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(k.key_preview)} className="text-red-500 hover:text-red-700 hover:bg-red-50" data-testid={`delete-key-${i}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Documentation */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 sm:p-6" data-testid="api-docs-section">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">API Documentation</h2>
        <p className="text-sm text-slate-600 mb-4">Use these endpoints with your MaxClaw agent to programmatically manage your CRM data.</p>
        <div className="space-y-3">
          {[
            { method: 'POST', path: '/api/contacts', desc: 'Create a new contact' },
            { method: 'GET', path: '/api/contacts', desc: 'List all contacts' },
            { method: 'POST', path: '/api/deals', desc: 'Create a new deal' },
            { method: 'GET', path: '/api/deals', desc: 'List deals' },
            { method: 'POST', path: '/api/activities', desc: 'Log an activity' },
            { method: 'POST', path: '/api/tasks', desc: 'Create a task' },
            { method: 'POST', path: '/api/properties', desc: 'Add a property' },
            { method: 'POST', path: '/api/ai/draft-email', desc: 'AI-generate follow-up email' },
            { method: 'POST', path: '/api/ai/lead-score', desc: 'AI score a lead' },
          ].map((ep, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
              <Badge className={`text-xs font-mono ${ep.method === 'POST' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{ep.method}</Badge>
              <code className="text-xs text-slate-700 font-mono">{ep.path}</code>
              <span className="text-xs text-slate-500 ml-auto">{ep.desc}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-slate-900 rounded-lg p-4">
          <p className="text-xs text-slate-400 mb-2 font-mono"># Example: Create a contact via API</p>
          <code className="text-xs text-green-400 font-mono break-all">
            curl -X POST {process.env.REACT_APP_BACKEND_URL || 'https://your-app.com'}/api/contacts \<br />
            &nbsp;&nbsp;-H "X-API-Key: your_api_key" \<br />
            &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
            &nbsp;&nbsp;-d '{`{"name": "John Doe", "email": "john@example.com", "property_type": "residential_lease"}`}'
          </code>
        </div>
      </div>
    </div>
  );
}
