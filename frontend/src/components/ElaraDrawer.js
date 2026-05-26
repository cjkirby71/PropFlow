import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, X, Plus, ChevronLeft, Maximize2, MessageSquare, Trash2 } from 'lucide-react';
import { useElaraUI } from '../contexts/ElaraContext';
import { useElaraConversations, useDeleteElaraConversation } from '../hooks/useElara';
import ElaraChatPanel from './ElaraChatPanel';
import { Button } from './ui/button';
import { toast } from 'sonner';

/**
 * Floating Elara entrypoint:
 *   • A bottom-right launcher button (always visible inside authenticated layout)
 *   • A slide-in drawer (panel on right) with conversation list + active thread
 *   • An "expand" button that links to the full /elara workspace
 */
export default function ElaraDrawer() {
  const { open, openDrawer, closeDrawer, activeConversationId, setActiveConversationId, startNewConversation } = useElaraUI();
  const [view, setView] = useState('chat'); // 'chat' | 'list'
  const location = useLocation();
  const { data: convData } = useElaraConversations(false);
  const conversations = convData?.items || [];
  const deleteConv = useDeleteElaraConversation();

  // Hide the floating launcher on the dedicated /elara page (would be redundant)
  const onElaraPage = location.pathname === '/elara';

  const handleSelectConv = (id) => {
    setActiveConversationId(id);
    setView('chat');
  };

  const handleNewChat = () => {
    startNewConversation();
    setView('chat');
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
    try {
      await deleteConv.mutateAsync(id);
      if (activeConversationId === id) setActiveConversationId(null);
      toast.success('Conversation deleted');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Delete failed');
    }
  };

  return (
    <>
      {/* Floating launcher button (hidden on /elara page or when drawer is open) */}
      {!onElaraPage && !open && (
        <button
          onClick={() => openDrawer()}
          className="fixed bottom-6 right-6 z-40 md:z-50 group flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-gradient-to-br from-brand via-teal-600 to-teal-700 text-white shadow-premium-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 ring-4 ring-brand/10 dark:ring-brand/20"
          data-testid="elara-launcher-btn"
          title="Ask Elara"
        >
          <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" strokeWidth={2.4} />
          <span className="text-[13px] font-semibold tracking-tight hidden sm:inline">Ask Elara</span>
        </button>
      )}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 dark:bg-slate-950/50 backdrop-blur-sm transition-opacity"
          onClick={closeDrawer}
          data-testid="elara-drawer-backdrop"
        />
      )}

      {/* Drawer (slide from right) */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-700/60 flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
        data-testid="elara-drawer"
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 h-[60px] border-b border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {view === 'list' ? (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView('chat')} data-testid="elara-back-btn">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-teal-700 flex items-center justify-center shadow-sm flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" strokeWidth={2.4} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
                {view === 'list' ? 'Your conversations' : 'Elara'}
              </p>
              {view === 'chat' && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Your Second Brain</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {view === 'chat' && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 dark:text-slate-400"
                  onClick={() => setView('list')}
                  data-testid="elara-history-btn"
                  title="Conversation history"
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 dark:text-slate-400"
                  onClick={handleNewChat}
                  data-testid="elara-new-chat-btn"
                  title="New conversation"
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Link to="/elara" onClick={closeDrawer}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 dark:text-slate-400"
                    data-testid="elara-expand-btn"
                    title="Open full workspace"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </Link>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-500 dark:text-slate-400"
              onClick={closeDrawer}
              data-testid="elara-close-btn"
              title="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col">
          {view === 'chat' ? (
            <ElaraChatPanel variant="drawer" />
          ) : (
            <div className="flex-1 overflow-y-auto p-3 space-y-1" data-testid="elara-conversation-list">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 mb-2 h-9 text-[13px] border-dashed"
                onClick={handleNewChat}
                data-testid="elara-list-new-btn"
              >
                <Plus className="w-3.5 h-3.5" /> New conversation
              </Button>
              {conversations.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">No conversations yet.</p>
                </div>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    className={`group w-full text-left rounded-lg border transition flex items-start gap-2 ${
                      activeConversationId === c.id
                        ? 'bg-brand/10 dark:bg-brand/20 border-brand/40'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/60 hover:border-brand/30 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                    }`}
                    data-testid={`elara-conv-item-${c.id}`}
                  >
                    <button
                      onClick={() => handleSelectConv(c.id)}
                      className="flex-1 min-w-0 flex items-start gap-2 p-2.5 text-left"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100 truncate">{c.title || 'Untitled'}</p>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                          {c.message_count || 0} message{c.message_count === 1 ? '' : 's'}
                          {c.updated_at ? ` · ${formatRelative(c.updated_at)}` : ''}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, c.id)}
                      className="opacity-0 group-hover:opacity-100 transition text-slate-400 hover:text-rose-500 flex-shrink-0 p-2.5"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </aside>
    </>
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
  } catch {
    return '';
  }
}
