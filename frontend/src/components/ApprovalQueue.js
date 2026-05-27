import React, { useState } from 'react';
import { toast } from 'sonner';
import { Check, X, CheckCheck, Inbox, Loader2, Clock, Sparkles, AlertTriangle, FileText, MessageSquare, ListTodo, UserCog, Mail, Briefcase } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useElaraApprovals, useApproveElaraAction, useRejectElaraAction } from '../hooks/useElara';

const KIND_META = {
  send_sms: { icon: MessageSquare, label: 'Send SMS', color: 'text-brand bg-brand/10 dark:bg-brand/20' },
  send_email: { icon: Mail, label: 'Send email', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300' },
  create_task: { icon: ListTodo, label: 'Create task', color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300' },
  add_note: { icon: FileText, label: 'Add note', color: 'text-slate-600 bg-slate-100 dark:bg-slate-700 dark:text-slate-300' },
  update_contact: { icon: UserCog, label: 'Update contact', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300' },
  create_deal: { icon: Briefcase, label: 'Create deal', color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300' },
  generic: { icon: Sparkles, label: 'Action', color: 'text-slate-600 bg-slate-100 dark:bg-slate-700 dark:text-slate-300' },
};

const STATUS_META = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  executed: { label: 'Executed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: 'Rejected', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  failed: { label: 'Failed', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
};

/**
 * Approval Queue — shows pending/recent actions Elara has drafted for the user.
 * Per-row Approve / Reject buttons.
 */
export default function ApprovalQueue({ variant = 'full' }) {
  const [statusTab, setStatusTab] = useState('pending');
  const { data, isLoading } = useElaraApprovals({ status: statusTab, limit: 50 });
  const approve = useApproveElaraAction();
  const reject = useRejectElaraAction();
  const [busyIds, setBusyIds] = useState(new Set());
  const items = data?.items || [];

  const handleAction = async (id, isApprove) => {
    setBusyIds((s) => new Set(s).add(id));
    try {
      const result = isApprove ? await approve.mutateAsync(id) : await reject.mutateAsync(id);
      if (isApprove) {
        const executed = result?.status === 'executed';
        if (executed) toast.success(`Approved & executed: ${result?.summary || ''}`.trim());
        else toast.error(`Approved but execution failed: ${result?.execution_result?.error || 'see logs'}`);
      } else {
        toast.success('Action rejected');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || (isApprove ? 'Approve failed' : 'Reject failed'));
    } finally {
      setBusyIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  const compact = variant === 'compact';

  return (
    <div className={compact ? '' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4'} data-testid="approval-queue">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Approval queue
          </h3>
          {!compact && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Actions Elara wants to take — approve to execute, reject to discard.</p>
          )}
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 rounded-md p-0.5 flex-shrink-0">
          {[
            { id: 'pending', label: 'Pending' },
            { id: 'executed', label: 'Done' },
            { id: 'rejected', label: 'Rejected' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setStatusTab(t.id)}
              className={`text-[10.5px] font-semibold px-2 py-1 rounded transition ${
                statusTab === t.id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              data-testid={`approval-tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (<div key={i} className="h-20 bg-slate-100 dark:bg-slate-700/60 rounded-lg animate-pulse" />))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8" data-testid="approval-queue-empty">
          {statusTab === 'pending' ? (
            <>
              <CheckCheck className="w-8 h-8 text-emerald-400 dark:text-emerald-600 mx-auto mb-2" />
              <p className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">No pending approvals</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">When Elara drafts an action for review, it'll appear here.</p>
            </>
          ) : (
            <>
              <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-[12px] text-slate-500 dark:text-slate-400">No {statusTab} actions.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2" data-testid="approval-queue-list">
          {items.map((a) => {
            const meta = KIND_META[a.kind] || KIND_META.generic;
            const Icon = meta.icon;
            const statusMeta = STATUS_META[a.status] || STATUS_META.pending;
            const busy = busyIds.has(a.id);
            return (
              <div
                key={a.id}
                className="border border-slate-200 dark:border-slate-700/60 rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/40 hover:border-brand/30 transition"
                data-testid={`approval-item-${a.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">{meta.label}</span>
                      <Badge className={`text-[9.5px] px-1.5 py-0 ${statusMeta.color} border-0`} data-testid={`approval-status-${a.id}`}>{statusMeta.label}</Badge>
                      {a.target_contact_name && <span className="text-[10.5px] text-slate-500 dark:text-slate-400">· {a.target_contact_name}</span>}
                    </div>
                    <p className="text-[12.5px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">{a.summary}</p>
                    {a.rationale && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic flex items-start gap-1">
                        <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" /> {a.rationale}
                      </p>
                    )}
                    {a.execution_result?.error && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 flex items-start gap-1">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {a.execution_result.error}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> {formatRelative(a.created_at)}
                      </span>
                      {a.decided_at && a.status !== 'pending' && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">· decided {formatRelative(a.decided_at)}</span>
                      )}
                    </div>
                  </div>
                  {a.status === 'pending' && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleAction(a.id, true)}
                        disabled={busy}
                        className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px]"
                        data-testid={`approval-approve-${a.id}`}
                      >
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-0.5" /> Approve</>}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(a.id, false)}
                        disabled={busy}
                        className="h-8 px-2 text-rose-600 dark:text-rose-300 border-rose-300 dark:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-[11px]"
                        data-testid={`approval-reject-${a.id}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatRelative(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch { return ''; }
}
