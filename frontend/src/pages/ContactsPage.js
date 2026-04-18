import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useContacts, useDeleteContact, useImportContacts } from '../hooks/useApi';
import { Plus, Search, Phone, Mail, Building, Tag, MoreHorizontal, Sparkles, Trash2, Edit, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Textarea } from '../components/ui/textarea';

const PROPERTY_TYPES = [
  { value: 'residential_lease', label: 'Residential Lease' },
  { value: 'commercial_sale', label: 'Commercial Sale' },
  { value: 'commercial_lease', label: 'Commercial Lease' },
];

export default function ContactsPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterType, setFilterType] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const navigate = useNavigate();

  const { data: contacts = [], isLoading: loading, error } = useContacts(search, filterType);
  const deleteMutation = useDeleteContact();
  const importMutation = useImportContacts();
  const queryClient = useQueryClient();

  const invalidateContacts = () => queryClient.invalidateQueries({ queryKey: ['contacts'] });

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this contact?')) return;
    deleteMutation.mutate(id);
  };

  const handleAIScore = async (id) => {
    try {
      const { data } = await api.post('/ai/lead-score', { contact_id: id });
      alert(`Lead Score: ${data.score}/100\n\n${data.reasoning}\n\nNext: ${data.next_action}`);
    } catch (err) {
      alert('AI scoring failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/contacts/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { alert('Export failed: ' + (err.response?.data?.detail || err.message)); }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/contacts/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contact_import_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { alert('Download failed'); }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    importMutation.mutate(formData, {
      onSuccess: ({ data }) => {
        alert(`Imported ${data.imported} of ${data.total_rows} contacts.${data.errors?.length ? `\n\nErrors:\n${data.errors.join('\n')}` : ''}`);
      },
      onError: (err) => {
        alert('Import failed: ' + (err.response?.data?.detail || err.message));
      },
    });
    e.target.value = '';
  };

  if (error) return <div className="p-4 sm:p-6 lg:p-8"><div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">Failed to load contacts. Please try again.</div></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5" data-testid="contacts-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Contacts</h1>
          <p className="text-sm text-slate-500 mt-1">{contacts.length} contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5" data-testid="export-contacts-csv">
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5" data-testid="download-contact-template-btn">
            <FileSpreadsheet className="w-4 h-4" /> Template
          </Button>
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" className="gap-1.5 pointer-events-none" data-testid="import-contacts-csv">
              <Upload className="w-4 h-4" /> Import
            </Button>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImportCSV} className="hidden" />
          </label>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 text-white hover:bg-slate-800 gap-2" data-testid="add-contact-button">
                <Plus className="w-4 h-4" /> Add Contact
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md" data-testid="add-contact-dialog">
            <DialogHeader><DialogTitle>Add New Contact</DialogTitle></DialogHeader>
            <ContactForm onSubmit={async (d) => { await api.post('/contacts', d); setShowAdd(false); invalidateContacts(); }} />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap" data-testid="contacts-filters">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-white border-slate-200 h-9 text-sm" data-testid="contacts-search-input" />
        </div>
        <Select value={filterType} onValueChange={v => setFilterType(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px] h-9 text-sm bg-white" data-testid="contacts-type-filter">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {PROPERTY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div>
      ) : contacts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center" data-testid="contacts-empty-state">
          <p className="text-slate-500 text-sm mb-3">No contacts yet. Add your first contact or import via API.</p>
          <Button onClick={() => setShowAdd(true)} className="bg-slate-900 text-white hover:bg-slate-800 gap-2"><Plus className="w-4 h-4" /> Add Contact</Button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden" data-testid="contacts-table">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200">
                  <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Name</th>
                  <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4 hidden sm:table-cell">Contact</th>
                  <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4 hidden md:table-cell">Type</th>
                  <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4 hidden lg:table-cell">Source</th>
                  <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Score</th>
                  <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)} data-testid={`contact-row-${c.id}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-slate-600">{c.name?.charAt(0)?.toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{c.name}</p>
                          {c.company && <p className="text-xs text-slate-500">{c.company}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <div className="space-y-0.5">
                        {c.email && <p className="text-sm text-slate-600 flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</p>}
                        {c.phone && <p className="text-sm text-slate-600 flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</p>}
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <Badge variant="outline" className="text-xs">{PROPERTY_TYPES.find(t => t.value === c.property_type)?.label || c.property_type}</Badge>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <span className="text-sm text-slate-500">{c.source}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${c.lead_score >= 70 ? 'bg-green-100 text-green-800' : c.lead_score >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                        {c.lead_score || 0}
                      </div>
                    </td>
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`contact-menu-${c.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditContact(c)} data-testid={`edit-contact-${c.id}`}>
                            <Edit className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAIScore(c.id)} data-testid={`score-contact-${c.id}`}>
                            <Sparkles className="w-4 h-4 mr-2 text-amber-500" /> AI Score
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(c.id)} className="text-red-600" data-testid={`delete-contact-${c.id}`}>
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editContact} onOpenChange={(o) => { if (!o) setEditContact(null); }}>
        <DialogContent className="sm:max-w-md" data-testid="edit-contact-dialog">
          <DialogHeader><DialogTitle>Edit Contact</DialogTitle></DialogHeader>
          {editContact && <ContactForm initial={editContact} onSubmit={async (d) => { await api.put(`/contacts/${editContact.id}`, d); setEditContact(null); invalidateContacts(); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactForm({ initial, onSubmit }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    company: initial?.company || '',
    source: initial?.source || 'manual',
    property_type: initial?.property_type || 'residential_lease',
    notes: initial?.notes || '',
    tags: initial?.tags || [],
  });
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
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
          <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="bg-white border-slate-300" data-testid="contact-form-name" />
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Email</Label>
          <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="bg-white border-slate-300" data-testid="contact-form-email" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Phone</Label>
          <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="bg-white border-slate-300" data-testid="contact-form-phone" />
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Company</Label>
          <Input value={form.company} onChange={e => setForm({...form, company: e.target.value})} className="bg-white border-slate-300" data-testid="contact-form-company" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Type</Label>
          <Select value={form.property_type} onValueChange={v => setForm({...form, property_type: v})}>
            <SelectTrigger className="bg-white" data-testid="contact-form-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Source</Label>
          <Select value={form.source} onValueChange={v => setForm({...form, source: v})}>
            <SelectTrigger className="bg-white" data-testid="contact-form-source"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['manual', 'website', 'referral', 'zillow', 'realtor', 'cold_call', 'maxclaw'].map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Tags</Label>
        <div className="flex gap-2 flex-wrap mb-2">
          {form.tags.map(t => (
            <Badge key={t} variant="secondary" className="gap-1 cursor-pointer" onClick={() => setForm({...form, tags: form.tags.filter(x => x !== t)})}>
              {t} <span className="text-xs">&times;</span>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add tag" className="bg-white border-slate-300 flex-1" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); }}} data-testid="contact-form-tag-input" />
          <Button type="button" variant="outline" size="sm" onClick={addTag}><Tag className="w-3 h-3 mr-1" /> Add</Button>
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Notes</Label>
        <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="bg-white border-slate-300" data-testid="contact-form-notes" />
      </div>
      <Button type="submit" disabled={submitting} className="w-full bg-slate-900 text-white hover:bg-slate-800" data-testid="contact-form-submit">
        {submitting ? 'Saving...' : initial ? 'Update Contact' : 'Add Contact'}
      </Button>
    </form>
  );
}
