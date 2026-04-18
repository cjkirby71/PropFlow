import React, { useState } from 'react';
import api from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useTemplates, useDeleteTemplate } from '../hooks/useApi';
import { Plus, FileText, Mail, MessageCircle, Sparkles, Trash2, Edit, Copy, Hash, MoreHorizontal, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

const CATEGORIES = [
  { value: 'email', label: 'Email', icon: Mail, color: 'bg-blue-100 text-blue-700' },
  { value: 'sms', label: 'SMS', icon: MessageCircle, color: 'bg-green-100 text-green-700' },
];

const PURPOSES = [
  'Initial outreach', 'Follow-up after showing', 'Follow-up after tour',
  'Lease proposal', 'Thank you / referral request', 'Property availability',
  'Check-in / nurture', 'Appointment confirmation', 'Price reduction notice',
  'Application status update', 'Custom',
];

export default function TemplatesPage() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTpl, setEditTpl] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading: loading, error } = useTemplates(filter);
  const deleteTemplate = useDeleteTemplate();
  const invalidateTemplates = () => queryClient.invalidateQueries({ queryKey: ['templates'] });

  const handleDelete = (id) => {
    if (!window.confirm('Delete this template?')) return;
    deleteTemplate.mutate(id);
  };

  const handleCopy = (tpl) => {
    const text = tpl.category === 'email' ? `Subject: ${tpl.subject}\n\n${tpl.body}` : tpl.body;
    navigator.clipboard.writeText(text);
  };

  const filtered = templates.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5" data-testid="templates-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Templates</h1>
          <p className="text-sm text-slate-500 mt-1">{templates.length} saved templates for emails & SMS</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowAI(true)} className="gap-1.5 bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100" data-testid="ai-generate-template-button">
            <Sparkles className="w-4 h-4" /> AI Generate
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 text-white hover:bg-slate-800 gap-2" data-testid="create-template-button">
                <Plus className="w-4 h-4" /> New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg" data-testid="create-template-dialog">
              <DialogHeader><DialogTitle>Create Template</DialogTitle></DialogHeader>
              <TemplateForm onSubmit={async (d) => { await api.post('/templates', d); setShowCreate(false); invalidateTemplates(); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="bg-slate-100" data-testid="template-category-filter">
            <TabsTrigger value="all" className="data-[state=active]:bg-white text-sm">All</TabsTrigger>
            <TabsTrigger value="email" className="data-[state=active]:bg-white text-sm gap-1"><Mail className="w-3.5 h-3.5" /> Email</TabsTrigger>
            <TabsTrigger value="sms" className="data-[state=active]:bg-white text-sm gap-1"><MessageCircle className="w-3.5 h-3.5" /> SMS</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-white border-slate-200 h-9 text-sm" data-testid="template-search-input" />
        </div>
      </div>

      {/* Template Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center" data-testid="templates-empty-state">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm mb-3">{templates.length === 0 ? 'No templates yet. Create your first one or let AI generate some.' : 'No templates match your search.'}</p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => setShowAI(true)} className="gap-1.5"><Sparkles className="w-4 h-4" /> AI Generate</Button>
            <Button onClick={() => setShowCreate(true)} className="bg-slate-900 text-white hover:bg-slate-800 gap-2"><Plus className="w-4 h-4" /> New Template</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="templates-grid">
          {filtered.map(tpl => {
            const cat = CATEGORIES.find(c => c.value === tpl.category);
            const Icon = cat?.icon || FileText;
            return (
              <div key={tpl.id} className="bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden" data-testid={`template-card-${tpl.id}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cat?.color || 'bg-slate-100 text-slate-600'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 leading-tight">{tpl.name}</h3>
                        <Badge variant="outline" className="text-xs mt-0.5">{tpl.category}</Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 hover:bg-slate-100 rounded" data-testid={`template-menu-${tpl.id}`}><MoreHorizontal className="w-4 h-4 text-slate-400" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleCopy(tpl)}><Copy className="w-3.5 h-3.5 mr-2" /> Copy</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditTpl(tpl)}><Edit className="w-3.5 h-3.5 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(tpl.id)} className="text-red-600"><Trash2 className="w-3.5 h-3.5 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {tpl.subject && <p className="text-xs font-medium text-slate-700 mb-1">Subject: {tpl.subject}</p>}
                  <p className="text-xs text-slate-500 line-clamp-4 leading-relaxed">{tpl.body.slice(0, 200)}{tpl.body.length > 200 ? '...' : ''}</p>
                </div>
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {tpl.tags?.slice(0, 3).map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-1"><Hash className="w-3 h-3" /> {tpl.use_count || 0} uses</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editTpl} onOpenChange={o => { if (!o) setEditTpl(null); }}>
        <DialogContent className="sm:max-w-lg" data-testid="edit-template-dialog">
          <DialogHeader><DialogTitle>Edit Template</DialogTitle></DialogHeader>
          {editTpl && <TemplateForm initial={editTpl} onSubmit={async (d) => { await api.put(`/templates/${editTpl.id}`, d); setEditTpl(null); invalidateTemplates(); }} />}
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={showAI} onOpenChange={setShowAI}>
        <DialogContent className="sm:max-w-lg" data-testid="ai-generate-template-dialog">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> AI Generate Template</DialogTitle></DialogHeader>
          <AITemplateGenerator onGenerated={(tpl) => { setShowAI(false); setShowCreate(true); }} onSave={async (d) => { await api.post('/templates', d); setShowAI(false); invalidateTemplates(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateForm({ initial, onSubmit }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    category: initial?.category || 'email',
    subject: initial?.subject || '',
    body: initial?.body || '',
    tags: initial?.tags || [],
  });
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.body) return;
    setSubmitting(true);
    try { await onSubmit(form); } catch (err) { alert(err.response?.data?.detail || err.message); }
    setSubmitting(false);
  };

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm({ ...form, tags: [...form.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Name *</Label>
          <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="Follow-up after showing" className="bg-white border-slate-300" data-testid="template-form-name" />
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Type</Label>
          <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
            <SelectTrigger className="bg-white" data-testid="template-form-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {form.category === 'email' && (
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Subject Line</Label>
          <Input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="Re: Your property search" className="bg-white border-slate-300" data-testid="template-form-subject" />
        </div>
      )}
      <div>
        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Body *</Label>
        <Textarea value={form.body} onChange={e => setForm({...form, body: e.target.value})} required rows={form.category === 'sms' ? 3 : 8} placeholder={form.category === 'sms' ? 'Hi {contact_name}, ...' : 'Dear {contact_name},\n\n...'} className="bg-white border-slate-300" data-testid="template-form-body" />
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-slate-400">Use {'{contact_name}'}, {'{property_address}'}, {'{agent_name}'}, {'{company_name}'} as placeholders</p>
          {form.category === 'sms' && <p className="text-xs text-slate-400">{form.body.length}/160</p>}
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Tags</Label>
        <div className="flex gap-1 flex-wrap mb-2">
          {form.tags.map(t => (
            <Badge key={t} variant="secondary" className="gap-1 cursor-pointer text-xs" onClick={() => setForm({...form, tags: form.tags.filter(x => x !== t)})}>
              {t} <span>&times;</span>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add tag" className="bg-white border-slate-300 flex-1 h-8 text-sm" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); }}} />
          <Button type="button" variant="outline" size="sm" onClick={addTag} className="h-8">Add</Button>
        </div>
      </div>
      <Button type="submit" disabled={submitting} className="w-full bg-slate-900 text-white hover:bg-slate-800" data-testid="template-form-submit">
        {submitting ? 'Saving...' : initial ? 'Update Template' : 'Save Template'}
      </Button>
    </form>
  );
}

function AITemplateGenerator({ onSave }) {
  const [purpose, setPurpose] = useState('Follow-up after showing');
  const [category, setCategory] = useState('email');
  const [propertyType, setPropertyType] = useState('residential_lease');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [name, setName] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/templates/ai-generate', { purpose, category, property_type: propertyType });
      setResult(data);
      setName(purpose);
    } catch (err) {
      alert('Generation failed: ' + (err.response?.data?.detail || err.message));
    }
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!name) return;
    await onSave({ name, category: result.category, subject: result.subject || '', body: result.body, tags: [purpose.toLowerCase().replace(/\s+/g, '-'), propertyType] });
  };

  return (
    <div className="space-y-4">
      {!result ? (
        <>
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Template Purpose</Label>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger className="bg-white" data-testid="ai-template-purpose"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PURPOSES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Type</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-white" data-testid="ai-template-category"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="sms">SMS</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Property Type</Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger className="bg-white" data-testid="ai-template-property-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential_lease">Residential Lease</SelectItem>
                  <SelectItem value="commercial_sale">Commercial Sale</SelectItem>
                  <SelectItem value="commercial_lease">Commercial Lease</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="w-full bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 gap-2" data-testid="ai-template-generate-button">
            <Sparkles className="w-4 h-4" /> {generating ? 'Generating...' : 'Generate Template'}
          </Button>
        </>
      ) : (
        <>
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Template Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="bg-white border-slate-300" data-testid="ai-template-name" />
          </div>
          {result.subject && (
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Subject</p>
              <p className="text-sm text-slate-800">{result.subject}</p>
            </div>
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 max-h-60 overflow-y-auto">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wider mb-1">Body</p>
            <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans">{result.body}</pre>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setResult(null)} className="flex-1">Regenerate</Button>
            <Button onClick={handleSave} className="flex-1 bg-slate-900 text-white hover:bg-slate-800" data-testid="ai-template-save-button">Save Template</Button>
          </div>
        </>
      )}
    </div>
  );
}
