import React, { useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  useContact, useActivities, useDeals, useTasks, useTemplates, useTeamMembers,
  useClientTypes, useUploadContactPhoto, useDeleteContactPhoto, useUpdateContactStage,
  useAddContactTag, useRemoveContactTag, useContactFiles, useUploadContactFile,
  useDeleteContactFile, downloadContactFile, useContactLease, useSaveLease,
  useMaintenanceTickets, useCreateTicket, useUpdateTicket, useDeleteTicket,
  useContactEvents, useCreateEvent, useUpdateEvent, useDeleteEvent,
  useCollaborators, useAddCollaborator, useRemoveCollaborator,
  useAIRetentionSummary, useAIAnalyzeEmailThread,
  useConvertToTenant, useSendRenewalOffer,
  useCreateTask, useUpdateTask, useCreateActivity,
} from '../hooks/useApi';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import {
  ArrowLeft, Phone, Mail, MessageCircle, Send, Plus, Tag as TagIcon, X,
  FileText, Paperclip, Home, Wrench, CalendarDays, Users, Sparkles, Camera,
  CheckCircle2, PhoneCall, StickyNote, UserPlus, Trash2, Download,
  RefreshCw, MoreHorizontal, ListChecks, Shield,
  ChevronRight, Repeat, ClipboardList,
} from 'lucide-react';

// ── Client type display ──
const CLIENT_TYPE_LABELS = {
  leasing_tenant: 'Leasing / Tenant',
  sales_buyer: 'Sales / Buyer',
  sales_seller: 'Sales / Seller',
  commercial: 'Commercial',
  other: 'Other / Prospect',
};

const DEFAULT_STAGE_LISTS = {
  leasing_tenant: ['Inquiry','Tour Scheduled','Application Submitted','Screening','Approved','Lease Signed','Move-In','Active Tenant','Renewal Due','Renewal Offered','Renewed','Vacating','Past Tenant'],
  sales_buyer: ['Inquiry','Consultation','Pre-Approved','Showing','Offer Submitted','Under Contract','Inspection','Closing','Closed Won','Closed Lost'],
  sales_seller: ['Inquiry','Consultation','Listing Prep','Active Listing','Offer Received','Under Contract','Closing','Sold','Withdrawn'],
  commercial: ['Inquiry','Tour','LOI','Due Diligence','Negotiation','Contract','Closing','Closed'],
  other: ['Prospect','Contacted','Qualified','Nurturing','Converted','Lost'],
};

const ACTIVITY_ICONS = { call: PhoneCall, email: Mail, note: StickyNote, meeting: CalendarDays, sms: MessageCircle };
const ACTIVITY_TYPE_LABELS = { call: 'Call', email: 'Email', note: 'Note', meeting: 'Meeting', sms: 'SMS' };
const ACTIVITY_COLORS = {
  call: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  email: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  note: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  meeting: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  sms: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

const fmtDate = (iso) => iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const fmtDateOnly = (iso) => iso ? new Date(iso).toLocaleDateString([], { dateStyle: 'medium' }) : '—';
const fmtMoney = (n) => n != null ? `$${Number(n).toLocaleString()}` : '—';

// ─── Retention health pill ───
function RetentionBadge({ score }) {
  const tier = score >= 75 ? 'healthy' : score >= 45 ? 'watch' : 'at-risk';
  const styles = {
    healthy: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
    watch: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700',
    'at-risk': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-700',
  }[tier];
  const label = tier === 'healthy' ? 'Healthy' : tier === 'watch' ? 'Watch' : 'At-Risk';
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${styles}`} data-testid="retention-badge">
      <Shield className="w-3.5 h-3.5" />
      Retention: {label} · {score ?? 0}/100
    </div>
  );
}

// ─── Simple section card ───
function Card({ className = '', children, ...rest }) {
  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Data ──
  const { data: contact, isLoading, error } = useContact(id);
  const { data: allActivities = [] } = useActivities(id);
  const { data: allDeals = [] } = useDeals();
  const { data: allTasks = [] } = useTasks();
  const { data: emailTpls = [] } = useTemplates('email');
  const { data: smsTpls = [] } = useTemplates('sms');
  const { data: files = [] } = useContactFiles(id);
  const { data: leaseData } = useContactLease(id);
  const { data: tickets = [] } = useMaintenanceTickets(id);
  const { data: events = [] } = useContactEvents(id);
  const { data: collaborators = [] } = useCollaborators(id);
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: clientTypesData } = useClientTypes();

  const stageLists = clientTypesData?.stages || DEFAULT_STAGE_LISTS;

  // ── Derived ──
  const clientType = contact?.client_type || 'leasing_tenant';
  const isLeasing = clientType === 'leasing_tenant';
  const stages = stageLists[clientType] || DEFAULT_STAGE_LISTS[clientType] || [];
  const deals = useMemo(() => allDeals.filter(d => d.contact_id === id), [allDeals, id]);
  const linkedTasks = useMemo(() => allTasks.filter(t => t.contact_id === id), [allTasks, id]);

  // ── Mutations ──
  const uploadPhoto = useUploadContactPhoto(id);
  const deletePhoto = useDeleteContactPhoto(id);
  const updateStage = useUpdateContactStage(id);
  const addTag = useAddContactTag(id);
  const removeTag = useRemoveContactTag(id);
  const uploadFile = useUploadContactFile(id);
  const deleteFile = useDeleteContactFile(id);
  const saveLease = useSaveLease(id);
  const createTicket = useCreateTicket(id);
  const updateTicket = useUpdateTicket(id);
  const deleteTicket = useDeleteTicket(id);
  const createEvent = useCreateEvent(id);
  const deleteEvent = useDeleteEvent(id);
  const addColl = useAddCollaborator(id);
  const removeColl = useRemoveCollaborator(id);
  const aiRetention = useAIRetentionSummary(id);
  const aiAnalyzeEmail = useAIAnalyzeEmailThread(id);
  const convertTenant = useConvertToTenant(id);
  const sendRenewal = useSendRenewalOffer(id);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const createActivity = useCreateActivity();

  // ── Dialog state ──
  const [showActivity, setShowActivity] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showSms, setShowSms] = useState(false);
  const [showTag, setShowTag] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [showLease, setShowLease] = useState(false);
  const [showCollab, setShowCollab] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showRenewal, setShowRenewal] = useState(false);

  const [emailForm, setEmailForm] = useState({ subject: '', body: '' });
  const [smsForm, setSmsForm] = useState({ message: '' });
  const [newTag, setNewTag] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [analysisText, setAnalysisText] = useState('');
  const [renewalDraft, setRenewalDraft] = useState('');

  const photoInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Activity filter (with files + events appended) — must be above any early return ──
  const timelineItems = useMemo(() => {
    const items = allActivities.map(a => ({ ...a, _kind: 'activity' }));
    if (activityFilter === 'all') return items;
    return items.filter(i => i.activity_type === activityFilter);
  }, [allActivities, activityFilter]);

  if (error) {
    navigate('/contacts');
    return null;
  }

  if (isLoading || !contact) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48" />
        <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 h-96 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Handlers ──
  const handlePhotoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { alert('Photo must be under 1 MB.'); return; }
    const reader = new FileReader();
    reader.onloadend = () => uploadPhoto.mutate(reader.result);
    reader.readAsDataURL(file);
  };

  const handleAttachFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('File must be under 10 MB.'); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = String(reader.result).split(',')[1] || '';
      uploadFile.mutate({
        name: file.name,
        mime_type: file.type || 'application/octet-stream',
        category: 'general',
        data: base64,
        size: file.size,
      });
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadFile = async (f) => {
    try {
      const full = await downloadContactFile(id, f.id);
      const a = document.createElement('a');
      a.href = `data:${full.mime_type};base64,${full.data}`;
      a.download = full.name;
      a.click();
    } catch (err) {
      alert('Download failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleClientTypeChange = async (newType) => {
    const firstStage = (stageLists[newType] || DEFAULT_STAGE_LISTS[newType] || [])[0] || '';
    // save both client_type (via PATCH) and stage together
    try {
      await api.put(`/contacts/${id}`, { client_type: newType });
      if (firstStage) {
        await updateStage.mutateAsync({ leasing_stage: firstStage, client_type: newType });
      } else {
        queryClient.invalidateQueries({ queryKey: ['contacts', id] });
      }
    } catch (err) {
      alert('Failed to change client type: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSendEmail = async () => {
    if (!emailForm.subject || !emailForm.body) { alert('Subject and body required'); return; }
    try {
      await api.post('/email/send', { contact_id: id, to_email: contact.email, subject: emailForm.subject, body: emailForm.body });
      setShowEmail(false); setEmailForm({ subject: '', body: '' });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    } catch (err) {
      alert('Send failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSendSms = async () => {
    if (!smsForm.message) { alert('Message required'); return; }
    try {
      await api.post('/sms/send', { contact_id: id, to_phone: contact.phone, message: smsForm.message });
      setShowSms(false); setSmsForm({ message: '' });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    } catch (err) {
      alert('Send failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleAnalyzeThread = async () => {
    try {
      const { data } = await aiAnalyzeEmail.mutateAsync();
      setAnalysisText(data.analysis || 'No analysis.');
      setShowAnalysis(true);
    } catch (err) {
      alert('Analysis failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleRetention = async () => {
    try { await aiRetention.mutateAsync(); }
    catch (err) { alert('Retention AI failed: ' + (err.response?.data?.detail || err.message)); }
  };

  const handleConvert = async () => {
    if (!window.confirm('Convert this prospect to an Active Tenant?')) return;
    try { await convertTenant.mutateAsync(); }
    catch (err) { alert('Conversion failed: ' + (err.response?.data?.detail || err.message)); }
  };

  const handleRenewal = async () => {
    try {
      const { data } = await sendRenewal.mutateAsync();
      setRenewalDraft(data.draft || '');
      setShowRenewal(true);
    } catch (err) {
      alert('Renewal draft failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5 pb-28" data-testid="contact-detail-page">
      {/* Back link */}
      <button
        onClick={() => navigate('/contacts')}
        className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
        data-testid="back-to-contacts"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Contacts
      </button>

      {/* ══ Header Card ══ */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-5">
          {/* Avatar + upload */}
          <div className="relative group">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 overflow-hidden flex items-center justify-center ring-2 ring-white dark:ring-slate-800 shadow">
              {contact.photo_url ? (
                <img src={contact.photo_url} alt={contact.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-slate-600 dark:text-slate-300">
                  {contact.name?.charAt(0)?.toUpperCase()}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              title="Upload photo"
              data-testid="upload-photo-button"
            >
              <Camera className="w-5 h-5" />
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={handlePhotoFile} />
            {contact.photo_url && (
              <button
                type="button"
                onClick={() => deletePhoto.mutate()}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow hover:bg-red-600"
                title="Remove photo"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Identity + client type + stage */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-[200px]">
                <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  {contact.name}
                </h1>
                {contact.company && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{contact.company}</p>
                )}
              </div>
              {isLeasing && (
                <RetentionBadge score={contact.retention_score ?? 0} />
              )}
            </div>

            {/* Client Type selector */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Client Type</span>
                <Select value={clientType} onValueChange={handleClientTypeChange}>
                  <SelectTrigger className="w-[200px] h-9" data-testid="client-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLIENT_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Stage</span>
                <Select
                  value={contact.leasing_stage || stages[0]}
                  onValueChange={(v) => updateStage.mutate({ leasing_stage: v, client_type: clientType })}
                >
                  <SelectTrigger className="w-[200px] h-9" data-testid="stage-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                {contact.stage_updated_at && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">since {fmtDateOnly(contact.stage_updated_at)}</span>
                )}
              </div>
            </div>

            {/* Contact info row */}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white">
                  <Phone className="w-3.5 h-3.5" /> {contact.phone}
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white truncate">
                  <Mail className="w-3.5 h-3.5" /> {contact.email}
                </a>
              )}
              {contact.address && (
                <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Home className="w-3.5 h-3.5" /> {contact.address}
                </span>
              )}
            </div>

            {/* Tags */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(contact.tags || []).map(t => (
                <Badge key={t} variant="secondary" className="gap-1 pr-1">
                  <TagIcon className="w-3 h-3" /> {t}
                  <button
                    onClick={() => removeTag.mutate(t)}
                    className="ml-1 w-4 h-4 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 text-slate-400 hover:text-red-600 flex items-center justify-center"
                    aria-label={`remove tag ${t}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setShowTag(true)} data-testid="add-tag-button">
                <Plus className="w-3 h-3" /> Tag
              </Button>
            </div>
          </div>

          {/* Quick call/email/text */}
          <div className="flex flex-wrap gap-2 lg:flex-col lg:w-[180px]">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex-1 lg:w-full">
                <Button variant="outline" size="sm" className="w-full gap-1.5" data-testid="quick-call-button">
                  <Phone className="w-3.5 h-3.5" /> Call
                </Button>
              </a>
            )}
            {contact.email && (
              <Button variant="outline" size="sm" className="flex-1 lg:w-full gap-1.5" onClick={() => setShowEmail(true)} data-testid="quick-email-button">
                <Mail className="w-3.5 h-3.5" /> Email
              </Button>
            )}
            {contact.phone && (
              <Button variant="outline" size="sm" className="flex-1 lg:w-full gap-1.5" onClick={() => setShowSms(true)} data-testid="quick-text-button">
                <MessageCircle className="w-3.5 h-3.5" /> Text
              </Button>
            )}
            {isLeasing && (
              <>
                <Button
                  size="sm"
                  className="flex-1 lg:w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  onClick={handleConvert}
                  disabled={contact.is_tenant || convertTenant.isPending}
                  data-testid="convert-to-tenant-button"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {contact.is_tenant ? 'Is Tenant' : 'Convert to Tenant'}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 lg:w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                  onClick={handleRenewal}
                  disabled={sendRenewal.isPending}
                  data-testid="send-renewal-offer-button"
                >
                  <Repeat className="w-3.5 h-3.5" /> {sendRenewal.isPending ? 'Drafting…' : 'Send Renewal Offer'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* AI retention summary (leasing only) */}
        {isLeasing && (
          <div className="mt-5 border-t border-slate-200 dark:border-slate-700 pt-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">AI Retention Summary</span>
                  <Button
                    variant="ghost" size="sm"
                    onClick={handleRetention}
                    disabled={aiRetention.isPending}
                    className="h-7 gap-1 text-xs"
                    data-testid="refresh-retention-button"
                  >
                    <RefreshCw className={`w-3 h-3 ${aiRetention.isPending ? 'animate-spin' : ''}`} />
                    {contact.retention_summary ? 'Refresh' : 'Generate'}
                  </Button>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed" data-testid="retention-summary-text">
                  {aiRetention.isPending
                    ? 'Analyzing tenant signals…'
                    : (contact.retention_summary || 'No retention summary yet. Click "Generate" to get AI-powered retention analysis.')}
                </p>
                {contact.retention_summary_generated_at && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                    Generated {fmtDate(contact.retention_summary_generated_at)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ══ Top action bar ══ */}
      <div className="flex flex-wrap gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 shadow-sm">
        {contact.phone && <ActionBtn icon={Phone} label="Call" onClick={() => window.location.href = `tel:${contact.phone}`} testid="action-call" />}
        {contact.email && <ActionBtn icon={Mail} label="Email" onClick={() => setShowEmail(true)} testid="action-email" />}
        {contact.phone && <ActionBtn icon={MessageCircle} label="Text" onClick={() => setShowSms(true)} testid="action-text" />}
        <ActionBtn icon={ListChecks} label="Log Activity" onClick={() => setShowActivity(true)} testid="action-log-activity" />
        <ActionBtn icon={CheckCircle2} label="Add Task" onClick={() => setShowTask(true)} testid="action-add-task" />
        <ActionBtn icon={CalendarDays} label="Add Event" onClick={() => setShowEvent(true)} testid="action-add-event" />
        <ActionBtn icon={StickyNote} label="Add Note" onClick={() => setShowNote(true)} testid="action-add-note" />
      </div>

      {/* ══ Main grid ══ */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* ── Tabs ── */}
        <div className="min-w-0">
          <Tabs defaultValue="timeline" className="space-y-4">
            <TabsList className="w-full overflow-x-auto justify-start flex-nowrap" data-testid="profile-tabs">
              <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
              <TabsTrigger value="email" data-testid="tab-email">Email</TabsTrigger>
              <TabsTrigger value="sms" data-testid="tab-sms">SMS</TabsTrigger>
              <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
              <TabsTrigger value="calendar" data-testid="tab-calendar">Calendar</TabsTrigger>
              <TabsTrigger value="files" data-testid="tab-files">Files</TabsTrigger>
              {isLeasing && <TabsTrigger value="lease" data-testid="tab-lease">Lease Info</TabsTrigger>}
              {isLeasing && <TabsTrigger value="maintenance" data-testid="tab-maintenance">Maintenance</TabsTrigger>}
            </TabsList>

            {/* ── Timeline ── */}
            <TabsContent value="timeline">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Activity Timeline</h3>
                  <div className="flex items-center gap-2">
                    <Select value={activityFilter} onValueChange={setActivityFilter}>
                      <SelectTrigger className="w-[140px] h-8" data-testid="timeline-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="call">Calls</SelectItem>
                        <SelectItem value="email">Emails</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="meeting">Meetings</SelectItem>
                        <SelectItem value="note">Notes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {timelineItems.length === 0 ? (
                  <EmptyState icon={ListChecks} text="No activities yet" />
                ) : (
                  <div className="space-y-3">
                    {timelineItems.map((a, i) => {
                      const Icon = ACTIVITY_ICONS[a.activity_type] || StickyNote;
                      const color = ACTIVITY_COLORS[a.activity_type] || ACTIVITY_COLORS.note;
                      return (
                        <div key={a.id || i} className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0" data-testid={`timeline-item-${i}`}>
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-800 dark:text-slate-200 break-words">{a.description}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              {ACTIVITY_TYPE_LABELS[a.activity_type] || a.activity_type} · {fmtDate(a.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* ── Email thread ── */}
            <TabsContent value="email">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Email Thread</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleAnalyzeThread} disabled={aiAnalyzeEmail.isPending} className="gap-1.5" data-testid="ai-analyze-email-button">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      {aiAnalyzeEmail.isPending ? 'Analyzing…' : 'AI Analyze'}
                    </Button>
                    <Button size="sm" onClick={() => setShowEmail(true)} className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800" data-testid="compose-email-button">
                      <Send className="w-3.5 h-3.5" /> Compose
                    </Button>
                  </div>
                </div>
                <ThreadList items={allActivities.filter(a => a.activity_type === 'email')} iconBg={ACTIVITY_COLORS.email} Icon={Mail} emptyText="No emails yet" />
              </Card>
            </TabsContent>

            {/* ── SMS ── */}
            <TabsContent value="sms">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">SMS Thread</h3>
                  <Button size="sm" onClick={() => setShowSms(true)} className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800" data-testid="compose-sms-button">
                    <MessageCircle className="w-3.5 h-3.5" /> Compose
                  </Button>
                </div>
                <ThreadList items={allActivities.filter(a => a.activity_type === 'sms')} iconBg={ACTIVITY_COLORS.sms} Icon={MessageCircle} emptyText="No texts yet" />
              </Card>
            </TabsContent>

            {/* ── Tasks ── */}
            <TabsContent value="tasks">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Tasks</h3>
                  <Button size="sm" onClick={() => setShowTask(true)} className="gap-1.5" variant="outline" data-testid="add-task-from-tasks-tab">
                    <Plus className="w-3.5 h-3.5" /> Add Task
                  </Button>
                </div>
                {linkedTasks.length === 0 ? <EmptyState icon={CheckCircle2} text="No tasks linked" /> : (
                  <ul className="space-y-2">
                    {linkedTasks.map(t => (
                      <li key={t.id} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg" data-testid={`task-item-${t.id}`}>
                        <input
                          type="checkbox" checked={!!t.completed}
                          onChange={() => updateTask.mutate({ id: t.id, data: { completed: !t.completed } })}
                          className="w-4 h-4 rounded border-slate-300"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${t.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>{t.title}</p>
                          <p className="text-xs text-slate-400">Due {t.due_date || '—'} · {t.priority}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </TabsContent>

            {/* ── Calendar ── */}
            <TabsContent value="calendar">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Upcoming Events</h3>
                  <Button size="sm" onClick={() => setShowEvent(true)} variant="outline" className="gap-1.5" data-testid="add-event-from-tab">
                    <Plus className="w-3.5 h-3.5" /> Add Event
                  </Button>
                </div>
                {events.length === 0 ? <EmptyState icon={CalendarDays} text="No events scheduled" /> : (
                  <ul className="space-y-2">
                    {events.map(ev => (
                      <li key={ev.id} className="flex items-start gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg" data-testid={`event-item-${ev.id}`}>
                        <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                          <CalendarDays className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{ev.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{fmtDate(ev.start)} {ev.location && `· ${ev.location}`}</p>
                          {ev.description && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{ev.description}</p>}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => deleteEvent.mutate(ev.id)} className="h-7 w-7 p-0">
                          <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </TabsContent>

            {/* ── Files ── */}
            <TabsContent value="files">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Files</h3>
                  <Button size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5" data-testid="upload-file-button">
                    <Paperclip className="w-3.5 h-3.5" /> Upload File
                  </Button>
                  <input ref={fileInputRef} type="file" hidden onChange={handleAttachFile} />
                </div>
                {files.length === 0 ? <EmptyState icon={Paperclip} text="No files uploaded" /> : (
                  <ul className="space-y-2">
                    {files.map(f => (
                      <li key={f.id} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg" data-testid={`file-item-${f.id}`}>
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{f.name}</p>
                          <p className="text-xs text-slate-400">{f.category} · {Math.round((f.size || 0) / 1024)} KB · {fmtDateOnly(f.created_at)}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDownloadFile(f)} className="h-8 w-8 p-0" title="Download">
                          <Download className="w-4 h-4 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteFile.mutate(f.id)} className="h-8 w-8 p-0" title="Delete">
                          <Trash2 className="w-4 h-4 text-slate-400" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </TabsContent>

            {/* ── Lease (leasing only) ── */}
            {isLeasing && (
              <TabsContent value="lease">
                <LeasePanel
                  lease={leaseData?.current}
                  history={leaseData?.history || []}
                  onEdit={() => setShowLease(true)}
                />
              </TabsContent>
            )}

            {/* ── Maintenance (leasing only) ── */}
            {isLeasing && (
              <TabsContent value="maintenance">
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Maintenance & Tickets</h3>
                    <Button size="sm" onClick={() => setShowTicket(true)} className="gap-1.5" data-testid="add-ticket-button">
                      <Plus className="w-3.5 h-3.5" /> New Ticket
                    </Button>
                  </div>
                  {tickets.length === 0 ? <EmptyState icon={Wrench} text="No maintenance tickets" /> : (
                    <ul className="space-y-2">
                      {tickets.map(t => (
                        <li key={t.id} className="flex items-start gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg" data-testid={`ticket-item-${t.id}`}>
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            t.priority === 'high' ? 'bg-red-100 dark:bg-red-900/40' : t.priority === 'medium' ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-slate-100 dark:bg-slate-700'
                          }`}>
                            <Wrench className={`w-4 h-4 ${t.priority === 'high' ? 'text-red-600 dark:text-red-400' : t.priority === 'medium' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{t.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {t.category} · <span className="uppercase tracking-wide font-semibold">{t.priority}</span> · {t.status}
                            </p>
                            {t.description && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">{t.description}</p>}
                            <p className="text-xs text-slate-400 mt-0.5">{fmtDate(t.created_at)}</p>
                          </div>
                          <Select value={t.status} onValueChange={(v) => updateTicket.mutate({ id: t.id, data: { status: v } })}>
                            <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="sm" onClick={() => deleteTicket.mutate(t.id)} className="h-8 w-8 p-0" title="Delete">
                            <Trash2 className="w-4 h-4 text-slate-400" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* ── Right Sidebar ── */}
        <aside className="space-y-4">
          {/* Retention quick summary */}
          {isLeasing && (
            <Card className="p-5">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-400" /> Quick Retention
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Score" value={`${contact.retention_score ?? 0}/100`} />
                <StatTile label="Tickets Open" value={tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length} />
                <StatTile label="Emails" value={allActivities.filter(a => a.activity_type === 'email').length} />
                <StatTile label="Days in Stage" value={contact.stage_updated_at ? Math.max(0, Math.floor((Date.now() - new Date(contact.stage_updated_at).getTime()) / 86400000)) : '—'} />
              </div>
            </Card>
          )}

          {/* Collaborators */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" /> Collaborators
              </h4>
              <Button variant="ghost" size="sm" onClick={() => setShowCollab(true)} className="h-7 w-7 p-0" data-testid="add-collaborator-button">
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>
            {collaborators.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">No collaborators yet</p>
            ) : (
              <ul className="space-y-2">
                {collaborators.map(c => (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-semibold">
                      {c.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{c.name}</p>
                      <p className="text-xs text-slate-400 truncate">{c.role}</p>
                    </div>
                    <button onClick={() => removeColl.mutate(c.id)} className="text-slate-300 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Linked deals */}
          <Card className="p-5">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-slate-400" /> Linked Deals
            </h4>
            {deals.length === 0 ? <p className="text-sm text-slate-400">No deals linked</p> : (
              <ul className="space-y-2">
                {deals.map(d => (
                  <li key={d.id} className="text-sm flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/pipeline')}>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 dark:text-slate-200 truncate group-hover:underline">{d.title}</p>
                      <p className="text-xs text-slate-400">{d.stage} · {fmtMoney(d.value)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      {/* ══ Floating + action ══ */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-slate-900 dark:bg-slate-700 text-white shadow-lg hover:bg-slate-800 dark:hover:bg-slate-600 flex items-center justify-center z-[9999]"
            data-testid="floating-plus-button"
          >
            <Plus className="w-6 h-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-52">
          <DropdownMenuItem onClick={() => setShowTask(true)} data-testid="fab-add-task"><CheckCircle2 className="w-4 h-4 mr-2" /> Add Task</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowEvent(true)} data-testid="fab-add-event"><CalendarDays className="w-4 h-4 mr-2" /> Add Event</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowNote(true)} data-testid="fab-add-note"><StickyNote className="w-4 h-4 mr-2" /> Add Note</DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()} data-testid="fab-add-file"><Paperclip className="w-4 h-4 mr-2" /> Add File</DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/sequences')} data-testid="fab-add-sequence"><Repeat className="w-4 h-4 mr-2" /> Add to Sequence</DropdownMenuItem>
          {isLeasing && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowTicket(true)} data-testid="fab-log-maintenance"><Wrench className="w-4 h-4 mr-2" /> Log Maintenance</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ═══════════════════════════════ DIALOGS ═══════════════════════════════ */}

      {/* Add Tag */}
      <Dialog open={showTag} onOpenChange={setShowTag}>
        <DialogContent className="sm:max-w-sm" data-testid="add-tag-dialog">
          <DialogHeader><DialogTitle>Add Tag</DialogTitle></DialogHeader>
          <Input
            autoFocus value={newTag} onChange={(e) => setNewTag(e.target.value)}
            placeholder="e.g. VIP, Pet-Friendly, Relocating"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTag.trim()) {
                addTag.mutate(newTag.trim(), { onSuccess: () => { setNewTag(''); setShowTag(false); } });
              }
            }}
            data-testid="tag-input"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTag(false)}>Cancel</Button>
            <Button
              onClick={() => newTag.trim() && addTag.mutate(newTag.trim(), { onSuccess: () => { setNewTag(''); setShowTag(false); } })}
              data-testid="tag-submit"
            >Add Tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Activity */}
      <Dialog open={showActivity} onOpenChange={setShowActivity}>
        <DialogContent data-testid="log-activity-dialog">
          <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
          <ActivityForm
            onSubmit={async (payload) => {
              await createActivity.mutateAsync({ ...payload, contact_id: id });
              setShowActivity(false);
            }}
            allowSms={!!contact.phone}
            allowEmail={!!contact.email}
          />
        </DialogContent>
      </Dialog>

      {/* Add Note */}
      <Dialog open={showNote} onOpenChange={setShowNote}>
        <DialogContent data-testid="add-note-dialog">
          <DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
          <ActivityForm
            fixedType="note"
            onSubmit={async (payload) => {
              await createActivity.mutateAsync({ ...payload, contact_id: id });
              setShowNote(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Add Task */}
      <Dialog open={showTask} onOpenChange={setShowTask}>
        <DialogContent data-testid="add-task-dialog">
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <TaskForm
            onSubmit={async (payload) => {
              await createTask.mutateAsync({ ...payload, contact_id: id });
              setShowTask(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Add Event */}
      <Dialog open={showEvent} onOpenChange={setShowEvent}>
        <DialogContent data-testid="add-event-dialog">
          <DialogHeader><DialogTitle>Add Event</DialogTitle></DialogHeader>
          <EventForm
            onSubmit={async (payload) => {
              await createEvent.mutateAsync(payload);
              setShowEvent(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Email */}
      <EmailDialog
        open={showEmail} onClose={() => setShowEmail(false)}
        to={contact.email} form={emailForm} setForm={setEmailForm}
        templates={emailTpls} onSend={handleSendEmail}
        contactName={contact.name}
      />

      {/* SMS */}
      <SmsDialog
        open={showSms} onClose={() => setShowSms(false)}
        to={contact.phone} form={smsForm} setForm={setSmsForm}
        templates={smsTpls} onSend={handleSendSms}
        contactName={contact.name}
      />

      {/* Ticket */}
      <Dialog open={showTicket} onOpenChange={setShowTicket}>
        <DialogContent data-testid="add-ticket-dialog">
          <DialogHeader><DialogTitle>New Maintenance Ticket</DialogTitle></DialogHeader>
          <TicketForm onSubmit={async (payload) => { await createTicket.mutateAsync(payload); setShowTicket(false); }} />
        </DialogContent>
      </Dialog>

      {/* Lease edit */}
      <Dialog open={showLease} onOpenChange={setShowLease}>
        <DialogContent className="sm:max-w-lg" data-testid="edit-lease-dialog">
          <DialogHeader><DialogTitle>Lease Information</DialogTitle></DialogHeader>
          <LeaseForm
            initial={leaseData?.current || {}}
            onSubmit={async (payload) => { await saveLease.mutateAsync(payload); setShowLease(false); }}
          />
        </DialogContent>
      </Dialog>

      {/* Collaborators */}
      <Dialog open={showCollab} onOpenChange={setShowCollab}>
        <DialogContent className="sm:max-w-sm" data-testid="add-collaborator-dialog">
          <DialogHeader><DialogTitle>Add Collaborator</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {teamMembers.filter(u => !collaborators.find(c => c.id === u.id)).map(u => (
              <button
                key={u.id}
                onClick={() => { addColl.mutate(u.id); setShowCollab(false); }}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-left"
                data-testid={`add-collab-${u.id}`}
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200 flex items-center justify-center text-xs font-semibold">
                  {u.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-sm text-slate-800 dark:text-slate-100">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
              </button>
            ))}
            {teamMembers.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No team members found. Invite teammates in Settings.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Email analysis */}
      <Dialog open={showAnalysis} onOpenChange={setShowAnalysis}>
        <DialogContent className="sm:max-w-lg" data-testid="email-analysis-dialog">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> AI Email Analysis</DialogTitle></DialogHeader>
          <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-[400px] overflow-y-auto" data-testid="email-analysis-text">
            {analysisText || 'No analysis available.'}
          </div>
        </DialogContent>
      </Dialog>

      {/* Renewal offer preview */}
      <Dialog open={showRenewal} onOpenChange={setShowRenewal}>
        <DialogContent className="sm:max-w-lg" data-testid="renewal-offer-dialog">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Repeat className="w-4 h-4 text-indigo-500" /> Renewal Offer Draft</DialogTitle></DialogHeader>
          <Textarea value={renewalDraft} onChange={(e) => setRenewalDraft(e.target.value)} rows={14} className="font-mono text-sm" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenewal(false)}>Close</Button>
            <Button
              onClick={() => {
                // Parse subject from draft
                const lines = renewalDraft.split('\n');
                let subject = 'Renewal Offer';
                let body = renewalDraft;
                for (const line of lines) {
                  if (line.toLowerCase().startsWith('subject:')) {
                    subject = line.replace(/^subject:\s*/i, '').trim();
                    body = renewalDraft.replace(line, '').trim();
                    break;
                  }
                }
                setEmailForm({ subject, body });
                setShowRenewal(false);
                setShowEmail(true);
              }}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Send className="w-3.5 h-3.5" /> Send via Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════ SMALL COMPONENTS ══════════════════════════════

function ActionBtn({ icon: Icon, label, onClick, testid }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="gap-1.5 flex-shrink-0" data-testid={testid}>
      <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="py-10 flex flex-col items-center justify-center text-center">
      <Icon className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
      <p className="text-sm text-slate-400 dark:text-slate-500">{text}</p>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{value}</p>
    </div>
  );
}

function ThreadList({ items, iconBg, Icon, emptyText }) {
  if (!items || items.length === 0) return <EmptyState icon={Icon} text={emptyText} />;
  return (
    <ul className="space-y-3">
      {items.map((a, i) => (
        <li key={a.id || i} className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800 dark:text-slate-200 break-words whitespace-pre-wrap">{a.description}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{fmtDate(a.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function LeasePanel({ lease, history, onEdit }) {
  if (!lease) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Lease Information</h3>
          <Button size="sm" onClick={onEdit} className="gap-1.5" data-testid="create-lease-button">
            <Plus className="w-3.5 h-3.5" /> Create Lease
          </Button>
        </div>
        <EmptyState icon={Home} text="No active lease on record" />
      </Card>
    );
  }
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Lease Information</h3>
        <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5" data-testid="edit-lease-button">
          <MoreHorizontal className="w-3.5 h-3.5" /> Edit
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Monthly Rent" value={fmtMoney(lease.monthly_rent)} />
        <StatTile label="Security Deposit" value={fmtMoney(lease.security_deposit)} />
        <StatTile label="Unit" value={lease.unit || '—'} />
        <StatTile label="Term" value={`${lease.lease_term_months || 0} mo`} />
        <StatTile label="Move-In" value={fmtDateOnly(lease.move_in_date)} />
        <StatTile label="Lease Ends" value={fmtDateOnly(lease.lease_end)} />
      </div>
      {lease.notes && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Notes</p>
          <p className="text-sm text-slate-700 dark:text-slate-300">{lease.notes}</p>
        </div>
      )}
      {history.length > 0 && (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Renewal History</p>
          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {history.map(h => (
              <li key={h.id} className="flex items-center justify-between">
                <span>{fmtDateOnly(h.lease_start)} → {fmtDateOnly(h.lease_end)}</span>
                <span className="text-xs text-slate-400">{fmtMoney(h.monthly_rent)} · {h.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ── Forms ──
function ActivityForm({ onSubmit, fixedType, allowEmail = true, allowSms = true }) {
  const [type, setType] = useState(fixedType || 'note');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit({ activity_type: type, description: desc }); } finally { setBusy(false); } }}>
      {!fixedType && (
        <div>
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="call">Call</SelectItem>
              {allowEmail && <SelectItem value="email">Email</SelectItem>}
              <SelectItem value="note">Note</SelectItem>
              <SelectItem value="meeting">Meeting</SelectItem>
              {allowSms && <SelectItem value="sms">SMS</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <Label>Description</Label>
        <Textarea required rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What happened?" data-testid="activity-description" />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={busy} data-testid="activity-submit">{busy ? 'Saving…' : 'Save'}</Button>
      </DialogFooter>
    </form>
  );
}

function TaskForm({ onSubmit }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', due_date: '' });
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit(form); } finally { setBusy(false); } }}>
      <Input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="task-title" />
      <Textarea rows={2} placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} data-testid="task-due" />
        <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={busy} data-testid="task-submit">{busy ? 'Adding…' : 'Add Task'}</Button>
      </DialogFooter>
    </form>
  );
}

function EventForm({ onSubmit }) {
  const [form, setForm] = useState({ title: '', start: '', end: '', location: '', description: '', event_type: 'meeting' });
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit(form); } finally { setBusy(false); } }}>
      <Input required placeholder="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="event-title" />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Start</Label>
          <Input type="datetime-local" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} data-testid="event-start" />
        </div>
        <div>
          <Label className="text-xs">End</Label>
          <Input type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
        </div>
      </div>
      <Input placeholder="Location (optional)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
      <Textarea rows={2} placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <DialogFooter>
        <Button type="submit" disabled={busy} data-testid="event-submit">{busy ? 'Saving…' : 'Add Event'}</Button>
      </DialogFooter>
    </form>
  );
}

function TicketForm({ onSubmit }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', category: 'general', status: 'open' });
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit(form); } finally { setBusy(false); } }}>
      <Input required placeholder="Ticket title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="ticket-title" />
      <Textarea rows={3} placeholder="Describe the issue" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
        <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="plumbing">Plumbing</SelectItem>
            <SelectItem value="electrical">Electrical</SelectItem>
            <SelectItem value="hvac">HVAC</SelectItem>
            <SelectItem value="appliance">Appliance</SelectItem>
            <SelectItem value="pest">Pest</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={busy} data-testid="ticket-submit">{busy ? 'Saving…' : 'Create Ticket'}</Button>
      </DialogFooter>
    </form>
  );
}

function LeaseForm({ initial, onSubmit }) {
  const [form, setForm] = useState({
    unit: initial.unit || '',
    monthly_rent: initial.monthly_rent || 0,
    security_deposit: initial.security_deposit || 0,
    lease_start: initial.lease_start || '',
    lease_end: initial.lease_end || '',
    move_in_date: initial.move_in_date || '',
    lease_term_months: initial.lease_term_months || 12,
    status: initial.status || 'active',
    notes: initial.notes || '',
  });
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit(form); } finally { setBusy(false); } }}>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
        <div><Label className="text-xs">Term (months)</Label><Input type="number" value={form.lease_term_months} onChange={(e) => setForm({ ...form, lease_term_months: parseInt(e.target.value || '0', 10) })} /></div>
        <div><Label className="text-xs">Monthly Rent ($)</Label><Input type="number" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: parseFloat(e.target.value || '0') })} data-testid="lease-rent" /></div>
        <div><Label className="text-xs">Security Deposit ($)</Label><Input type="number" value={form.security_deposit} onChange={(e) => setForm({ ...form, security_deposit: parseFloat(e.target.value || '0') })} /></div>
        <div><Label className="text-xs">Move-In</Label><Input type="date" value={form.move_in_date} onChange={(e) => setForm({ ...form, move_in_date: e.target.value })} /></div>
        <div><Label className="text-xs">Lease Start</Label><Input type="date" value={form.lease_start} onChange={(e) => setForm({ ...form, lease_start: e.target.value })} /></div>
        <div><Label className="text-xs">Lease End</Label><Input type="date" value={form.lease_end} onChange={(e) => setForm({ ...form, lease_end: e.target.value })} /></div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="renewed">Renewed</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={busy} data-testid="lease-submit">{busy ? 'Saving…' : 'Save Lease'}</Button>
      </DialogFooter>
    </form>
  );
}

function EmailDialog({ open, onClose, to, form, setForm, templates, onSend, contactName }) {
  const applyTpl = (tpl) => {
    const replace = (t) => (t || '').replace(/\{contact_name\}/g, contactName || '');
    setForm({ subject: replace(tpl.subject || ''), body: replace(tpl.body || '') });
    api.post(`/templates/${tpl.id}/use`).catch(() => {});
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" data-testid="send-email-dialog">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="w-4 h-4 text-blue-500" /> Send Email</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {templates.length > 0 && (
            <div>
              <Label>Template</Label>
              <Select onValueChange={(v) => { const t = templates.find(x => x.id === v); if (t) applyTpl(t); }}>
                <SelectTrigger><SelectValue placeholder="Pick a template…" /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Input value={to || ''} disabled className="bg-slate-50 dark:bg-slate-700/50" />
          <Input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} data-testid="email-subject" />
          <Textarea rows={8} placeholder="Body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} data-testid="email-body" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSend} className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800" data-testid="email-send"><Send className="w-3.5 h-3.5" /> Send</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SmsDialog({ open, onClose, to, form, setForm, templates, onSend, contactName }) {
  const applyTpl = (tpl) => {
    setForm({ message: (tpl.body || '').replace(/\{contact_name\}/g, contactName || '') });
    api.post(`/templates/${tpl.id}/use`).catch(() => {});
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="send-sms-dialog">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-green-500" /> Send Text</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {templates.length > 0 && (
            <Select onValueChange={(v) => { const t = templates.find(x => x.id === v); if (t) applyTpl(t); }}>
              <SelectTrigger><SelectValue placeholder="Pick a template…" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Input value={to || ''} disabled className="bg-slate-50 dark:bg-slate-700/50" />
          <Textarea rows={4} placeholder="Message" value={form.message} onChange={(e) => setForm({ message: e.target.value })} data-testid="sms-message" />
          <p className="text-xs text-slate-400">{form.message.length}/160</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSend} className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800" data-testid="sms-send"><MessageCircle className="w-3.5 h-3.5" /> Send</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
