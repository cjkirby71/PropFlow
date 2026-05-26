import React, { useState } from 'react';
import { toast } from 'sonner';
import { Bot, Plus, Copy, Trash2, AlertTriangle, Check, Key as KeyIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useElaraTokens, useMintElaraToken, useRevokeElaraToken } from '../hooks/useElara';

/**
 * Elara Service Tokens panel — used inside Settings → Integrations.
 *
 * Per-tenant Bearer tokens (format: elara_<id>.<secret>) that external
 * agents/services like the CrewAI Elara swarm on Replit use to call PropFlow's
 * /api/elara/* endpoints. The plaintext token is shown ONCE at mint time.
 */
export default function ElaraServiceTokensCard() {
  const { data, isLoading } = useElaraTokens();
  const mint = useMintElaraToken();
  const revoke = useRevokeElaraToken();
  const [showMint, setShowMint] = useState(false);
  const [name, setName] = useState('');
  const [newToken, setNewToken] = useState('');
  const [copied, setCopied] = useState(false);

  const tokens = data?.tokens || [];

  const handleMint = async () => {
    try {
      const res = await mint.mutateAsync({ name: name || 'Elara Service Token', scopes: ['*'] });
      setNewToken(res?.token || '');
      setName('');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Mint failed');
    }
  };

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const handleRevoke = async (tokenId, tokenName) => {
    if (!window.confirm(`Revoke "${tokenName}"? Any service using this token will lose access immediately.`)) return;
    try {
      await revoke.mutateAsync(tokenId);
      toast.success('Token revoked');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Revoke failed');
    }
  };

  const closeMintDialog = () => {
    setShowMint(false);
    setNewToken('');
    setName('');
    setCopied(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-sm dark:shadow-premium p-5" data-testid="elara-tokens-card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand/15 to-amber-100 dark:from-brand/30 dark:to-amber-900/30 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-brand dark:text-brand-ring" strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Elara Service Tokens
              <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-0">B2B AI</Badge>
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
              Per-tenant bearer tokens so external agents (CrewAI on Replit, n8n, custom scripts) can call <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-[10px] font-mono">/api/elara/*</code> tools and the LLM proxy under your tenant.
            </p>
          </div>
        </div>

        <Dialog open={showMint} onOpenChange={(o) => (o ? setShowMint(true) : closeMintDialog())}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-brand hover:bg-brand-dark text-white h-9 text-[13px] flex-shrink-0" data-testid="elara-mint-token-btn">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Mint token
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="elara-mint-token-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-brand" /> Mint Elara service token
              </DialogTitle>
            </DialogHeader>

            {!newToken ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-[12px] font-semibold mb-1.5 block">Token name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Replit CrewAI, n8n, Cursor agent"
                    className="h-9 text-[13px]"
                    data-testid="elara-token-name-input"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                    A human-friendly label so you remember what each token is for. The token itself will be a long opaque string.
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 rounded-md p-3 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11.5px] text-amber-800 dark:text-amber-200 leading-relaxed">
                    The plaintext token will be shown <strong>only once</strong>. Copy and store it in your service's secret manager immediately. We only keep a hashed version on our side.
                  </p>
                </div>
                <Button
                  onClick={handleMint}
                  disabled={mint.isPending}
                  className="w-full bg-brand hover:bg-brand-dark text-white h-9 text-[13px]"
                  data-testid="elara-token-generate-btn"
                >
                  {mint.isPending ? 'Generating…' : 'Generate token'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/60 rounded-md p-3">
                  <p className="text-[12px] text-emerald-800 dark:text-emerald-300 font-semibold mb-2 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Token created — copy it now, it won't be shown again.
                  </p>
                  <div className="flex items-stretch gap-2">
                    <code
                      className="flex-1 text-[11px] bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded px-2 py-2 font-mono break-all leading-relaxed select-all"
                      data-testid="elara-token-plaintext"
                    >
                      {newToken}
                    </code>
                    <Button size="sm" variant="outline" onClick={copyToken} className="flex-shrink-0 h-auto" data-testid="elara-token-copy-btn">
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/60 rounded-md p-3">
                  <p className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">How to use it (CrewAI / LiteLLM example):</p>
                  <pre className="text-[10.5px] text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">{`# Send Bearer token in Authorization header:
Authorization: Bearer ${newToken.slice(0, 24)}…

# Or use it as an OpenAI-compatible base URL:
OPENAI_API_BASE=${(process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '')}/api/elara/llm/v1
OPENAI_API_KEY=${newToken.slice(0, 16)}…`}</pre>
                </div>
                <Button variant="outline" onClick={closeMintDialog} className="w-full h-9 text-[13px]" data-testid="elara-token-done-btn">
                  I've saved it — done
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Existing tokens list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-slate-100 dark:bg-slate-700/60 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : tokens.length === 0 ? (
        <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-lg py-6 text-center">
          <KeyIcon className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-[12px] text-slate-500 dark:text-slate-400">No Elara service tokens yet.</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Click "Mint token" to create one for your external agent.</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="elara-tokens-list">
          {tokens.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 p-3 border border-slate-200 dark:border-slate-700/60 rounded-lg bg-slate-50/70 dark:bg-slate-900/40"
              data-testid={`elara-token-item-${t.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{t.name || 'Unnamed token'}</p>
                  <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0">Active</Badge>
                  {t.scopes?.length > 0 && (
                    <Badge className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-0">
                      scopes: {t.scopes.join(', ')}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <code className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{t.prefix}</code>
                  <span className="text-[10.5px] text-slate-400 dark:text-slate-500">
                    Created {formatRelative(t.created_at)}
                    {t.last_used_at ? ` · Last used ${formatRelative(t.last_used_at)}` : ' · Never used'}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRevoke(t.id, t.name)}
                disabled={revoke.isPending}
                className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex-shrink-0"
                data-testid={`elara-token-revoke-${t.id}`}
                title="Revoke this token"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRelative(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return '—';
  }
}
