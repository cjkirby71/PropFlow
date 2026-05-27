import React, { useEffect, useState } from 'react';
import {
  Sparkles, Plus, MessageSquare, Trash2, Pencil, Check, X as XIcon, Archive, ArchiveRestore,
  LayoutDashboard, Bot, Plug, ChevronLeft,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import ElaraChatPanel from '../components/ElaraChatPanel';
import BriefingDashboard from '../components/BriefingDashboard';
import ApprovalQueue from '../components/ApprovalQueue';
import CrewActivityFeed from '../components/CrewActivityFeed';
import IntegrationsHub from '../components/IntegrationsHub';
import { useElaraUI } from '../contexts/ElaraContext';
import {
  useElaraConversations,
  useElaraConversation,
  useDeleteElaraConversation,
  useUpdateElaraConversation,
} from '../hooks/useElara';

const TABS = [
  { id: 'briefing', label: 'Briefing', icon: LayoutDashboard },
  { id: 'chat', label: 'Chat', icon: Bot },
  { id: 'integrations', label: 'Integrations', icon: Plug },
];

export default function ElaraPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeConversationId, setActiveConversationId, startNewConversation, closeDrawer, setPendingPrompt, openDrawer } = useElaraUI();

  // Active tab — keep in URL ?tab= so deep links work, and so the drawer can deeplink with /elara?tab=chat
  const tabFromUrl = searchParams.get('tab');
  const initialTab = TABS.find(t => t.id === tabFromUrl) ? tabFromUrl : 'briefing';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab change → URL
  useEffect(() => {
    if ((searchParams.get('tab') || 'briefing') !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', activeTab);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // If user navigates with ?tab=
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab && TABS.find(t => t.id === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  // Ensure floating drawer is closed when on /elara (avoid overlap)
  useEffect(() => { closeDrawer(); }, [closeDrawer]);

  // Briefing → "Ask Elara" handler — switch to Chat tab with prompt pre-filled
  const handleAskElara = (prompt) => {
    setPendingPrompt(prompt || '');
    startNewConversation();
    setActiveTab('chat');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] bg-slate-50 dark:bg-slate-900" data-testid="elara-page">
      {/* Page header */}
      <header className="h-[60px] border-b border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 flex items-center px-4 sm:px-6 gap-3 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="md:hidden p-1.5 -ml-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          title="Back"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand to-teal-700 flex items-center justify-center shadow-sm flex-shrink-0">
          <Sparkles className="w-4.5 h-4.5 text-white" strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 leading-tight" data-testid="elara-page-title">
            Elara — your Second Brain
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Command center · Tenant-isolated · GPT-5.2</p>
        </div>
        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 rounded-lg p-1" data-testid="elara-tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 text-[12px] font-semibold px-2.5 sm:px-3 py-1.5 rounded-md transition ${
                  active
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                data-testid={`elara-tab-${t.id}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'briefing' && <BriefingView onAskElara={handleAskElara} />}
        {activeTab === 'chat' && <ChatView />}
        {activeTab === 'integrations' && (
          <div className="p-4 sm:p-6 max-w-6xl mx-auto" data-testid="elara-integrations-view">
            <IntegrationsHub />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BRIEFING VIEW: Daily briefing + Approval Queue + Crew Activity ──────────
function BriefingView({ onAskElara }) {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto" data-testid="elara-briefing-view">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left/main column: briefing + approvals */}
        <div className="lg:col-span-2 space-y-4">
          <BriefingDashboard onAskElara={onAskElara} />
          <ApprovalQueue />
        </div>
        {/* Right column: activity feed */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-4">
            <CrewActivityFeed />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CHAT VIEW: conversation sidebar + chat panel ────────────────────────────
function ChatView() {
  const { activeConversationId, setActiveConversationId, startNewConversation } = useElaraUI();
  const [showArchived, setShowArchived] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const { data: convData, isLoading } = useElaraConversations(showArchived);
  const conversations = convData?.items || [];
  const { data: activeConv } = useElaraConversation(activeConversationId);
  const deleteConv = useDeleteElaraConversation();
  const updateConv = useUpdateElaraConversation();

  const handleNewChat = () => { startNewConversation(); setEditingTitle(false); };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
    try {
      await deleteConv.mutateAsync(id);
      if (activeConversationId === id) setActiveConversationId(null);
      toast.success('Conversation deleted');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Delete failed');
    }
  };

  const handleArchive = async (id, archived) => {
    try {
      await updateConv.mutateAsync({ id, data: { archived: !archived } });
      toast.success(archived ? 'Restored' : 'Archived');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Failed');
    }
  };

  const handleSaveTitle = async () => {
    if (!activeConversationId || !titleDraft.trim()) { setEditingTitle(false); return; }
    try {
      await updateConv.mutateAsync({ id: activeConversationId, data: { title: titleDraft.trim() } });
      setEditingTitle(false);
    } catch (err) {
      toast.error('Could not rename');
    }
  };

  const activeTitle = activeConv?.title || 'New conversation';

  return (
    <div className="flex h-full" data-testid="elara-chat-view">
      {/* Sidebar */}
      <aside className="hidden md:flex w-72 flex-col border-r border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60">
        <div className="p-3 border-b border-slate-200 dark:border-slate-700/60">
          <Button
            className="w-full justify-start gap-2 bg-brand hover:bg-brand-dark text-white h-9 text-[13px]"
            onClick={handleNewChat}
            data-testid="elara-page-new-btn"
          >
            <Plus className="w-3.5 h-3.5" /> New conversation
          </Button>
          <div className="flex items-center gap-1 mt-2">
            <button
              onClick={() => setShowArchived(false)}
              className={`flex-1 text-[11px] font-semibold py-1.5 rounded-md transition ${
                !showArchived ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
              data-testid="elara-tab-active"
            >
              Active
            </button>
            <button
              onClick={() => setShowArchived(true)}
              className={`flex-1 text-[11px] font-semibold py-1.5 rounded-md transition ${
                showArchived ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
              data-testid="elara-tab-archived"
            >
              Archived
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1" data-testid="elara-page-conv-list">
          {isLoading ? (
            <div className="space-y-2 px-1">
              {[1, 2, 3].map((i) => (<div key={i} className="h-12 bg-slate-100 dark:bg-slate-700/60 rounded-lg animate-pulse" />))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 px-3">
              <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-[12px] text-slate-500 dark:text-slate-400">{showArchived ? 'No archived conversations.' : 'No conversations yet.'}</p>
              {!showArchived && (<p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Click "New conversation" to start.</p>)}
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`group rounded-lg border transition ${
                  activeConversationId === c.id
                    ? 'bg-brand/10 dark:bg-brand/20 border-brand/40'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/60 hover:border-brand/30 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <button onClick={() => setActiveConversationId(c.id)} className="w-full text-left p-2.5 flex items-start gap-2" data-testid={`elara-page-conv-${c.id}`}>
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100 truncate">{c.title || 'Untitled'}</p>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                      {c.message_count || 0} msg{c.message_count === 1 ? '' : 's'} · {formatRelative(c.updated_at)}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-0.5 px-2 pb-1.5 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => handleArchive(c.id, c.archived)} className="text-[10.5px] text-slate-500 dark:text-slate-400 hover:text-brand flex items-center gap-1 px-1.5 py-0.5 rounded" title={c.archived ? 'Restore' : 'Archive'}>
                    {c.archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                    {c.archived ? 'Restore' : 'Archive'}
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="text-[10.5px] text-rose-500 hover:text-rose-700 flex items-center gap-1 px-1.5 py-0.5 rounded ml-auto" title="Delete">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sub-header for conversation */}
        <div className="border-b border-slate-200 dark:border-slate-700/60 px-4 sm:px-6 py-2.5 flex items-center gap-3 bg-white dark:bg-slate-800/40 min-h-[48px]" data-testid="elara-chat-subheader">
          <div className="flex-1 min-w-0">
            {editingTitle && activeConversationId ? (
              <div className="flex items-center gap-1.5">
                <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false); }} autoFocus className="h-8 text-[13px] font-semibold max-w-sm" data-testid="elara-title-input" />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveTitle} data-testid="elara-title-save">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingTitle(false)}>
                  <XIcon className="w-3.5 h-3.5 text-slate-400" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">{activeConversationId ? activeTitle : 'New conversation'}</p>
                {activeConversationId && (
                  <button onClick={() => { setTitleDraft(activeTitle); setEditingTitle(true); }} className="text-slate-400 hover:text-brand transition flex-shrink-0" title="Rename">
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
          {activeConversationId && (
            <Button variant="ghost" size="sm" onClick={() => handleDelete(activeConversationId)} className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 h-8 hidden sm:inline-flex text-[11px]" data-testid="elara-page-delete-btn">
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
          )}
        </div>
        <div className="flex-1 min-h-0">
          <ElaraChatPanel variant="page" />
        </div>
      </div>
    </div>
  );
}

function formatRelative(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch { return ''; }
}
