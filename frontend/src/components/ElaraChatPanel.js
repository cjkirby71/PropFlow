import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Send, Loader2, Sparkles, AlertCircle, Square } from 'lucide-react';
import { Button } from './ui/button';
import { useElaraConversation, useElaraBriefing, streamElaraChat } from '../hooks/useElara';
import { useElaraUI } from '../contexts/ElaraContext';

/**
 * ElaraChatPanel — the actual chat UI (messages list + composer).
 * Reused by both ElaraDrawer (floating) and ElaraPage (/elara full-screen).
 *
 * Props:
 *   variant: 'drawer' | 'page'  → controls density/padding
 *   onCreatedConversation?: (id) => void → fired when a brand-new convo is created
 */
export default function ElaraChatPanel({ variant = 'drawer', onCreatedConversation }) {
  const qc = useQueryClient();
  const { activeConversationId, setActiveConversationId, pageContext, pendingPrompt, setPendingPrompt } = useElaraUI();
  const { data: conv, isLoading: convLoading } = useElaraConversation(activeConversationId);
  const { data: briefing } = useElaraBriefing(!activeConversationId);

  const [input, setInput] = useState('');
  const [pendingUserMsg, setPendingUserMsg] = useState(null); // optimistic user msg while streaming
  const [streamingText, setStreamingText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  // Apply pending prompt if any (e.g., "Summarize this contact" click)
  useEffect(() => {
    if (pendingPrompt) {
      setInput(pendingPrompt);
      setPendingPrompt('');
      // Slight delay so textarea is mounted
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [pendingPrompt, setPendingPrompt]);

  // Auto-scroll on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [conv?.messages?.length, streamingText, pendingUserMsg]);

  const sendMessage = useCallback(async (text) => {
    const msg = (text || '').trim();
    if (!msg || streaming) return;
    setError('');
    setInput('');
    setPendingUserMsg({ id: 'pending-' + Date.now(), role: 'user', content: msg, created_at: new Date().toISOString() });
    setStreamingText('');
    setStreaming(true);

    let createdNewConv = false;
    abortRef.current = streamElaraChat({
      conversationId: activeConversationId || null,
      message: msg,
      context: pageContext || undefined,
      onMeta: (meta) => {
        if (meta?.conversation_id && meta.conversation_id !== activeConversationId) {
          setActiveConversationId(meta.conversation_id);
          createdNewConv = !activeConversationId;
        }
      },
      onChunk: (_delta, full) => setStreamingText(full),
      onDone: async () => {
        setStreaming(false);
        setPendingUserMsg(null);
        setStreamingText('');
        // Refetch conversation messages (server has persisted both turns)
        await qc.invalidateQueries({ queryKey: ['elara', 'conversations'] });
        if (createdNewConv) onCreatedConversation?.();
      },
      onError: (err) => {
        setStreaming(false);
        setError(err?.message || 'Something went wrong. Please try again.');
      },
    });
  }, [activeConversationId, pageContext, qc, streaming, setActiveConversationId, onCreatedConversation]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const stopStream = () => {
    abortRef.current?.abort();
    setStreaming(false);
    setError('');
    setPendingUserMsg(null);
    setStreamingText('');
  };

  const messages = conv?.messages || [];
  const showBriefing = !activeConversationId && messages.length === 0 && !pendingUserMsg;
  const isCompact = variant === 'drawer';

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-900" data-testid="elara-chat-panel">
      {/* Messages scroller */}
      <div
        ref={scrollRef}
        className={`flex-1 min-h-0 overflow-y-auto ${isCompact ? 'px-4 py-3' : 'px-6 py-6'} space-y-3 elara-scroll`}
        data-testid="elara-messages-list"
      >
        {showBriefing && (
          <BriefingCard briefing={briefing} onSuggest={(p) => { setInput(p); textareaRef.current?.focus(); }} compact={isCompact} />
        )}

        {convLoading && activeConversationId && (
          <div className="flex items-center justify-center py-8 text-slate-400 dark:text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading conversation…
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} compact={isCompact} />
        ))}

        {/* Optimistic user msg + streaming assistant */}
        {pendingUserMsg && <MessageBubble role="user" content={pendingUserMsg.content} compact={isCompact} />}
        {streaming && (
          <MessageBubble role="assistant" content={streamingText} streaming compact={isCompact} />
        )}

        {error && (
          <div className="flex items-start gap-2 text-[12px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/60 rounded-md p-2.5" data-testid="elara-error">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className={`border-t border-slate-200 dark:border-slate-700/60 ${isCompact ? 'p-3' : 'p-4'} bg-white dark:bg-slate-900`}>
        <div className="flex items-end gap-2">
          <div className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 bg-white dark:bg-slate-800 transition">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={isCompact ? 2 : 3}
              placeholder="Ask Elara anything… (Shift+Enter for newline)"
              className="w-full resize-none bg-transparent border-0 focus:ring-0 focus:outline-none text-[13px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5"
              data-testid="elara-input"
              disabled={streaming}
            />
          </div>
          {streaming ? (
            <Button
              size="icon"
              variant="outline"
              className="h-10 w-10 rounded-lg border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex-shrink-0"
              onClick={stopStream}
              data-testid="elara-stop-btn"
              title="Stop generating"
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-10 w-10 rounded-lg bg-brand hover:bg-brand-dark text-white shadow-sm flex-shrink-0 disabled:opacity-50"
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              data-testid="elara-send-btn"
              title="Send (Enter)"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 px-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Powered by GPT-5.2 · tenant-isolated
        </p>
      </div>
    </div>
  );
}

// ─── Message bubble ─────────────────────────────────────────────────────────
function MessageBubble({ role, content, streaming = false, compact = false }) {
  const isUser = role === 'user';
  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      data-testid={`elara-message-${role}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl ${compact ? 'px-3 py-2 text-[13px]' : 'px-4 py-2.5 text-[13.5px]'} leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-brand text-white rounded-br-md shadow-sm'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-md border border-slate-200/60 dark:border-slate-700/60'
        }`}
      >
        {content || (streaming ? <span className="inline-flex items-center gap-1.5 text-slate-400"><Loader2 className="w-3 h-3 animate-spin" /> Elara is thinking…</span> : '')}
        {streaming && content && <span className="inline-block w-1.5 h-3.5 bg-current opacity-60 ml-1 animate-pulse align-middle" />}
      </div>
    </div>
  );
}

// ─── Briefing welcome card (no conversation selected) ───────────────────────
function BriefingCard({ briefing, onSuggest, compact }) {
  const suggestions = [
    'Summarize my day',
    'Who should I follow up with today?',
    'Draft a warm follow-up SMS for my hottest lead',
    'What are my open deals worth?',
  ];
  return (
    <div className="space-y-3" data-testid="elara-briefing-card">
      <div className="rounded-xl bg-gradient-to-br from-brand/10 via-amber-50 to-emerald-50 dark:from-brand/20 dark:via-amber-900/10 dark:to-emerald-900/10 border border-brand/20 dark:border-brand/40 p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-teal-700 flex items-center justify-center shadow-sm flex-shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 mb-1">Hi, I'm Elara — your Second Brain.</p>
            <p className={`${compact ? 'text-[12px]' : 'text-[13px]'} text-slate-700 dark:text-slate-300 leading-relaxed`}>
              {briefing?.greeting || "I help with leads, deals, drafts, and decisions — all scoped to your tenant. Try one of these to get started:"}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="text-left text-[12px] font-medium px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:border-brand/40 hover:bg-brand/5 dark:hover:bg-brand/10 transition"
            data-testid="elara-suggestion-btn"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
