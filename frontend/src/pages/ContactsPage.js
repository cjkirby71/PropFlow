import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useContacts, useDeleteContact, useImportContacts, useContactSmartCounts } from '../hooks/useApi';
import {
  Plus, Search, Phone, Mail, Tag, MoreHorizontal, Sparkles, Trash2, Edit, Download, Upload,
  FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Users, CalendarCheck, UserPlus, UserCheck,
  FileSignature, TrendingDown, Clock, Zap, Heart, Building2, Home, Award, ChevronRight,
  SlidersHorizontal, RefreshCcw, Columns3, ChevronDown, DollarSign, MapPin, CalendarClock,
  CheckCheck, X as XIcon, Send, UserCog, ListChecks, CalendarPlus, Filter,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '../components/ui/dropdown-menu';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const PROPERTY_TYPES = [
  { value: 'residential_lease', label: 'Residential Lease' },
  { value: 'commercial_sale', label: 'Commercial Sale' },
  { value: 'commercial_lease', label: 'Commercial Lease' },
];

// Smart lists (left sidebar)
const SMART_LISTS = [
  { id: 'today_tours_followups', label: "Today's Tours & Follow-Ups", icon: CalendarCheck, color: 'text-brand dark:text-brand-ring' },
  { id: 'first_contact',        label: 'First Contact',                icon: UserPlus,      color: 'text-sky-600 dark:text-sky-400' },
  { id: 'second_contact',       label: 'Second Contact',               icon: UserCheck,     color: 'text-indigo-600 dark:text-indigo-400' },
  { id: 'application_submitted',label: 'Application Submitted',        icon: FileSignature, color: 'text-violet-600 dark:text-violet-400' },
  { id: 'at_risk_renewals',     label: 'At-Risk Renewals',             icon: TrendingDown,  color: 'text-rose-600 dark:text-rose-400' },
  { id: 'stale_prospects',      label: 'Stale Prospects',              icon: Clock,         color: 'text-amber-600 dark:text-amber-400' },
  { id: 'recently_active',      label: 'Recently Active',              icon: Zap,           color: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'nurture_queue',        label: 'Nurture Queue',                icon: Heart,         color: 'text-pink-600 dark:text-pink-400' },
];

const COLLECTIONS = [
  { id: 'prospects',        label: 'Prospects',         icon: Users,     color: 'text-sky-600 dark:text-sky-400' },
  { id: 'active_tenants',   label: 'Active Tenants',    icon: Home,      color: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'past_tenants',     label: 'Past Tenants',      icon: Building2, color: 'text-slate-500 dark:text-slate-400' },
  { id: 'high_value_leads', label: 'High-Value Leads',  icon: Award,     color: 'text-brand-accent' },
];

// Quick filter tabs above the table
const QUICK_TABS = [
  { id: '',                        label: 'All People' },
  { id: 'col:prospects',           label: 'Prospects' },
  { id: 'col:active_tenants',      label: 'Active Tenants' },
  { id: 'sl:at_risk_renewals',     label: 'Upcoming Renewals' },
  { id: 'sl:today_tours_followups',label: "Today's Tours" },
];

// Source → badge style (leasing-centric listing sites)
const SOURCE_META = {
  zillow:        { label: 'Zillow',         cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700/60' },
  zillow_rentals:{ label: 'Zillow Rentals', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700/60' },
  apartments:    { label: 'Apartments.com', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-700/60' },
  realtor:       { label: 'Realtor.com',    cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-700/60' },
  trulia:        { label: 'Trulia',         cls: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-700/60' },
  rentcafe:      { label: 'RentCafe',       cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-700/60' },
  website:       { label: 'Website',        cls: 'bg-brand-soft text-brand dark:bg-brand/20 dark:text-brand-ring border-brand/20 dark:border-brand/40' },
  referral:      { label: 'Referral',       cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700/60' },
  cold_call:     { label: 'Cold Call',      cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300 border-slate-200 dark:border-slate-600' },
  manual:        { label: 'Manual',         cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300 border-slate-200 dark:border-slate-600' },
  csv_import:    { label: 'CSV Import',     cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300 border-slate-200 dark:border-slate-600' },
  facebook:      { label: 'Facebook',       cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700/60' },
  google:        { label: 'Google Ads',     cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700/60' },
};

const AVAILABLE_COLUMNS = [
  { id: 'source',        label: 'Source',             default: true },
  { id: 'move_in',       label: 'Desired Move-In',    default: true },
  { id: 'budget',        label: 'Budget Range',       default: true },
  { id: 'unit_interest', label: 'Unit Interest',      default: true },
  { id: 'renewal',       label: 'Renewal Status',     default: true },
  { id: 'last_activity', label: 'Last Activity',      default: true },
  { id: 'type',          label: 'Type',               default: false },
  { id: 'score',         label: 'Score',              default: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmtMoney = (n) => (n != null && !Number.isNaN(Number(n)) ? `$${Number(n).toLocaleString()}` : '');
const fmtDate = (s) => {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return s; }
};
const humanizeRel = (iso) => {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    const d = Math.floor(s / 86400);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch { return ''; }
};
const getSourceMeta = (src) => {
  if (!src) return { label: '—', cls: 'bg-slate-50 text-slate-400 dark:bg-slate-700/40 dark:text-slate-500 border-slate-100 dark:border-slate-700/60' };
  const key = String(src).toLowerCase().replace(/[\s-]/g, '_');
  return SOURCE_META[key] || { label: src, cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300 border-slate-200 dark:border-slate-600' };
};

// Avatar initials + color rotate
const AVATAR_PALETTE = ['avatar-ring', 'avatar-ring-amber', 'avatar-ring-emerald'];
const avatarClassFor = (id) => {
  if (!id) return AVATAR_PALETTE[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 3;
  return AVATAR_PALETTE[h];
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function ContactsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterType, setFilterType] = useState('');
  const [smartList, setSmartList] = useState('');           // id of selected smart list
  const [collection, setCollection] = useState('');         // id of selected collection
  const [quickTab, setQuickTab] = useState('');             // quick filter tab value
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [visibleCols, setVisibleCols] = useState(() => new Set(AVAILABLE_COLUMNS.filter((c) => c.default).map((c) => c.id)));
  const [showAdd, setShowAdd] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);
  const [sidebarExpanded, setSidebarExpanded] = useState({ smart: true, collections: true });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading: loading, error, refetch, isFetching } = useContacts(search, filterType, smartList, collection);
  const { data: counts = {}, refetch: refetchCounts } = useContactSmartCounts();
  const deleteMutation = useDeleteContact();
  const importMutation = useImportContacts();

  const invalidateContacts = () => {
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    queryClient.invalidateQueries({ queryKey: ['contacts-smart-counts'] });
  };

  // Handle Ctrl+N shortcut: open add dialog when ?new=1
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowAdd(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('new');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Apply quick-tab changes (mutual-exclusive with sidebar smart list/collection)
  const applyQuickTab = (tabId) => {
    setQuickTab(tabId);
    setSelectedIds(new Set());
    if (!tabId) {
      setSmartList(''); setCollection(''); return;
    }
    if (tabId.startsWith('sl:')) { setSmartList(tabId.slice(3)); setCollection(''); }
    else if (tabId.startsWith('col:')) { setCollection(tabId.slice(4)); setSmartList(''); }
  };

  const pickSmartList = (id) => {
    setSmartList(id); setCollection(''); setQuickTab(`sl:${id}`); setSelectedIds(new Set());
  };
  const pickCollection = (id) => {
    setCollection(id); setSmartList(''); setQuickTab(`col:${id}`); setSelectedIds(new Set());
  };
  const pickAll = () => {
    setSmartList(''); setCollection(''); setQuickTab(''); setSelectedIds(new Set());
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this contact?')) return;
    deleteMutation.mutate(id, { onSuccess: invalidateContacts });
  };

  const handleAIScore = async (id) => {
    try {
      const { data } = await api.post('/ai/lead-score', { contact_id: id });
      alert(`Lead Score: ${data.score}/100\n\n${data.reasoning}\n\nNext: ${data.next_action}`);
      invalidateContacts();
    } catch (err) {
      alert('AI scoring failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/contacts/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'contacts_export.csv'; a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { alert('Export failed: ' + (err.response?.data?.detail || err.message)); }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/contacts/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'contact_import_template.csv'; a.click();
      window.URL.revokeObjectURL(url);
    } catch { alert('Download failed'); }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    importMutation.mutate(formData, {
      onSuccess: ({ data }) => { setImportResult(data); invalidateContacts(); },
      onError: (err) => { setImportResult({ error: err.response?.data?.detail || err.message }); },
    });
    // Reset so picking the same file twice still fires onChange
    e.target.value = '';
  };

  const handleUpdateList = () => { refetch(); refetchCounts(); };

  // Bulk selection
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(contacts.map((c) => c.id)));
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} contacts? This cannot be undone.`)) return;
    await Promise.all(Array.from(selectedIds).map((id) => api.delete(`/contacts/${id}`).catch(() => null)));
    setSelectedIds(new Set()); invalidateContacts();
  };
  const handleBulkAddTag = async () => {
    const tag = window.prompt('Add tag to selected contacts:');
    if (!tag) return;
    await Promise.all(Array.from(selectedIds).map((id) => {
      const c = contacts.find((x) => x.id === id);
      if (!c) return null;
      const newTags = Array.from(new Set([...(c.tags || []), tag.trim()]));
      return api.put(`/contacts/${id}`, { tags: newTags }).catch(() => null);
    }));
    setSelectedIds(new Set()); invalidateContacts();
  };
  const handleBulkEmail = () => alert(`Bulk email to ${selectedIds.size} contacts — opens in a future release.`);
  const handleBulkAssign = () => alert(`Assign ${selectedIds.size} contacts — opens in a future release.`);
  const handleBulkAddToSequence = () => alert(`Enroll ${selectedIds.size} contacts in a sequence — go to Sequences → Enroll.`);
  const handleBulkScheduleTour = () => alert(`Schedule bulk tour for ${selectedIds.size} contacts — opens in a future release.`);

  // ── Header title & count based on active filter ──
  const activeView = useMemo(() => {
    if (smartList) return SMART_LISTS.find((l) => l.id === smartList);
    if (collection) return COLLECTIONS.find((c) => c.id === collection);
    return null;
  }, [smartList, collection]);
  const headerTitle = activeView?.label || 'All People';
  const headerCount = useMemo(() => {
    if (smartList) return counts[smartList];
    if (collection) return counts[collection];
    return counts.all_people;
  }, [smartList, collection, counts]);

  if (error) {
    return <div className="p-4 sm:p-6 lg:p-8"><div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">Failed to load contacts. Please try again.</div></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1700px] mx-auto" data-testid="contacts-page">
      {/* ── Top header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="section-heading text-2xl sm:text-3xl">People</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {counts.all_people ?? 0} total contact{counts.all_people === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 h-9" data-testid="export-contacts-csv">
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5 h-9" data-testid="download-contact-template-btn">
            <FileSpreadsheet className="w-4 h-4" /> Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
            className="gap-1.5 h-9"
            data-testid="import-contacts-csv"
          >
            <Upload className="w-4 h-4" /> {importMutation.isPending ? 'Importing…' : 'Import'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleImportCSV}
            className="hidden"
            disabled={importMutation.isPending}
            data-testid="import-contacts-file-input"
          />
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button variant="brand" size="sm" className="gap-2 h-9" data-testid="add-contact-button">
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

      {/* ── Quick filter tabs ── */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 mb-5 overflow-x-auto" data-testid="quick-filter-tabs">
        {QUICK_TABS.map((t) => {
          const active = quickTab === t.id;
          const cnt =
            t.id === '' ? counts.all_people
            : t.id.startsWith('sl:') ? counts[t.id.slice(3)]
            : t.id.startsWith('col:') ? counts[t.id.slice(4)]
            : null;
          return (
            <button
              key={t.id || 'all'}
              onClick={() => applyQuickTab(t.id)}
              className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'text-brand dark:text-brand-ring'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              data-testid={`quick-tab-${t.id || 'all'}`}
            >
              {t.label}
              {cnt !== undefined && cnt !== null && (
                <span className={`ml-2 inline-flex items-center justify-center min-w-[20px] px-1.5 h-5 rounded-full text-[10px] font-semibold ${
                  active ? 'bg-brand/10 text-brand dark:bg-brand/30 dark:text-brand-ring' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>{cnt}</span>
              )}
              {active && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand rounded-t-full" />}
            </button>
          );
        })}
      </div>

      {/* ── Main layout: sidebar + panel ── */}
      <div className="flex gap-5">
        {/* Left sidebar */}
        <aside className="hidden lg:block w-60 flex-shrink-0" data-testid="contacts-left-sidebar">
          <div className="sticky top-4 space-y-4">
            {/* All People */}
            <button
              onClick={pickAll}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                !smartList && !collection
                  ? 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-ring ring-1 ring-brand/20 dark:ring-brand/30'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
              data-testid="sidebar-all-people"
            >
              <span className="flex items-center gap-2"><Users className="w-4 h-4" /> All People</span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">{counts.all_people ?? 0}</span>
            </button>

            {/* Smart Lists */}
            <div>
              <button
                onClick={() => setSidebarExpanded((p) => ({ ...p, smart: !p.smart }))}
                className="w-full flex items-center justify-between px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Smart Lists
                <ChevronDown className={`w-3 h-3 transition-transform ${sidebarExpanded.smart ? '' : '-rotate-90'}`} />
              </button>
              {sidebarExpanded.smart && (
                <div className="space-y-0.5" data-testid="sidebar-smart-lists">
                  {SMART_LISTS.map(({ id, label, icon: Icon, color }) => {
                    const active = smartList === id;
                    return (
                      <button
                        key={id}
                        onClick={() => pickSmartList(id)}
                        className={`group w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-all ${
                          active
                            ? 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-ring font-semibold'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                        }`}
                        data-testid={`sidebar-smart-${id}`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Icon className={`w-4 h-4 flex-shrink-0 ${active ? '' : color}`} strokeWidth={active ? 2.5 : 2} />
                          <span className="truncate">{label}</span>
                        </span>
                        <span className={`text-[11px] font-semibold tabular-nums ml-1 px-1.5 py-0.5 rounded ${
                          active ? 'bg-brand/20 text-brand dark:bg-brand/30 dark:text-brand-ring' : 'text-slate-400 dark:text-slate-500'
                        }`}>{counts[id] ?? 0}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Collections */}
            <div>
              <button
                onClick={() => setSidebarExpanded((p) => ({ ...p, collections: !p.collections }))}
                className="w-full flex items-center justify-between px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Collections
                <ChevronDown className={`w-3 h-3 transition-transform ${sidebarExpanded.collections ? '' : '-rotate-90'}`} />
              </button>
              {sidebarExpanded.collections && (
                <div className="space-y-0.5" data-testid="sidebar-collections">
                  {COLLECTIONS.map(({ id, label, icon: Icon, color }) => {
                    const active = collection === id;
                    return (
                      <button
                        key={id}
                        onClick={() => pickCollection(id)}
                        className={`group w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-all ${
                          active
                            ? 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-ring font-semibold'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                        }`}
                        data-testid={`sidebar-collection-${id}`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Icon className={`w-4 h-4 flex-shrink-0 ${active ? '' : color}`} strokeWidth={active ? 2.5 : 2} />
                          <span className="truncate">{label}</span>
                        </span>
                        <span className={`text-[11px] font-semibold tabular-nums ml-1 px-1.5 py-0.5 rounded ${
                          active ? 'bg-brand/20 text-brand dark:bg-brand/30 dark:text-brand-ring' : 'text-slate-400 dark:text-slate-500'
                        }`}>{counts[id] ?? 0}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main panel */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* List header with title + Update List + Columns + Filters */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              {activeView?.icon && (
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-brand/10 dark:bg-brand/20 ${activeView.color}`}>
                  <activeView.icon className="w-4.5 h-4.5" strokeWidth={2.2} />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">{headerTitle}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {headerCount ?? contacts.length} contact{headerCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Columns dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-9" data-testid="columns-dropdown-btn">
                    <Columns3 className="w-4 h-4" /> Columns
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs">Show columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {AVAILABLE_COLUMNS.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={visibleCols.has(col.id)}
                      onCheckedChange={(v) => {
                        setVisibleCols((prev) => {
                          const n = new Set(prev);
                          if (v) n.add(col.id); else n.delete(col.id);
                          return n;
                        });
                      }}
                      data-testid={`column-toggle-${col.id}`}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Filters */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-9" data-testid="filters-dropdown-btn">
                    <SlidersHorizontal className="w-4 h-4" /> Filters
                    {filterType && <span className="w-1.5 h-1.5 rounded-full bg-brand" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs">Property Type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={!filterType} onCheckedChange={() => setFilterType('')}>
                    All Types
                  </DropdownMenuCheckboxItem>
                  {PROPERTY_TYPES.map((t) => (
                    <DropdownMenuCheckboxItem
                      key={t.value}
                      checked={filterType === t.value}
                      onCheckedChange={(v) => setFilterType(v ? t.value : '')}
                    >
                      {t.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Update List refresh */}
              <Button variant="brand" size="sm" className="gap-1.5 h-9" onClick={handleUpdateList} disabled={isFetching} data-testid="update-list-btn">
                <RefreshCcw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Update List
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-3 flex-wrap" data-testid="contacts-filters">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Search people by name, email, phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-10 text-sm dark:text-slate-200 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
                data-testid="contacts-search-input"
              />
            </div>
          </div>

          {/* ── Bulk action toolbar ── */}
          {selectedIds.size > 0 && (
            <div className="card-premium-static p-3 flex items-center justify-between gap-3 flex-wrap animate-fade-in-up border-brand/30 bg-brand/5 dark:bg-brand/10" data-testid="bulk-toolbar">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-brand dark:text-brand-ring">
                  {selectedIds.size} selected
                </span>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1">
                  <XIcon className="w-3 h-3" /> Clear
                </button>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <Button size="sm" variant="ghost" onClick={handleBulkEmail} className="gap-1.5 h-8" data-testid="bulk-email-btn">
                  <Send className="w-3.5 h-3.5" /> Email
                </Button>
                <Button size="sm" variant="ghost" onClick={handleBulkAssign} className="gap-1.5 h-8" data-testid="bulk-assign-btn">
                  <UserCog className="w-3.5 h-3.5" /> Assign
                </Button>
                <Button size="sm" variant="ghost" onClick={handleBulkAddTag} className="gap-1.5 h-8" data-testid="bulk-tag-btn">
                  <Tag className="w-3.5 h-3.5" /> Add Tag
                </Button>
                <Button size="sm" variant="ghost" onClick={handleBulkAddToSequence} className="gap-1.5 h-8" data-testid="bulk-sequence-btn">
                  <ListChecks className="w-3.5 h-3.5" /> Add to Sequence
                </Button>
                <Button size="sm" variant="ghost" onClick={handleBulkScheduleTour} className="gap-1.5 h-8" data-testid="bulk-tour-btn">
                  <CalendarPlus className="w-3.5 h-3.5" /> Schedule Tour
                </Button>
                <Button size="sm" variant="ghost" onClick={handleExportCSV} className="gap-1.5 h-8" data-testid="bulk-export-btn">
                  <Download className="w-3.5 h-3.5" /> Export
                </Button>
                <Button size="sm" variant="ghost" onClick={handleBulkDelete} className="gap-1.5 h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20" data-testid="bulk-delete-btn">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </div>
            </div>
          )}

          {/* ── Table ── */}
          {loading ? (
            <div className="space-y-2" data-testid="contacts-loading">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 skeleton-shimmer rounded-[14px]" />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="card-premium-static p-12 text-center" data-testid="contacts-empty-state">
              <div className="w-14 h-14 mx-auto rounded-full bg-brand/10 flex items-center justify-center mb-3">
                <Users className="w-6 h-6 text-brand" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No contacts in this view</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 mb-4">
                {smartList || collection ? 'Try a different smart list or add new contacts.' : 'Add your first contact or import a CSV to get started.'}
              </p>
              <Button onClick={() => setShowAdd(true)} variant="brand" className="gap-2">
                <Plus className="w-4 h-4" /> Add Contact
              </Button>
            </div>
          ) : (
            <div className="card-premium-static overflow-hidden" data-testid="contacts-table">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3 pl-4 pr-2 w-10">
                        <Checkbox
                          checked={contacts.length > 0 && selectedIds.size === contacts.length}
                          onCheckedChange={toggleSelectAll}
                          data-testid="select-all-checkbox"
                        />
                      </th>
                      <th className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-3">Name</th>
                      {visibleCols.has('source')        && <th className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-3">Source</th>}
                      {visibleCols.has('move_in')       && <th className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-3">Move-In</th>}
                      {visibleCols.has('budget')        && <th className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-3">Budget</th>}
                      {visibleCols.has('unit_interest') && <th className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-3">Unit Interest</th>}
                      {visibleCols.has('renewal')       && <th className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-3">Renewal</th>}
                      {visibleCols.has('last_activity') && <th className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-3">Last Activity</th>}
                      {visibleCols.has('type')          && <th className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-3">Type</th>}
                      {visibleCols.has('score')         && <th className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-3">Score</th>}
                      <th className="py-3 px-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60" data-testid="contacts-table-body">
                    {contacts.map((c) => {
                      const selected = selectedIds.has(c.id);
                      const src = getSourceMeta(c.source);
                      const initial = (c.name || 'U').charAt(0).toUpperCase();
                      const budget = (c.budget_min || c.budget_max)
                        ? `${fmtMoney(c.budget_min)}${c.budget_min && c.budget_max ? ' – ' : ''}${fmtMoney(c.budget_max)}`
                        : '';
                      const unitInterest = c.unit_preference || c.property_interest || c.unit_number || '';
                      const renewalDate = c.renewal_date || c.lease_end_date || c.lease_end || '';
                      const renewalOffer = c.renewal_offer_status || '';
                      const lastActivity = c.last_activity_at || c.updated_at || '';
                      return (
                        <tr
                          key={c.id}
                          className={`table-row-hover cursor-pointer transition-all ${selected ? 'bg-brand/5 dark:bg-brand/10' : ''}`}
                          onClick={() => navigate(`/contacts/${c.id}`)}
                          data-testid={`contact-row-${c.id}`}
                        >
                          <td className="py-3 pl-4 pr-2 align-middle" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected}
                              onCheckedChange={() => toggleSelect(c.id)}
                              data-testid={`select-contact-${c.id}`}
                            />
                          </td>
                          <td className="py-3 px-3 align-middle">
                            <div className="flex items-center gap-3">
                              <div className={`${avatarClassFor(c.id)} w-9 h-9 text-[13px] flex-shrink-0`}>
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{c.name}</p>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {c.email && <span className="inline-flex items-center gap-1 truncate max-w-[180px]"><Mail className="w-3 h-3" />{c.email}</span>}
                                  {c.phone && <span className="inline-flex items-center gap-1 truncate"><Phone className="w-3 h-3" />{c.phone}</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          {visibleCols.has('source') && (
                            <td className="py-3 px-3 align-middle">
                              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold border ${src.cls}`}>
                                {src.label}
                              </span>
                            </td>
                          )}
                          {visibleCols.has('move_in') && (
                            <td className="py-3 px-3 align-middle text-xs text-slate-700 dark:text-slate-300">
                              {c.move_in_date ? (
                                <span className="inline-flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />{fmtDate(c.move_in_date)}</span>
                              ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                            </td>
                          )}
                          {visibleCols.has('budget') && (
                            <td className="py-3 px-3 align-middle text-xs text-slate-700 dark:text-slate-300">
                              {budget ? (
                                <span className="inline-flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />{budget}</span>
                              ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                            </td>
                          )}
                          {visibleCols.has('unit_interest') && (
                            <td className="py-3 px-3 align-middle text-xs text-slate-700 dark:text-slate-300">
                              {unitInterest ? (
                                <span className="inline-flex items-center gap-1.5 truncate max-w-[160px]"><MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />{unitInterest}</span>
                              ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                            </td>
                          )}
                          {visibleCols.has('renewal') && (
                            <td className="py-3 px-3 align-middle">
                              {renewalDate || renewalOffer ? (
                                <div className="flex flex-col gap-0.5">
                                  {renewalDate && <span className="text-xs text-slate-700 dark:text-slate-300">{fmtDate(renewalDate)}</span>}
                                  {renewalOffer && (
                                    <Badge variant="outline" className={`text-[10px] font-semibold w-fit ${
                                      /accepted|signed/i.test(renewalOffer) ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400' :
                                      /declined/i.test(renewalOffer) ? 'border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-400' :
                                      /pending|sent/i.test(renewalOffer) ? 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400' :
                                      'border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300'
                                    }`}>{renewalOffer}</Badge>
                                  )}
                                </div>
                              ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                            </td>
                          )}
                          {visibleCols.has('last_activity') && (
                            <td className="py-3 px-3 align-middle">
                              {lastActivity ? (
                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                                  {humanizeRel(lastActivity)}
                                </span>
                              ) : <span className="text-xs text-slate-300 dark:text-slate-600">No activity</span>}
                            </td>
                          )}
                          {visibleCols.has('type') && (
                            <td className="py-3 px-3 align-middle">
                              <Badge variant="outline" className="text-[10px]">
                                {PROPERTY_TYPES.find((t) => t.value === c.property_type)?.label || c.property_type || '—'}
                              </Badge>
                            </td>
                          )}
                          {visibleCols.has('score') && (
                            <td className="py-3 px-3 align-middle">
                              <div className={`inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded-md text-xs font-bold ${
                                (c.lead_score ?? 0) >= 70 ? 'bg-brand-success-soft text-brand-success dark:bg-emerald-900/30 dark:text-emerald-300' :
                                (c.lead_score ?? 0) >= 40 ? 'bg-brand-accent-soft text-brand-accent dark:bg-amber-900/30 dark:text-amber-300' :
                                'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                              }`}>
                                {c.lead_score ?? 0}
                              </div>
                            </td>
                          )}
                          <td className="py-3 px-3 align-middle" onClick={(e) => e.stopPropagation()}>
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
                                  <Sparkles className="w-4 h-4 mr-2 text-brand-accent" /> AI Score
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(c.id)} className="text-rose-600 dark:text-rose-400" data-testid={`delete-contact-${c.id}`}>
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editContact} onOpenChange={(o) => { if (!o) setEditContact(null); }}>
        <DialogContent className="sm:max-w-md" data-testid="edit-contact-dialog">
          <DialogHeader><DialogTitle>Edit Contact</DialogTitle></DialogHeader>
          {editContact && <ContactForm initial={editContact} onSubmit={async (d) => { await api.put(`/contacts/${editContact.id}`, d); setEditContact(null); invalidateContacts(); }} />}
        </DialogContent>
      </Dialog>

      {/* Import Result Dialog */}
      <Dialog open={!!importResult} onOpenChange={(o) => { if (!o) setImportResult(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto" data-testid="import-result-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importResult?.error ? (
                <><XCircle className="w-5 h-5 text-red-500" /> Import Failed</>
              ) : (
                <><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Import Complete</>
              )}
            </DialogTitle>
          </DialogHeader>
          {importResult?.error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-700 dark:text-red-400">{importResult.error}</p>
            </div>
          ) : importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{importResult.imported}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500">Imported</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{importResult.skipped || 0}</p>
                  <p className="text-xs text-red-600 dark:text-red-500">Skipped</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{importResult.total_rows}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Rows</p>
                </div>
              </div>
              {importResult.errors && importResult.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Issues ({importResult.errors.length})
                  </h4>
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg divide-y divide-amber-200 dark:divide-amber-800 max-h-48 overflow-y-auto">
                    {importResult.errors.map((err, idx) => (
                      <div key={idx} className="px-3 py-2 text-sm">
                        {typeof err === 'string' ? (
                          <p className="text-amber-800 dark:text-amber-400">{err}</p>
                        ) : (
                          <div className="flex items-start gap-2">
                            <span className="font-mono text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded flex-shrink-0">Row {err.row}</span>
                            <div>
                              {err.field && err.field !== 'unknown' && (
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-400 mr-1">[{err.field}]</span>
                              )}
                              <span className="text-amber-800 dark:text-amber-400">{err.reason}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {importResult.errors?.length === 0 && (
                <p className="text-sm text-emerald-700 dark:text-emerald-400 text-center py-2">All rows imported successfully!</p>
              )}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button onClick={() => setImportResult(null)} variant="outline" size="sm" data-testid="close-import-result">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ContactForm (unchanged — kept verbatim for backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────
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
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Name *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600" data-testid="contact-form-name" />
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Email</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600" data-testid="contact-form-email" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600" data-testid="contact-form-phone" />
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Company</Label>
          <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600" data-testid="contact-form-company" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Type</Label>
          <Select value={form.property_type} onValueChange={(v) => setForm({ ...form, property_type: v })}>
            <SelectTrigger className="bg-white dark:bg-slate-700 dark:border-slate-600" data-testid="contact-form-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Source</Label>
          <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
            <SelectTrigger className="bg-white dark:bg-slate-700 dark:border-slate-600" data-testid="contact-form-source"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['manual', 'website', 'referral', 'zillow', 'realtor', 'apartments', 'cold_call', 'facebook', 'google'].map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Tags</Label>
        <div className="flex gap-2 flex-wrap mb-2">
          {form.tags.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1 cursor-pointer" onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== t) })}>
              {t} <span className="text-xs">&times;</span>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Add tag" className="bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 flex-1" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} data-testid="contact-form-tag-input" />
          <Button type="button" variant="outline" size="sm" onClick={addTag}><Tag className="w-3 h-3 mr-1" /> Add</Button>
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Notes</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600" data-testid="contact-form-notes" />
      </div>
      <Button type="submit" disabled={submitting} variant="brand" className="w-full" data-testid="contact-form-submit">
        {submitting ? 'Saving…' : initial ? 'Update Contact' : 'Add Contact'}
      </Button>
    </form>
  );
}
