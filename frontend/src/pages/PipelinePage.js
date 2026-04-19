import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  useDeals, useCreateDeal, useUpdateDeal, useDeleteDeal, useContacts, useProperties,
  useLeasePipelineSummary, useCustomStages, useAddCustomStage, useRemoveCustomStage,
} from '../hooks/useApi';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Plus, BarChart3, HelpCircle, Home, CalendarDays, DollarSign, X, Trash2, MoreVertical,
  ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

const PIPELINE_TYPE = 'lease_applications';

// ── Color palette per stage (Tailwind utility strings) ──
const STAGE_COLOR_MAP = {
  'Inquiry':               { bar: 'bg-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/20',    text: 'text-blue-700 dark:text-blue-300',    border: 'border-blue-200 dark:border-blue-800' },
  'Tour Scheduled':        { bar: 'bg-cyan-500',    bg: 'bg-cyan-50 dark:bg-cyan-900/20',    text: 'text-cyan-700 dark:text-cyan-300',    border: 'border-cyan-200 dark:border-cyan-800' },
  'Application Submitted': { bar: 'bg-amber-500',   bg: 'bg-amber-50 dark:bg-amber-900/20',  text: 'text-amber-700 dark:text-amber-300',  border: 'border-amber-200 dark:border-amber-800' },
  'Screening':             { bar: 'bg-orange-500',  bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
  'Approved':              { bar: 'bg-purple-500',  bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  'Lease Signed':          { bar: 'bg-green-500',   bg: 'bg-green-50 dark:bg-green-900/20',  text: 'text-green-700 dark:text-green-300',  border: 'border-green-200 dark:border-green-800' },
  'Move-In':               { bar: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  'Active Tenant':         { bar: 'bg-teal-500',    bg: 'bg-teal-50 dark:bg-teal-900/20',    text: 'text-teal-700 dark:text-teal-300',    border: 'border-teal-200 dark:border-teal-800' },
  'Renewal':               { bar: 'bg-indigo-500',  bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
};
const CUSTOM_COLOR = { bar: 'bg-slate-500', bg: 'bg-slate-50 dark:bg-slate-800/50', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700' };

const fmtMoney = (n) => {
  const v = Number(n || 0);
  if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `$${v.toLocaleString()}`;
};
const fmtMoneyFull = (n) => `$${Number(n || 0).toLocaleString()}`;
const initials = (s) => (s || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
const fmtDate = (d) => d ? new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

export default function PipelinePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [scope, setScope] = useState('me'); // 'me' | 'everyone' | 'current'
  const { data: summary } = useLeasePipelineSummary(PIPELINE_TYPE, scope === 'current' ? 'me' : scope);
  const { data: deals = [] } = useDeals(PIPELINE_TYPE, scope === 'current' ? 'me' : scope);
  const { data: customStagesData } = useCustomStages(PIPELINE_TYPE);
  const { data: contacts = [] } = useContacts();
  const { data: properties = [] } = useProperties();

  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const addStage = useAddCustomStage();
  const removeStage = useRemoveCustomStage();

  const [showNewDeal, setShowNewDeal] = useState(false);
  const [newDealStage, setNewDealStage] = useState('');
  const [showEditDeal, setShowEditDeal] = useState(null);
  const [showAddStage, setShowAddStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  // ── Stage list (builtin + custom) ──
  const stageMeta = useMemo(() => summary?.stages || [], [summary]);
  const stages = useMemo(() => {
    if (stageMeta.length > 0) return stageMeta.map(s => s.name);
    // Fallback
    return [
      'Inquiry', 'Tour Scheduled', 'Application Submitted', 'Screening',
      'Approved', 'Lease Signed', 'Move-In', 'Active Tenant', 'Renewal',
    ];
  }, [stageMeta]);

  // ── Filter deals by scope='current' (hide Active Tenant + Past Tenant) ──
  const visibleDeals = useMemo(() => {
    if (scope === 'current') {
      return deals.filter(d => !['Active Tenant', 'Past Tenant'].includes(d.stage));
    }
    return deals;
  }, [deals, scope]);

  // Group deals by stage (already filtered)
  const dealsByStage = useMemo(() => {
    const groups = {};
    stages.forEach(s => { groups[s] = []; });
    visibleDeals.forEach(d => {
      if (groups[d.stage]) groups[d.stage].push(d);
      else groups[d.stage] = [d];
    });
    return groups;
  }, [visibleDeals, stages]);

  // Build column metadata from summary for headers (count + total)
  const columnMeta = useMemo(() => {
    const metaByName = {};
    stageMeta.forEach(s => { metaByName[s.name] = s; });
    return stages.map(s => {
      const m = metaByName[s];
      const localDeals = dealsByStage[s] || [];
      // If scope='current', recompute from visibleDeals
      const count = scope === 'current' ? localDeals.length : (m?.count ?? localDeals.length);
      const total = scope === 'current'
        ? localDeals.reduce((sum, d) => sum + (d.desired_rent || d.value || 0), 0)
        : (m?.total_value ?? 0);
      return {
        name: s,
        count,
        total,
        color: STAGE_COLOR_MAP[s] || CUSTOM_COLOR,
        is_custom: m?.is_custom ?? !(s in STAGE_COLOR_MAP),
      };
    });
  }, [stages, stageMeta, dealsByStage, scope]);

  // Top summary stat — active pipeline value (exclude Active Tenant + Renewal if "Current")
  const totalPipelineValue = useMemo(
    () => columnMeta.reduce((acc, c) => acc + c.total, 0),
    [columnMeta]
  );
  const totalDeals = useMemo(
    () => columnMeta.reduce((acc, c) => acc + c.count, 0),
    [columnMeta]
  );

  // ── Drag-and-drop (hello-pangea) ──
  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const targetStage = destination.droppableId;
    if (!stages.includes(targetStage)) return;
    const deal = deals.find(d => d.id === draggableId);
    if (!deal || deal.stage === targetStage) return;

    // Optimistic update
    const qKey = ['deals', { pipelineType: PIPELINE_TYPE, scope: scope === 'current' ? 'me' : scope }];
    queryClient.setQueryData(qKey, (old = []) =>
      old.map(d => d.id === draggableId ? { ...d, stage: targetStage } : d)
    );

    try {
      await updateDeal.mutateAsync({ id: draggableId, data: { stage: targetStage } });
      queryClient.invalidateQueries({ queryKey: ['pipeline-summary'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      alert('Failed to move application: ' + (err.response?.data?.detail || err.message));
    }
  };

  // ── Handlers ──
  const openNewDeal = (stage) => {
    setNewDealStage(stage || stages[0]);
    setShowNewDeal(true);
  };

  const handleAddStage = async () => {
    if (!newStageName.trim()) return;
    try {
      await addStage.mutateAsync({ pipeline_type: PIPELINE_TYPE, name: newStageName.trim() });
      setShowAddStage(false);
      setNewStageName('');
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleRemoveStage = async (name) => {
    if (!window.confirm(`Remove stage "${name}"? This only works if no deals are in this stage.`)) return;
    try {
      await removeStage.mutateAsync({ pipeline_type: PIPELINE_TYPE, name });
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 min-h-screen" data-testid="pipeline-page">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900 dark:text-slate-100">Lease Applications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {totalDeals} applications · Total pipeline value <span className="font-semibold text-slate-700 dark:text-slate-200">{fmtMoneyFull(totalPipelineValue)}/mo</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowHelp(true)}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1.5"
            data-testid="help-pipeline-button"
          >
            <HelpCircle className="w-4 h-4" /> How Pipeline works
          </button>
          <Button variant="outline" size="sm" onClick={() => navigate('/analytics')} className="gap-1.5" data-testid="pipeline-reporting-button">
            <BarChart3 className="w-4 h-4" /> Pipeline Reporting
          </Button>
          <Button size="sm" onClick={() => openNewDeal()} className="gap-1.5 bg-slate-900 hover:bg-slate-800 text-white" data-testid="new-application-button">
            <Plus className="w-4 h-4" /> New Application
          </Button>
        </div>
      </div>

      {/* ── Filter pills ── */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">View:</span>
        {[
          { v: 'current', l: 'Current' },
          { v: 'everyone', l: 'Everyone' },
          { v: 'me', l: 'Me' },
        ].map(opt => (
          <button
            key={opt.v}
            onClick={() => setScope(opt.v)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              scope === opt.v
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
            data-testid={`filter-${opt.v}`}
          >
            {opt.l}
          </button>
        ))}
      </div>

      {/* ── Kanban board ── */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4" data-testid="kanban-board">
          {columnMeta.map(col => (
            <KanbanColumn
              key={col.name}
              meta={col}
              deals={dealsByStage[col.name] || []}
              onAdd={() => openNewDeal(col.name)}
              onCardClick={(d) => setShowEditDeal(d)}
              onRemoveStage={col.is_custom ? () => handleRemoveStage(col.name) : null}
              contacts={contacts}
            />
          ))}
          {/* Add a stage column */}
          <div className="flex-shrink-0 w-72 flex items-start pt-2">
            <button
              onClick={() => setShowAddStage(true)}
              className="w-full h-20 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-400 dark:text-slate-500 hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition flex items-center justify-center gap-2 text-sm font-medium"
              data-testid="add-stage-button"
            >
              <Plus className="w-4 h-4" /> Add a stage
            </button>
          </div>
        </div>
      </DragDropContext>

      {/* ══ New Deal Dialog ══ */}
      <Dialog open={showNewDeal} onOpenChange={setShowNewDeal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="new-deal-dialog">
          <DialogHeader>
            <DialogTitle>New Lease Application</DialogTitle>
            <DialogDescription>Create a new application in the {newDealStage} stage.</DialogDescription>
          </DialogHeader>
          <DealForm
            initial={{ stage: newDealStage }}
            stages={stages}
            contacts={contacts}
            properties={properties}
            onSubmit={async (payload) => {
              await createDeal.mutateAsync({ ...payload, pipeline_type: PIPELINE_TYPE });
              setShowNewDeal(false);
              queryClient.invalidateQueries({ queryKey: ['pipeline-summary'] });
            }}
            submitLabel="Create Application"
          />
        </DialogContent>
      </Dialog>

      {/* ══ Edit Deal Dialog ══ */}
      <Dialog open={!!showEditDeal} onOpenChange={(o) => !o && setShowEditDeal(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="edit-deal-dialog">
          <DialogHeader>
            <DialogTitle>Edit Application</DialogTitle>
          </DialogHeader>
          {showEditDeal && (
            <DealForm
              initial={showEditDeal}
              stages={stages}
              contacts={contacts}
              properties={properties}
              onSubmit={async (payload) => {
                await updateDeal.mutateAsync({ id: showEditDeal.id, data: payload });
                setShowEditDeal(null);
                queryClient.invalidateQueries({ queryKey: ['pipeline-summary'] });
              }}
              onDelete={async () => {
                if (!window.confirm('Delete this application?')) return;
                await deleteDeal.mutateAsync(showEditDeal.id);
                setShowEditDeal(null);
                queryClient.invalidateQueries({ queryKey: ['pipeline-summary'] });
              }}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ══ Add Stage Dialog ══ */}
      <Dialog open={showAddStage} onOpenChange={setShowAddStage}>
        <DialogContent className="sm:max-w-sm" data-testid="add-stage-dialog">
          <DialogHeader><DialogTitle>Add a Custom Stage</DialogTitle></DialogHeader>
          <Input
            placeholder="e.g. Renewal Signed, Awaiting Docs"
            autoFocus
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
            data-testid="new-stage-input"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStage(false)}>Cancel</Button>
            <Button onClick={handleAddStage} disabled={!newStageName.trim() || addStage.isPending} data-testid="new-stage-submit">
              {addStage.isPending ? 'Adding…' : 'Add Stage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Help Dialog ══ */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="sm:max-w-md" data-testid="help-dialog">
          <DialogHeader>
            <DialogTitle>How the Lease Pipeline works</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600 dark:text-slate-300 space-y-3">
            <p><strong>Drag cards</strong> between columns as applications progress. Each stage change logs an activity, creates a follow-up task, and can auto-enroll the contact in a drip sequence.</p>
            <p><strong>Columns</strong> are color-coded and show the count of applications + the total pipeline value for that stage. Values come from each application's Desired Rent.</p>
            <p><strong>Filters</strong>: <em>Current</em> hides Active Tenant + Past Tenant. <em>Everyone</em> shows your team's deals. <em>Me</em> shows only yours.</p>
            <p><strong>Custom stages</strong>: click "+ Add a stage" to insert your own. Remove them later if empty.</p>
            <p><strong>Sequence triggers</strong>: create a sequence in /sequences with trigger "deal_stage_changed" and trigger_value set to any stage name. Moving a deal into that stage will auto-enroll the contact.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════ Kanban column ══════════════════════════════
function KanbanColumn({ meta, deals, onAdd, onCardClick, onRemoveStage, contacts }) {
  const color = meta.color;

  return (
    <div className="flex-shrink-0 w-72 flex flex-col" data-testid={`kanban-column-${meta.name.replace(/\s+/g, '-')}`}>
      {/* Column header */}
      <div className={`rounded-t-xl border ${color.border} ${color.bg}`}>
        <div className={`h-1.5 ${color.bar} rounded-t-xl`} />
        <div className="px-3 py-2.5 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold text-sm ${color.text} truncate`}>{meta.name}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${color.text} bg-white/60 dark:bg-black/20`}>
                {meta.count}
              </span>
            </div>
            <div className={`text-xs ${color.text} opacity-80 mt-0.5`}>
              {fmtMoneyFull(meta.total)}<span className="opacity-70">/mo pipeline</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={onAdd}
              className={`w-7 h-7 rounded-md ${color.text} hover:bg-white/70 dark:hover:bg-black/30 flex items-center justify-center transition`}
              title="Add application"
              data-testid={`column-add-${meta.name.replace(/\s+/g, '-')}`}
            >
              <Plus className="w-4 h-4" />
            </button>
            {onRemoveStage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`w-7 h-7 rounded-md ${color.text} hover:bg-white/70 dark:hover:bg-black/30 flex items-center justify-center transition`}>
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onRemoveStage} className="text-red-600 dark:text-red-400">
                    <Trash2 className="w-4 h-4 mr-2" /> Remove Stage
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Column body / drop target */}
      <Droppable droppableId={meta.name}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-[300px] p-2 rounded-b-xl border border-t-0 ${color.border} bg-white/50 dark:bg-slate-800/30 space-y-2 transition ${
              snapshot.isDraggingOver ? 'bg-slate-100 dark:bg-slate-700/40 ring-2 ring-inset ring-slate-400/50' : ''
            }`}
          >
            {deals.length === 0 && !snapshot.isDraggingOver && (
              <div className="h-24 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
                Drop applications here
              </div>
            )}
            {deals.map((d, idx) => (
              <Draggable key={d.id} draggableId={d.id} index={idx}>
                {(prov, snap) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.draggableProps}
                    {...prov.dragHandleProps}
                    onClick={() => !snap.isDragging && onCardClick(d)}
                    style={{ ...prov.draggableProps.style, cursor: snap.isDragging ? 'grabbing' : 'grab' }}
                    data-testid={`deal-card-${d.id}`}
                  >
                    <ApplicationCard deal={d} contacts={contacts} isDragging={snap.isDragging} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// ══════════════════════════════ Application Card (visual) ══════════════════════════════
function ApplicationCard({ deal, contacts, isDragging = false }) {
  const primary = contacts.find(c => c.id === deal.contact_id);
  const coApplicants = (deal.co_applicant_ids || [])
    .map(id => contacts.find(c => c.id === id))
    .filter(Boolean);
  const budgetRange = (deal.budget_min || deal.budget_max)
    ? `${deal.budget_min ? fmtMoney(deal.budget_min) : '?'}–${deal.budget_max ? fmtMoney(deal.budget_max) : '?'}`
    : '';

  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-sm hover:shadow-md transition ${isDragging ? 'shadow-xl ring-2 ring-slate-400' : ''}`}>
      {/* Title / unit address */}
      {(deal.unit_address || deal.unit_number) ? (
        <div className="mb-2">
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Home className="w-3 h-3" />
            {deal.unit_address || '—'}{deal.unit_number && ` · #${deal.unit_number}`}
          </p>
        </div>
      ) : null}
      <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 leading-tight line-clamp-2">{deal.title}</h4>

      {/* Prospect row */}
      {primary && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex -space-x-1.5">
            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold flex items-center justify-center ring-2 ring-white dark:ring-slate-800">
              {initials(primary.name)}
            </div>
            {coApplicants.slice(0, 2).map(c => (
              <div key={c.id} className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold flex items-center justify-center ring-2 ring-white dark:ring-slate-800">
                {initials(c.name)}
              </div>
            ))}
            {coApplicants.length > 2 && (
              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold flex items-center justify-center ring-2 ring-white dark:ring-slate-800">
                +{coApplicants.length - 2}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{primary.name}</p>
        </div>
      )}

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        {(deal.desired_rent > 0) && (
          <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded">
            <DollarSign className="w-3 h-3" />{fmtMoney(deal.desired_rent)}/mo
          </span>
        )}
        {budgetRange && (
          <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded">
            <DollarSign className="w-3 h-3" />Budget {budgetRange}
          </span>
        )}
        {deal.move_in_date && (
          <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded">
            <CalendarDays className="w-3 h-3" />MI {fmtDate(deal.move_in_date)}
          </span>
        )}
      </div>

      {/* Tags */}
      {(deal.tags || []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {(deal.tags || []).slice(0, 3).map(t => (
            <Badge key={t} variant="secondary" className="text-[10px] font-normal py-0 px-1.5 h-5">
              {t}
            </Badge>
          ))}
          {(deal.tags || []).length > 3 && (
            <span className="text-[10px] text-slate-400">+{(deal.tags || []).length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════ Deal Form ══════════════════════════════
const DEFAULT_TAGS = ['Pets OK', 'Good Credit', 'Verified Income', 'First-Time Renter', 'Section 8', 'Co-Signer', 'Roommates'];

function DealForm({ initial = {}, stages = [], contacts = [], properties = [], onSubmit, onDelete, submitLabel = 'Save' }) {
  const [form, setForm] = useState({
    title: initial.title || '',
    stage: initial.stage || (stages[0] || 'Inquiry'),
    contact_id: initial.contact_id || '',
    property_id: initial.property_id || '',
    unit_address: initial.unit_address || '',
    unit_number: initial.unit_number || '',
    desired_rent: initial.desired_rent || 0,
    budget_min: initial.budget_min || 0,
    budget_max: initial.budget_max || 0,
    move_in_date: initial.move_in_date || '',
    tags: initial.tags || [],
    co_applicant_ids: initial.co_applicant_ids || [],
    notes: initial.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const toggleTag = (t) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t],
    }));
  };

  const toggleCoApp = (cid) => {
    setForm(f => ({
      ...f,
      co_applicant_ids: f.co_applicant_ids.includes(cid)
        ? f.co_applicant_ids.filter(x => x !== cid)
        : [...f.co_applicant_ids, cid],
    }));
  };

  const addCustomTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t] }));
    setTagInput('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try { await onSubmit(form); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Application Title *</Label>
        <Input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="e.g. 123 Main St #4B – Sarah Johnson"
          data-testid="deal-title"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Stage</Label>
          <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
            <SelectTrigger data-testid="deal-stage"><SelectValue /></SelectTrigger>
            <SelectContent>
              {stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Primary Contact</Label>
          <Select value={form.contact_id || 'none'} onValueChange={(v) => setForm({ ...form, contact_id: v === 'none' ? '' : v })}>
            <SelectTrigger data-testid="deal-contact"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {contacts.slice(0, 100).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Unit Address</Label>
          <Input value={form.unit_address} onChange={(e) => setForm({ ...form, unit_address: e.target.value })} placeholder="123 Main St" />
        </div>
        <div>
          <Label>Unit #</Label>
          <Input value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} placeholder="4B" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>Desired Rent / mo</Label>
          <Input type="number" value={form.desired_rent} onChange={(e) => setForm({ ...form, desired_rent: parseFloat(e.target.value || 0) })} data-testid="deal-desired-rent" />
        </div>
        <div>
          <Label>Budget Min</Label>
          <Input type="number" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: parseFloat(e.target.value || 0) })} />
        </div>
        <div>
          <Label>Budget Max</Label>
          <Input type="number" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: parseFloat(e.target.value || 0) })} />
        </div>
      </div>
      <div>
        <Label>Move-In Date</Label>
        <Input type="date" value={form.move_in_date} onChange={(e) => setForm({ ...form, move_in_date: e.target.value })} />
      </div>

      {/* Tags */}
      <div>
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {DEFAULT_TAGS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTag(t)}
              className={`px-2 py-0.5 rounded-full text-xs font-medium border transition ${
                form.tags.includes(t)
                  ? 'bg-slate-900 border-slate-900 text-white dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
            placeholder="+ Custom tag"
            className="h-8 text-sm"
          />
          <Button type="button" size="sm" variant="outline" onClick={addCustomTag}>Add</Button>
        </div>
        {form.tags.filter(t => !DEFAULT_TAGS.includes(t)).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {form.tags.filter(t => !DEFAULT_TAGS.includes(t)).map(t => (
              <Badge key={t} variant="secondary" className="gap-1 pr-1">
                {t}
                <button type="button" onClick={() => toggleTag(t)} className="ml-0.5 w-4 h-4 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Co-applicants */}
      {contacts.length > 0 && (
        <div>
          <Label>Co-Applicants (optional)</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="w-full justify-between mt-1">
                <span className="text-slate-500">{form.co_applicant_ids.length ? `${form.co_applicant_ids.length} selected` : 'Pick contacts…'}</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-[240px] overflow-y-auto w-[320px]">
              {contacts.filter(c => c.id !== form.contact_id).slice(0, 50).map(c => (
                <DropdownMenuItem
                  key={c.id}
                  onSelect={(e) => { e.preventDefault(); toggleCoApp(c.id); }}
                >
                  <input type="checkbox" readOnly checked={form.co_applicant_ids.includes(c.id)} className="mr-2" />
                  {c.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div>
        <Label>Notes</Label>
        <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      <DialogFooter className="gap-2">
        {onDelete && (
          <Button type="button" variant="outline" onClick={onDelete} className="text-red-600 mr-auto">
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </Button>
        )}
        <Button type="submit" disabled={busy || !form.title.trim()} data-testid="deal-submit">
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
