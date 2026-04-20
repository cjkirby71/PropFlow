import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Inbox as InboxIcon, UserCheck, FilePen, Send as SendIcon, Archive,
  Mail, MessageSquare, Voicemail, Search, Phone, ExternalLink,
  MoreHorizontal, Sparkles, ArrowLeft, CheckCheck, X as XIcon,
  UserPlus, Clock, Tag, TrendingUp, ChevronRight, Paperclip, Filter,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  useInboxCounts, useInboxThreads, useInboxThread, useSendInboxReply,
  useMarkThreadRead, useAssignThread, useCloseThread, useSaveInboxDraft,
  useSeedInboxDemo, useTemplates,
} from '../hooks/useApi';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const FOLDERS = [
  { id: 'inbox',    label: 'Inbox',    icon: InboxIcon,  countKey: 'inbox' },
  { id: 'assigned', label: 'Assigned', icon: UserCheck,  countKey: 'assigned' },
  { id: 'drafts',   label: 'Drafts',   icon: FilePen,    countKey: 'drafts' },
  { id: 'sent',     label: 'Sent',     icon: SendIcon,   countKey: 'sent' },
  { id: 'closed',   label: 'Closed',   icon: Archive,    countKey: 'closed' },
];

const CHANNEL_TABS = [
  { id: '',          label: 'All',       icon: null },
  { id: 'email',     label: 'Email',     icon: Mail },
  { id: 'sms',       label: 'SMS',       icon: MessageSquare },
  { id: 'voicemail', label: 'Voicemail', icon: Voicemail },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() || '').join('') || '?';
}

function relativeTime(iso) {
  if (!iso) return '';
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function formatDateTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    return isToday
      ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

const channelIcon = (ch) => {
  if (ch === 'sms') return MessageSquare;
  if (ch === 'voicemail') return Voicemail;
  return Mail;
};

const channelAccent = (ch) => {
  if (ch === 'sms') return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20';
  if (ch === 'voicemail') return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
  return 'text-brand dark:text-brand-ring bg-brand/10 dark:bg-brand/15';
};

// ─────────────────────────────────────────────────────────────────────────────
// LEFT FOLDERS SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
function FoldersSidebar({ folder, onSelect, counts }) {
  return (
    <div className="flex flex-col h-full w-[240px] border-r border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 shrink-0" data-testid="inbox-folders-sidebar">
      <div className="px-4 pt-5 pb-3 border-b border-slate-200 dark:border-slate-700/60">
        <h2 className="font-heading text-[15px] font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          My Inbox
          {counts?.unread > 0 && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 text-[11px] font-semibold rounded-md bg-rose-500 text-white" data-testid="inbox-unread-badge">
              {counts.unread}
            </span>
          )}
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Unified email, SMS, voicemail</p>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {FOLDERS.map(f => {
          const Icon = f.icon;
          const active = folder === f.id;
          const count = counts?.[f.countKey] ?? 0;
          return (
            <button
              key={f.id}
              onClick={() => onSelect(f.id)}
              className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-ring'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              data-testid={`inbox-folder-${f.id}`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-brand dark:text-brand-ring' : ''}`} strokeWidth={active ? 2.5 : 2} />
              <span className="flex-1 text-left">{f.label}</span>
              {count > 0 && (
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-brand dark:text-brand-ring'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`} data-testid={`inbox-folder-${f.id}-count`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// THREAD LIST (center-left pane)
// ─────────────────────────────────────────────────────────────────────────────
function ThreadList({ threads, isLoading, activeId, onSelect, channel, onChannel, search, onSearch, folder, onSeedDemo, seeding }) {
  const empty = !isLoading && threads.length === 0;
  return (
    <div className="flex flex-col h-full w-full md:w-[360px] border-r border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 shrink-0" data-testid="inbox-thread-list">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-700/60 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-heading text-[15px] font-bold text-slate-900 dark:text-slate-100 capitalize">{folder}</h3>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {threads.length} thread{threads.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search conversations..."
            className="pl-8 h-8 text-[13px] bg-slate-50 dark:bg-slate-700/60 border-slate-200 dark:border-slate-600/60"
            data-testid="inbox-search-input"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto -mx-0.5 px-0.5" data-testid="inbox-channel-filter">
          {CHANNEL_TABS.map(t => {
            const active = channel === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id || 'all'}
                onClick={() => onChannel(t.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                  active
                    ? 'bg-brand text-white border-brand shadow-sm'
                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                }`}
                data-testid={`inbox-channel-tab-${t.id || 'all'}`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" data-testid="inbox-threads-scroll">
        {isLoading && (
          <div className="p-6 text-[12px] text-slate-500 dark:text-slate-400">Loading threads...</div>
        )}
        {empty && (
          <div className="p-6 text-center" data-testid="inbox-empty-state">
            <InboxIcon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">No conversations</p>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">Your unified messages will appear here.</p>
            {folder === 'inbox' && (
              <Button size="sm" variant="outline" className="mt-4 h-8 text-[12px]" onClick={onSeedDemo} disabled={seeding} data-testid="inbox-seed-demo">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {seeding ? 'Seeding...' : 'Load demo inbox'}
              </Button>
            )}
          </div>
        )}
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {threads.map(t => {
            const isActive = activeId === t.contact_id;
            const Icon = channelIcon(t.last_channel);
            const accent = channelAccent(t.last_channel);
            const preview = t.has_draft ? `Draft: ${t.draft_preview}` : (t.last_subject || t.last_body || '—');
            return (
              <li key={t.contact_id}>
                <button
                  onClick={() => onSelect(t.contact_id)}
                  className={`w-full text-left px-3 py-3 flex gap-3 transition ${
                    isActive
                      ? 'bg-brand/5 dark:bg-brand/15 border-l-[3px] border-brand'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/40 border-l-[3px] border-transparent'
                  }`}
                  data-testid={`inbox-thread-${t.contact_id}`}
                >
                  <div className="relative shrink-0">
                    {t.photo_url ? (
                      <img src={t.photo_url} alt={t.name} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand/20 to-brand/10 dark:from-brand/30 dark:to-brand/20 text-brand dark:text-brand-ring font-bold text-[12px] flex items-center justify-center">
                        {initials(t.name)}
                      </div>
                    )}
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${accent} flex items-center justify-center ring-2 ring-white dark:ring-slate-800`}>
                      <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <p className={`text-[13px] truncate ${t.unread ? 'font-bold text-slate-900 dark:text-slate-50' : 'font-semibold text-slate-800 dark:text-slate-200'}`}>{t.name}</p>
                      <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{relativeTime(t.last_at)}</span>
                    </div>
                    <p className={`text-[12px] truncate mt-0.5 ${
                      t.has_draft ? 'text-amber-700 dark:text-amber-400 italic' :
                      t.unread ? 'text-slate-700 dark:text-slate-300 font-medium' :
                      'text-slate-500 dark:text-slate-400'
                    }`}>
                      {t.last_direction === 'outbound' && !t.has_draft && (
                        <span className="text-slate-400 mr-1">You:</span>
                      )}
                      {preview}
                    </p>
                  </div>
                  {t.unread > 0 && (
                    <span className="w-2 h-2 rounded-full bg-brand shrink-0 mt-1.5" data-testid={`inbox-unread-dot-${t.contact_id}`} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// THREAD VIEW (center pane)
// ─────────────────────────────────────────────────────────────────────────────
function ThreadView({ contactId, onBack, navigate }) {
  const { data, isLoading } = useInboxThread(contactId);
  const markRead = useMarkThreadRead();
  const assign = useAssignThread();
  const close = useCloseThread();
  const sendReply = useSendInboxReply(contactId);
  const saveDraft = useSaveInboxDraft();
  const messagesEndRef = useRef(null);

  // Default reply channel = last inbound message's channel, fallback to email
  const defaultChannel = useMemo(() => {
    const msgs = data?.messages || [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].direction === 'inbound' && msgs[i].channel !== 'voicemail') return msgs[i].channel;
    }
    return 'email';
  }, [data]);

  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  const { data: templates = [] } = useTemplates(channel);

  // Hydrate composer from draft + mark as read when thread opens
  useEffect(() => {
    if (!data) return;
    setChannel(data.draft?.channel || defaultChannel);
    setSubject(data.draft?.subject || '');
    setBody(data.draft?.body || '');
    if ((data.messages || []).some(m => m.direction === 'inbound' && !m.read)) {
      markRead.mutate(contactId);
    }
    // scroll to last message
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, data?.contact?.id]);

  // Auto-save draft (debounced)
  useEffect(() => {
    if (!contactId) return;
    const t = setTimeout(() => {
      if (body || subject) {
        saveDraft.mutate({ contact_id: contactId, channel, subject, body });
      }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, subject, channel]);

  if (!contactId) {
    return (
      <div className="hidden lg:flex flex-1 items-center justify-center bg-slate-50 dark:bg-slate-900/60" data-testid="inbox-no-thread-selected">
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-brand/20 to-brand/10 dark:from-brand/30 dark:to-brand/20 flex items-center justify-center mb-4">
            <InboxIcon className="w-7 h-7 text-brand dark:text-brand-ring" />
          </div>
          <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Select a conversation</p>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">Pick a thread from the left to view messages and reply.</p>
        </div>
      </div>
    );
  }

  const handleSend = async () => {
    if (!body.trim()) return;
    try {
      await sendReply.mutateAsync({ channel, subject, body });
      setBody('');
      setSubject('');
      toast.success(channel === 'email' ? 'Email sent' : 'SMS sent');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Send failed');
    }
  };

  const insertTemplate = (tpl) => {
    setBody(prev => prev ? `${prev}\n\n${tpl.body}` : tpl.body);
    if (tpl.subject && !subject) setSubject(tpl.subject);
    setShowTemplates(false);
  };

  const isClosed = data?.status === 'closed';
  const amAssigned = data?.assigned_to != null; // current user (server-side)

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-white dark:bg-slate-800/50" data-testid="inbox-thread-view">
      {/* Header */}
      <div className="h-[56px] px-4 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-3 shrink-0">
        <button className="md:hidden" onClick={onBack} data-testid="inbox-back-button">
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        {data?.contact && (
          <>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading text-[14px] font-bold text-slate-900 dark:text-slate-100 truncate">{data.contact.name}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{data.contact.email || data.contact.phone}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={amAssigned ? 'default' : 'outline'}
                className={`h-8 text-[12px] ${amAssigned ? 'bg-brand hover:bg-brand-dark' : ''}`}
                onClick={() => assign.mutate(contactId)}
                data-testid="inbox-assign-button"
              >
                <UserCheck className="w-3.5 h-3.5 mr-1" />
                {amAssigned ? 'Assigned' : 'Assign to me'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => close.mutate(contactId)}
                data-testid="inbox-close-button"
              >
                {isClosed ? <><InboxIcon className="w-3.5 h-3.5 mr-1" />Reopen</> : <><Archive className="w-3.5 h-3.5 mr-1" />Close</>}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" data-testid="inbox-thread-menu">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => navigate(`/contacts/${contactId}`)} data-testid="inbox-open-contact">
                    <ExternalLink className="w-3.5 h-3.5 mr-2" /> Open full profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => markRead.mutate(contactId)}>
                    <CheckCheck className="w-3.5 h-3.5 mr-2" /> Mark as read
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-5 bg-[#FAFBFC] dark:bg-slate-900/50" data-testid="inbox-messages-list">
        {isLoading && <p className="text-[12px] text-slate-500 dark:text-slate-400">Loading...</p>}
        {(data?.messages || []).map((m, i) => {
          const Icon = channelIcon(m.channel);
          const isOut = m.direction === 'outbound';
          const accent = channelAccent(m.channel);
          return (
            <div
              key={i}
              className={`flex gap-3 ${isOut ? 'flex-row-reverse' : ''}`}
              data-testid={`inbox-message-${i}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${accent}`}>
                <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
              </div>
              <div className={`max-w-[72%] ${isOut ? 'text-right' : ''}`}>
                <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="uppercase tracking-wide font-semibold">{m.channel}</span>
                  <span>·</span>
                  <span>{formatDateTime(m.created_at)}</span>
                  {isOut && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">· Sent</span>}
                </div>
                {m.subject && (
                  <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 mb-1">{m.subject}</p>
                )}
                <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                  isOut
                    ? 'bg-brand text-white rounded-tr-sm'
                    : m.channel === 'voicemail'
                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-700/50 rounded-tl-sm'
                      : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600/60 rounded-tl-sm'
                }`}>
                  {m.body}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800 p-3 sm:p-4 shrink-0" data-testid="inbox-composer">
        <div className="flex items-center gap-2 mb-2">
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="h-8 w-[110px] text-[12px]" data-testid="inbox-composer-channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email"><div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> Email</div></SelectItem>
              <SelectItem value="sms"><div className="flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" /> SMS</div></SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu open={showTemplates} onOpenChange={setShowTemplates}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-[12px]" data-testid="inbox-template-picker">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Templates
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 max-h-80 overflow-y-auto">
              {templates.length === 0 && <div className="p-3 text-[12px] text-slate-500">No {channel} templates yet.</div>}
              {templates.map(t => (
                <DropdownMenuItem key={t.id} onClick={() => insertTemplate(t)} data-testid={`inbox-template-${t.id}`}>
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-[12px] font-semibold">{t.name}</span>
                    <span className="text-[11px] text-slate-500 truncate max-w-[240px]">{t.body?.slice(0, 80)}...</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
            {channel === 'sms' ? `${body.length}/1600` : 'Replying via Brevo'}
          </span>
        </div>
        {channel === 'email' && (
          <Input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject"
            className="h-9 text-[13px] mb-2"
            data-testid="inbox-composer-subject"
          />
        )}
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={channel === 'email' ? 'Write your email...' : 'Type your SMS...'}
          rows={channel === 'email' ? 4 : 3}
          className="text-[13px] resize-none"
          data-testid="inbox-composer-body"
        />
        <div className="flex items-center justify-end gap-2 mt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setBody(''); setSubject(''); saveDraft.mutate({ contact_id: contactId, channel, subject: '', body: '' }); }}
            disabled={!body && !subject}
            className="h-8 text-[12px]"
            data-testid="inbox-discard-button"
          >
            <XIcon className="w-3.5 h-3.5 mr-1" /> Discard
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!body.trim() || sendReply.isPending}
            className="h-8 text-[12px] bg-brand hover:bg-brand-dark text-white"
            data-testid="inbox-send-button"
          >
            <SendIcon className="w-3.5 h-3.5 mr-1" />
            {sendReply.isPending ? 'Sending...' : `Send ${channel === 'email' ? 'Email' : 'SMS'}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT RAIL — Contact card + leasing info
// ─────────────────────────────────────────────────────────────────────────────
function ContactRail({ contactId, onOpenProfile }) {
  const { data } = useInboxThread(contactId);
  if (!contactId || !data?.contact) return null;
  const c = data.contact;
  const retention = c.retention_score;
  const retentionColor = retention == null ? 'bg-slate-100 text-slate-500' :
    retention >= 75 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
    retention >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';

  const telHref = c.phone ? `tel:${c.phone.replace(/\s+/g, '')}` : null;
  const mailHref = c.email ? `mailto:${c.email}` : null;

  return (
    <aside className="hidden xl:flex flex-col w-[300px] border-l border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 overflow-y-auto shrink-0" data-testid="inbox-contact-rail">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-700/60 text-center">
        {c.photo_url ? (
          <img src={c.photo_url} alt={c.name} className="w-16 h-16 rounded-full object-cover mx-auto" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand/25 to-brand/10 text-brand dark:text-brand-ring font-bold text-xl flex items-center justify-center mx-auto" data-testid="inbox-rail-avatar">
            {initials(c.name)}
          </div>
        )}
        <h4 className="mt-3 font-heading text-[15px] font-bold text-slate-900 dark:text-slate-100">{c.name}</h4>
        {c.is_tenant && <Badge className="mt-1 bg-emerald-100 text-emerald-700 border-0 text-[10px]">Active Tenant</Badge>}
      </div>

      {/* Contact actions */}
      <div className="p-4 space-y-2 border-b border-slate-200 dark:border-slate-700/60">
        {c.phone && (
          <a
            href={telHref}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700/40 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-brand/10 hover:text-brand transition"
            data-testid="inbox-rail-call"
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="font-medium">{c.phone}</span>
            <span className="ml-auto text-[10px] text-slate-400">Click to call</span>
          </a>
        )}
        {c.email && (
          <a
            href={mailHref}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700/40 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-brand/10 hover:text-brand transition truncate"
            data-testid="inbox-rail-email"
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium truncate">{c.email}</span>
          </a>
        )}
      </div>

      {/* Leasing info */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700/60">
        <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Leasing Info</h5>
        <dl className="space-y-2.5 text-[12px]">
          <div className="flex items-start gap-2">
            <Tag className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
            <div className="flex-1">
              <dt className="text-slate-500 dark:text-slate-400">Lease Status</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-200">{c.lease_status || '—'}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
            <div className="flex-1">
              <dt className="text-slate-500 dark:text-slate-400">Next Renewal</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-200">{c.next_renewal_date || '—'}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
            <div className="flex-1">
              <dt className="text-slate-500 dark:text-slate-400">Unit Interested In</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-200">{c.unit_interested || '—'}</dd>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1.5">
            <span className="text-slate-500 dark:text-slate-400">Retention Score</span>
            <span className={`ml-auto px-2 py-0.5 rounded-md text-[11px] font-bold ${retentionColor}`} data-testid="inbox-rail-retention">
              {retention == null ? '—' : retention}
            </span>
          </div>
        </dl>
      </div>

      {/* Quick actions */}
      <div className="p-4 space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start h-8 text-[12px]"
          onClick={onOpenProfile}
          data-testid="inbox-rail-open-profile"
        >
          <ExternalLink className="w-3.5 h-3.5 mr-2" /> Open full profile
        </Button>
        <Button variant="outline" size="sm" className="w-full justify-start h-8 text-[12px]" data-testid="inbox-rail-add-task">
          <UserPlus className="w-3.5 h-3.5 mr-2" /> Add task
        </Button>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function InboxPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [folder, setFolder] = useState(searchParams.get('folder') || 'inbox');
  const [channel, setChannel] = useState(searchParams.get('channel') || '');
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState(searchParams.get('thread') || null);

  const { data: counts } = useInboxCounts();
  const { data: threads = [], isLoading } = useInboxThreads({ folder, channel, search });
  const seedDemo = useSeedInboxDemo();

  // Keep URL in sync for deep links
  useEffect(() => {
    const next = new URLSearchParams();
    if (folder !== 'inbox') next.set('folder', folder);
    if (channel) next.set('channel', channel);
    if (activeId) next.set('thread', activeId);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, channel, activeId]);

  // Auto-select first thread when none active on desktop
  useEffect(() => {
    if (!activeId && threads.length > 0 && window.innerWidth >= 1024) {
      setActiveId(threads[0].contact_id);
    }
  }, [threads, activeId]);

  const handleSeed = async () => {
    try {
      const res = await seedDemo.mutateAsync();
      toast.success(`Loaded ${res.data.created} demo messages across ${res.data.contacts} contacts`);
    } catch (e) {
      toast.error('Could not seed demo inbox');
    }
  };

  const showThreadOnMobile = !!activeId;

  return (
    <div className="h-[calc(100vh-68px)] md:h-[calc(100vh-68px)] flex" data-testid="inbox-page">
      {/* Folders (desktop only inside the page; hidden on small) */}
      <div className="hidden md:block h-full">
        <FoldersSidebar folder={folder} onSelect={(f) => { setFolder(f); setActiveId(null); }} counts={counts} />
      </div>

      {/* On mobile: toggle between list and thread */}
      <div className={`flex flex-1 min-w-0 ${showThreadOnMobile ? 'hidden md:flex' : 'flex'}`}>
        <ThreadList
          threads={threads}
          isLoading={isLoading}
          activeId={activeId}
          onSelect={setActiveId}
          channel={channel}
          onChannel={setChannel}
          search={search}
          onSearch={setSearch}
          folder={folder}
          onSeedDemo={handleSeed}
          seeding={seedDemo.isPending}
        />
      </div>
      <div className={`flex-1 min-w-0 ${showThreadOnMobile ? 'flex' : 'hidden md:flex'}`}>
        <ThreadView
          contactId={activeId}
          onBack={() => setActiveId(null)}
          navigate={navigate}
        />
      </div>

      {/* Right rail — desktop only */}
      <ContactRail
        contactId={activeId}
        onOpenProfile={() => activeId && navigate(`/contacts/${activeId}`)}
      />

      {/* Mobile folder selector */}
      <div className="md:hidden fixed bottom-16 left-2 right-2 z-30" data-testid="inbox-mobile-folder-select">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-premium-xl rounded-full flex items-center justify-between px-2 py-1.5 overflow-x-auto">
          {FOLDERS.map(f => {
            const Icon = f.icon;
            const active = folder === f.id;
            const count = counts?.[f.countKey] ?? 0;
            return (
              <button
                key={f.id}
                onClick={() => { setFolder(f.id); setActiveId(null); }}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                  active ? 'bg-brand text-white' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Icon className="w-3 h-3" />
                {f.label}
                {count > 0 && <span className={`px-1 rounded ${active ? 'bg-white/25' : 'bg-slate-100 dark:bg-slate-700'}`}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
