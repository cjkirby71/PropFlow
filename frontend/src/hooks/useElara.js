import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

// ═══════════════════════════════════════════════════════════════════════════
// Elara API hooks (Phase 2) — conversations, messages, briefing, service tokens
// Plus a low-level streamElaraChat() helper that consumes the SSE response
// from POST /api/elara/chat. Uses fetch + ReadableStream since axios can't
// stream incrementally in browsers.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Conversations ─────────────────────────────────────────────────────────
export function useElaraConversations(archived = false) {
  return useQuery({
    queryKey: ['elara', 'conversations', { archived }],
    queryFn: async () =>
      (await api.get('/elara/conversations', { params: { archived, limit: 100 } })).data,
    staleTime: 15 * 1000,
  });
}

export function useElaraConversation(conversationId) {
  return useQuery({
    queryKey: ['elara', 'conversations', conversationId],
    queryFn: async () => (await api.get(`/elara/conversations/${conversationId}`)).data,
    enabled: !!conversationId,
    staleTime: 5 * 1000,
  });
}

export function useUpdateElaraConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => (await api.patch(`/elara/conversations/${id}`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['elara', 'conversations'] });
    },
  });
}

export function useDeleteElaraConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/elara/conversations/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['elara', 'conversations'] });
    },
  });
}

// ─── Briefing (welcome card) ────────────────────────────────────────────────
export function useElaraBriefing(enabled = true) {
  return useQuery({
    queryKey: ['elara', 'briefing'],
    queryFn: async () => (await api.get('/elara/briefing')).data,
    enabled,
    staleTime: 60 * 1000,
  });
}

// ─── Service Tokens (for Replit / CrewAI external integration) ──────────────
export function useElaraTokens() {
  return useQuery({
    queryKey: ['elara', 'tokens'],
    queryFn: async () => (await api.get('/elara/tokens')).data,
    staleTime: 30 * 1000,
  });
}

export function useMintElaraToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, scopes }) =>
      (await api.post('/elara/tokens', { name, scopes: scopes || ['*'] })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['elara', 'tokens'] });
    },
  });
}

export function useRevokeElaraToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tokenId) => (await api.delete(`/elara/tokens/${tokenId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['elara', 'tokens'] });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// streamElaraChat — low-level SSE consumer for POST /api/elara/chat
// Calls onMeta with { conversation_id, user_msg_id, assistant_msg_id, model }
// once, then onChunk with each text delta, then onDone(fullText) at the end.
// onError is called if the request fails or the stream emits an error frame.
// Returns an AbortController so the caller can cancel mid-stream.
// ═══════════════════════════════════════════════════════════════════════════
export function streamElaraChat({ conversationId, message, context, model, onMeta, onChunk, onDone, onError }) {
  const abort = new AbortController();
  const apiUrl = process.env.REACT_APP_BACKEND_URL;
  if (!apiUrl) {
    onError?.(new Error('REACT_APP_BACKEND_URL not configured'));
    return abort;
  }

  let fullText = '';

  (async () => {
    try {
      const res = await fetch(`${apiUrl}/api/elara/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          conversation_id: conversationId || undefined,
          message,
          context: context || undefined,
          model: model || 'gpt-5.2',
          stream: true,
        }),
        signal: abort.signal,
      });

      if (!res.ok) {
        let detail = '';
        try {
          detail = (await res.json())?.detail || '';
        } catch {
          detail = await res.text().catch(() => '');
        }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error('No response body for streaming');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by \n\n
        let nlIdx;
        while ((nlIdx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, nlIdx);
          buffer = buffer.slice(nlIdx + 2);
          if (!frame.startsWith('data:')) continue;
          const payload = frame.slice(5).trim();
          if (payload === '[DONE]') {
            onDone?.(fullText);
            return;
          }
          try {
            const obj = JSON.parse(payload);
            // Metadata frame from our backend
            if (obj && obj._propflow) {
              onMeta?.(obj._propflow);
              continue;
            }
            // Error frame
            if (obj && obj.error) {
              throw new Error(obj.error.message || 'Upstream LLM error');
            }
            // OpenAI ChatCompletion chunk
            const delta = obj?.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              onChunk?.(delta, fullText);
            }
          } catch (parseErr) {
            // Re-raise as a stream error
            throw parseErr;
          }
        }
      }
      // Stream ended without [DONE] - still call onDone
      onDone?.(fullText);
    } catch (err) {
      if (err.name === 'AbortError') return;
      onError?.(err);
    }
  })();

  return abort;
}
