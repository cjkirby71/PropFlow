import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus, CheckCircle2, Clock, AlertTriangle, CalendarDays, Trash2, ChevronRight,
  MoreHorizontal, HelpCircle, SlidersHorizontal, Users as UsersIcon, CheckCheck,
  Sparkles, Home, Wrench, FilePen, PhoneCall, CalendarClock, KeyRound, Send,
  UserPlus, Zap, Tag, X as XIcon, Building2, DoorOpen,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from '../components/ui/dropdown-menu';
import {
  useContacts, useDeals, useProperties, useUpdateTask, useDeleteTask,
  useTaskCounts, useTaskBucket, useCompleteAndLog, useTasksBulk, useSeedTasksDemo,
  useSequences,
} from '../hooks/useApi';
import api from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────────────────────────
// Task type catalog (leasing-centric)
// ─────────────────────────────────────────────────────────────────────────────
const TASK_TYPES = [
  { id: 'tour_followup',       label: 'Tour Follow-Up',       icon: CalendarCheck,   accent: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800/60' },
  { id: 'renewal_offer',       label: 'Renewal Offer',        icon: FilePen,         accent: 'bg-brand/10 text-brand border-brand/30 dark:bg-brand/20 dark:text-brand-ring dark:border-brand/50' },
  { id: 'maintenance_request', label: 'Maintenance',          icon: Wrench,          accent: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/60' },
  { id: 'application_reminder',label: 'Application',          icon: FilePen,         accent: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800/60' },
  { id: 'showing_prep',        label: 'Showing Prep',         icon: KeyRound,        accent: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800/60' },
  { id: 'listing_outreach',    label: 'Listing Outreach',     icon: Send,            accent: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800/60' },
  { id: 'lease_signing',       label: 'Lease Signing',        icon: FilePen,         accent: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/60' },
  { id: 'move_in',             label: 'Move-In',              icon: DoorOpen,        accent: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800/60' },
  { id: 'rent_reminder',       label: 'Rent Reminder',        icon: CalendarClock,   accent: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/60' },
  { id: 'other',               label: 'Other',                icon: Tag,             accent: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600' },
];

function CalendarCheck(props) {
  // small custom icon fallback — reuses CalendarDays visual
  return <CalendarDays {...props} />;
}

const FILTER_PRESETS = [
  { id: 'todays_tours',    label: "Today's Tours",    types: ['tour_followup', 'showing_prep'] },
  { id: 'renewal_tasks',   label: 'Renewal Tasks',    types: ['renewal_offer'] },
  { id: 'maintenance',     label: 'Maintenance',      types: ['maintenance_request'] },
  { id: 'applications',    label: 'Applications',     types: ['application_reminder', 'lease_signing'] },
  { id: 'outreach',        label: 'Listing Outreach', types: ['listing_outreach'] },
  { id: 'rent_collection', label: 'Rent Collection',  types: ['rent_reminder'] },
];

const TABS = [
  { id: 'today',   label: "Today's Tasks", icon: Clock,          countKey: 'today' },
  { id: 'overdue', label: 'Overdue',        icon: AlertTriangle,  countKey: 'overdue' },
  { id: 'future',  label: 'Future',         icon: CalendarDays,   countKey: 'future' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() || '').join('') || '?';

function formatDueTime(iso, allDay) {
  if (!iso) return 'No due date';
  if (allDay) return 'All day';
  try {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const delta = d.getTime() - now.getTime();
    if (Math.abs(delta) < 7 * 86400_000) {
      return d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function findTaskTypeMeta(id) {
  return TASK_TYPES.find(t => t.id === id) || TASK_TYPES[TASK_TYPES.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Card
// ─────────────────────────────────────────────────────────────────────────────
function TaskCard({ task, contact, property, selected, onToggleSelect, onOpenComplete, onDelete, onOpenEdit, navigate }) {
  const meta = findTaskTypeMeta(task.task_type);
  const Icon = meta.icon;
  const overdue = !task.completed && task.due_date && new Date(task.due_date) < new Date() &&
    new Date(task.due_date).toDateString() !== new Date().toDateString();
  return (
    <div
      className={`group relative bg-white dark:bg-slate-800 border rounded-xl p-4 shadow-sm hover:shadow-premium transition-all ${
        selected ? 'border-brand ring-2 ring-brand/20' : 'border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
      } ${task.completed ? 'opacity-60' : ''}`}
      data-testid={`task-card-${task.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Select checkbox */}
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(task.id)}
          className="mt-1 shrink-0"
          data-testid={`task-select-${task.id}`}
        />

        {/* Avatar */}
        {contact ? (
          <button
            onClick={() => navigate(`/contacts/${contact.id}`)}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-brand/25 to-brand/10 dark:from-brand/30 dark:to-brand/20 text-brand dark:text-brand-ring font-bold text-[13px] flex items-center justify-center shrink-0 hover:ring-2 hover:ring-brand/40 transition"
            data-testid={`task-avatar-${task.id}`}
          >
            {initials(contact.name)}
          </button>
        ) : (
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 font-bold text-[13px] flex items-center justify-center shrink-0">
            <Tag className="w-4 h-4" />
          </div>
        )}

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                {contact ? contact.name : 'No contact linked'}
                {task.assigned_to && <span className="ml-2 text-[11px] font-medium text-slate-400">· Me</span>}
              </p>
              <p className={`text-[13px] mt-0.5 ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {task.title}
              </p>
              {task.description && (
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{task.description}</p>
              )}
            </div>

            {/* Due time pill */}
            <div className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold ${
              overdue ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300' :
              task.completed ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' :
              'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
            }`} data-testid={`task-due-${task.id}`}>
              <Clock className="w-3 h-3" />
              {task.completed ? 'Done' : formatDueTime(task.due_date, task.all_day)}
            </div>
          </div>

          {/* Meta chips row */}
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${meta.accent}`} data-testid={`task-type-${task.id}`}>
              <Icon className="w-3 h-3" strokeWidth={2.5} /> {meta.label}
            </span>
            {property && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50">
                <Building2 className="w-3 h-3" /> {property.name || property.address?.slice(0, 26) || 'Unit'}
              </span>
            )}
            {task.priority === 'high' && !task.completed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/60">
                <AlertTriangle className="w-3 h-3" /> High priority
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action row */}
      {!task.completed && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
          <Button
            size="sm"
            onClick={() => onOpenComplete(task)}
            className="h-8 text-[12px] bg-brand hover:bg-brand-dark text-white gap-1.5"
            data-testid={`task-complete-log-${task.id}`}
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark Complete + Log Activity
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenEdit(task)}
            className="h-8 text-[12px]"
            data-testid={`task-edit-${task.id}`}
          >
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 ml-auto" data-testid={`task-menu-${task.id}`}>
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {contact && (
                <DropdownMenuItem onClick={() => navigate(`/contacts/${contact.id}`)}>
                  Open contact
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-rose-600 focus:text-rose-700">
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Complete + Log dialog
// ─────────────────────────────────────────────────────────────────────────────
function CompleteLogDialog({ task, open, onClose }) {
  const [activityType, setActivityType] = useState('note');
  const [note, setNote] = useState('');
  const complete = useCompleteAndLog();

  useEffect(() => { if (!open) { setNote(''); setActivityType('note'); } }, [open]);

  if (!task) return null;
  const handleSubmit = async () => {
    try {
      await complete.mutateAsync({ id: task.id, activity_type: activityType, note });
      toast.success('Task completed & activity logged');
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not complete task');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="task-complete-dialog">
        <DialogHeader>
          <DialogTitle>Mark complete + log activity</DialogTitle>
          <DialogDescription className="text-[12px]">
            {task.title} — this will mark the task as complete and add an activity to the linked contact.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">Activity type</Label>
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger className="h-9 text-[13px]" data-testid="complete-activity-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="note">Note</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">Note (optional)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              className="text-[13px]"
              placeholder="What happened? (e.g. Left voicemail, booked tour for Sat 2pm...)"
              data-testid="complete-note"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-9 text-[13px]">Cancel</Button>
          <Button onClick={handleSubmit} disabled={complete.isPending} className="h-9 text-[13px] bg-brand hover:bg-brand-dark text-white" data-testid="complete-submit">
            <CheckCheck className="w-4 h-4 mr-1.5" /> {complete.isPending ? 'Completing...' : 'Complete & Log'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Form (create / edit)
// ─────────────────────────────────────────────────────────────────────────────
function TaskForm({ initial, contacts, properties, onSubmit }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    due_date: initial?.due_date ? new Date(initial.due_date).toISOString().slice(0, 16) : '',
    contact_id: initial?.contact_id || '',
    property_id: initial?.property_id || '',
    task_type: initial?.task_type || 'other',
    priority: initial?.priority || 'medium',
    all_day: initial?.all_day || false,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form };
      // Convert datetime-local input to ISO
      if (payload.due_date) payload.due_date = new Date(payload.due_date).toISOString();
      if (payload.contact_id === 'none') payload.contact_id = '';
      if (payload.property_id === 'none') payload.property_id = '';
      await onSubmit(payload);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label className="text-[12px] font-semibold mb-1.5 block">Title *</Label>
        <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className="h-9 text-[13px]" data-testid="task-form-title" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[12px] font-semibold mb-1.5 block">Task type</Label>
          <Select value={form.task_type} onValueChange={v => setForm({ ...form, task_type: v })}>
            <SelectTrigger className="h-9 text-[13px]" data-testid="task-form-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[12px] font-semibold mb-1.5 block">Priority</Label>
          <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
            <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[12px] font-semibold mb-1.5 block">Due date & time</Label>
          <Input type="datetime-local" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="h-9 text-[13px]" data-testid="task-form-due" />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-700 dark:text-slate-300 select-none">
            <Checkbox checked={form.all_day} onCheckedChange={(v) => setForm({ ...form, all_day: !!v })} /> All day
          </label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[12px] font-semibold mb-1.5 block">Contact</Label>
          <Select value={form.contact_id || 'none'} onValueChange={v => setForm({ ...form, contact_id: v })}>
            <SelectTrigger className="h-9 text-[13px]"><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[12px] font-semibold mb-1.5 block">Unit / Property</Label>
          <Select value={form.property_id || 'none'} onValueChange={v => setForm({ ...form, property_id: v })}>
            <SelectTrigger className="h-9 text-[13px]"><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name || p.address}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-[12px] font-semibold mb-1.5 block">Description</Label>
        <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="text-[13px]" />
      </div>
      <Button type="submit" disabled={submitting} className="w-full bg-brand hover:bg-brand-dark text-white h-9 text-[13px]" data-testid="task-form-submit">
        {submitting ? 'Saving...' : (initial ? 'Save changes' : 'Create task')}
      </Button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Reschedule Dialog
// ─────────────────────────────────────────────────────────────────────────────
function BulkRescheduleDialog({ open, onClose, onSubmit }) {
  const [dt, setDt] = useState('');
  useEffect(() => { if (!open) setDt(''); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="bulk-reschedule-dialog">
        <DialogHeader><DialogTitle>Reschedule tasks</DialogTitle></DialogHeader>
        <Label className="text-[12px] font-semibold block mb-1.5">New due date & time</Label>
        <Input type="datetime-local" value={dt} onChange={e => setDt(e.target.value)} className="h-9 text-[13px]" data-testid="bulk-reschedule-input" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-9 text-[13px]">Cancel</Button>
          <Button
            disabled={!dt}
            onClick={() => onSubmit(new Date(dt).toISOString())}
            className="h-9 text-[13px] bg-brand hover:bg-brand-dark text-white"
            data-testid="bulk-reschedule-submit"
          >Reschedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Sequence Dialog
// ─────────────────────────────────────────────────────────────────────────────
function BulkSequenceDialog({ open, onClose, onSubmit }) {
  const { data: sequences = [] } = useSequences();
  const [sid, setSid] = useState('');
  useEffect(() => { if (!open) setSid(''); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="bulk-sequence-dialog">
        <DialogHeader><DialogTitle>Add to sequence</DialogTitle>
          <DialogDescription className="text-[12px]">Enrolls the linked contact of each selected task into the chosen drip sequence.</DialogDescription>
        </DialogHeader>
        <Select value={sid} onValueChange={setSid}>
          <SelectTrigger className="h-9 text-[13px]" data-testid="bulk-sequence-select"><SelectValue placeholder="Pick a sequence" /></SelectTrigger>
          <SelectContent>
            {sequences.length === 0 && <div className="p-3 text-[12px] text-slate-500">No sequences yet.</div>}
            {sequences.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-9 text-[13px]">Cancel</Button>
          <Button disabled={!sid} onClick={() => onSubmit(sid)} className="h-9 text-[13px] bg-brand hover:bg-brand-dark text-white" data-testid="bulk-sequence-submit">Enroll</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// How Tasks Work dialog
// ─────────────────────────────────────────────────────────────────────────────
function HowTasksWorkDialog({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="how-tasks-work-dialog">
        <DialogHeader>
          <DialogTitle>How tasks work in PropFlow</DialogTitle>
          <DialogDescription className="text-[12px]">A quick tour of the leasing-focused task workflow.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-[13px] text-slate-700 dark:text-slate-300">
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 mt-0.5 text-brand" />
            <p><strong>Today / Overdue / Future.</strong> Tabs reflect live counts from your pipeline — overdue tasks surface at the top of the queue so nothing slips.</p>
          </div>
          <div className="flex items-start gap-3">
            <Tag className="w-4 h-4 mt-0.5 text-brand" />
            <p><strong>Task types.</strong> Tour Follow-Up, Renewal Offer, Maintenance, Application Reminder, Listing Outreach, Rent Reminder… each with its own badge so you can triage at a glance.</p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCheck className="w-4 h-4 mt-0.5 text-brand" />
            <p><strong>Mark Complete + Log Activity.</strong> One click marks the task done <em>and</em> drops a call/email/SMS/note activity on the linked contact's timeline.</p>
          </div>
          <div className="flex items-start gap-3">
            <Zap className="w-4 h-4 mt-0.5 text-brand" />
            <p><strong>Bulk actions.</strong> Select tasks to reschedule, reassign, mark complete, or enroll their contacts into a sequence.</p>
          </div>
          <div className="flex items-start gap-3">
            <SlidersHorizontal className="w-4 h-4 mt-0.5 text-brand" />
            <p><strong>Filters & assignee.</strong> Toggle leasing presets (Today's Tours, Renewals, Maintenance…) and scope by Me / Team / Everyone.</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} className="bg-brand hover:bg-brand-dark text-white h-9 text-[13px]">Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [tab, setTab] = useState('today');
  const [assignee, setAssignee] = useState('me');
  const [preset, setPreset] = useState(''); // filter preset id
  const [typesFilter, setTypesFilter] = useState([]); // explicit task_type filter (for preset)
  const [selected, setSelected] = useState(new Set());
  const [completeDlg, setCompleteDlg] = useState(null);
  const [editDlg, setEditDlg] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showBulkResched, setShowBulkResched] = useState(false);
  const [showBulkSequence, setShowBulkSequence] = useState(false);

  const typeFilterParam = typesFilter.length === 1 ? typesFilter[0] : '';
  const { data: counts } = useTaskCounts({ assignee, taskType: typeFilterParam });
  const { data: tasks = [], isLoading } = useTaskBucket({ bucket: tab, assignee, taskType: typeFilterParam });
  const { data: contacts = [] } = useContacts();
  const { data: properties = [] } = useProperties();
  const { data: deals = [] } = useDeals();
  const seedDemo = useSeedTasksDemo();
  const bulk = useTasksBulk();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // Filter in-memory for multi-type presets
  const filteredTasks = useMemo(() => {
    if (typesFilter.length <= 1) return tasks;
    return tasks.filter(t => typesFilter.includes(t.task_type));
  }, [tasks, typesFilter]);

  const contactsMap = useMemo(() => {
    const m = {};
    contacts.forEach(c => { m[c.id] = c; });
    return m;
  }, [contacts]);
  const propsMap = useMemo(() => {
    const m = {};
    properties.forEach(p => { m[p.id] = p; });
    return m;
  }, [properties]);

  // Clear selection when tab / filter changes
  useEffect(() => { setSelected(new Set()); }, [tab, assignee, preset, typesFilter]);

  const toggleSelect = (id) => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const selectAll = () => setSelected(new Set(filteredTasks.map(t => t.id)));
  const clearSelection = () => setSelected(new Set());

  const handleBulkComplete = async () => {
    try {
      const res = await bulk.mutateAsync({ task_ids: Array.from(selected), action: 'complete' });
      toast.success(`Completed ${res.data.affected} task${res.data.affected === 1 ? '' : 's'}`);
      clearSelection();
    } catch (e) {
      toast.error('Bulk complete failed');
    }
  };
  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} task${selected.size === 1 ? '' : 's'}?`)) return;
    try {
      const res = await bulk.mutateAsync({ task_ids: Array.from(selected), action: 'delete' });
      toast.success(`Deleted ${res.data.affected} task${res.data.affected === 1 ? '' : 's'}`);
      clearSelection();
    } catch (e) { toast.error('Bulk delete failed'); }
  };
  const handleBulkReschedule = async (iso) => {
    try {
      const res = await bulk.mutateAsync({ task_ids: Array.from(selected), action: 'reschedule', due_date: iso });
      toast.success(`Rescheduled ${res.data.affected} task${res.data.affected === 1 ? '' : 's'}`);
      setShowBulkResched(false);
      clearSelection();
    } catch (e) { toast.error('Bulk reschedule failed'); }
  };
  const handleBulkSequence = async (sid) => {
    try {
      const res = await bulk.mutateAsync({ task_ids: Array.from(selected), action: 'add_to_sequence', sequence_id: sid });
      toast.success(`Enrolled ${res.data.affected} contact${res.data.affected === 1 ? '' : 's'}`);
      setShowBulkSequence(false);
      clearSelection();
    } catch (e) { toast.error('Add to sequence failed'); }
  };
  const handleBulkAssignMe = async () => {
    try {
      const res = await bulk.mutateAsync({ task_ids: Array.from(selected), action: 'assign', assigned_to: 'me' });
      toast.success(`Assigned ${res.data.affected} task${res.data.affected === 1 ? '' : 's'} to you`);
      clearSelection();
    } catch (e) { toast.error('Bulk assign failed'); }
  };

  const applyPreset = (id) => {
    if (preset === id) { setPreset(''); setTypesFilter([]); return; }
    setPreset(id);
    const p = FILTER_PRESETS.find(x => x.id === id);
    setTypesFilter(p?.types || []);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['task-counts'] });
    qc.invalidateQueries({ queryKey: ['task-bucket'] });
  };

  const handleCreate = async (payload) => {
    await api.post('/tasks', payload);
    setShowCreate(false);
    invalidate();
    toast.success('Task created');
  };
  const handleEdit = async (payload) => {
    if (!editDlg) return;
    await updateTask.mutateAsync({ id: editDlg.id, data: payload });
    setEditDlg(null);
    invalidate();
    toast.success('Task updated');
  };
  const handleDelete = async (id) => {
    await deleteTask.mutateAsync(id);
    invalidate();
    toast.success('Task deleted');
  };

  const allSelected = filteredTasks.length > 0 && filteredTasks.every(t => selected.has(t.id));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto space-y-5" data-testid="tasks-page">
      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Tasks</h1>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
            {(counts?.today ?? 0)} due today · {(counts?.overdue ?? 0)} overdue · {(counts?.future ?? 0)} upcoming
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" className="h-9 text-[12px]" onClick={() => setShowHelp(true)} data-testid="how-tasks-work">
            <HelpCircle className="w-3.5 h-3.5 mr-1.5" /> How tasks work
          </Button>

          {/* Filters dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-[12px]" data-testid="tasks-filter-button">
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Filters
                {preset && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-brand" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Leasing presets</DropdownMenuLabel>
              {FILTER_PRESETS.map(p => (
                <DropdownMenuCheckboxItem
                  key={p.id}
                  checked={preset === p.id}
                  onCheckedChange={() => applyPreset(p.id)}
                  data-testid={`filter-preset-${p.id}`}
                >
                  {p.label}
                </DropdownMenuCheckboxItem>
              ))}
              {preset && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setPreset(''); setTypesFilter([]); }}>
                    <XIcon className="w-3.5 h-3.5 mr-2" /> Clear filters
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Assignee filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-[12px]" data-testid="tasks-assignee-button">
                <UsersIcon className="w-3.5 h-3.5 mr-1.5" />
                {assignee === 'me' ? 'Me' : assignee === 'team' ? 'Team' : 'Everyone'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuCheckboxItem checked={assignee === 'me'} onCheckedChange={() => setAssignee('me')} data-testid="assignee-me">Me</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={assignee === 'team'} onCheckedChange={() => setAssignee('team')} data-testid="assignee-team">Team</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={assignee === 'everyone'} onCheckedChange={() => setAssignee('everyone')} data-testid="assignee-everyone">Everyone</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 text-[13px] bg-brand hover:bg-brand-dark text-white" data-testid="add-task-button">
                <Plus className="w-4 h-4 mr-1.5" /> Add Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" data-testid="add-task-dialog">
              <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
              <TaskForm contacts={contacts} properties={properties} onSubmit={handleCreate} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700/60 -mb-px overflow-x-auto" data-testid="tasks-tabs">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          const count = counts?.[t.countKey] ?? 0;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 whitespace-nowrap transition ${
                isActive
                  ? 'border-brand text-brand dark:text-brand-ring'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              data-testid={`tasks-tab-${t.id}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              <span className={`min-w-[20px] px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                isActive ? 'bg-brand text-white' : t.id === 'overdue' && count > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 bg-brand/10 dark:bg-brand/20 border border-brand/30 rounded-lg px-3 py-2 flex-wrap sticky top-[68px] z-20 backdrop-blur-sm" data-testid="tasks-bulk-bar">
          <span className="text-[12px] font-semibold text-brand dark:text-brand-ring">
            {selected.size} selected
          </span>
          <Button size="sm" variant="outline" onClick={selectAll} className="h-8 text-[12px]" data-testid="bulk-select-all">Select all visible</Button>
          <div className="w-px h-5 bg-slate-300 dark:bg-slate-600" />
          <Button size="sm" variant="outline" onClick={() => setShowBulkResched(true)} className="h-8 text-[12px]" data-testid="bulk-reschedule">
            <CalendarDays className="w-3.5 h-3.5 mr-1" /> Reschedule
          </Button>
          <Button size="sm" variant="outline" onClick={handleBulkAssignMe} className="h-8 text-[12px]" data-testid="bulk-assign">
            <UserPlus className="w-3.5 h-3.5 mr-1" /> Assign to me
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowBulkSequence(true)} className="h-8 text-[12px]" data-testid="bulk-sequence">
            <Zap className="w-3.5 h-3.5 mr-1" /> Add to Sequence
          </Button>
          <Button size="sm" onClick={handleBulkComplete} className="h-8 text-[12px] bg-brand hover:bg-brand-dark text-white" data-testid="bulk-complete">
            <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark Complete
          </Button>
          <Button size="sm" variant="ghost" onClick={handleBulkDelete} className="h-8 text-[12px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20" data-testid="bulk-delete">
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection} className="h-8 text-[12px] ml-auto" data-testid="bulk-clear">
            <XIcon className="w-3.5 h-3.5 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Active preset chip */}
      {preset && (
        <div className="flex items-center gap-2">
          <Badge className="bg-brand/10 text-brand border border-brand/30 text-[11px] h-6">
            Filter: {FILTER_PRESETS.find(p => p.id === preset)?.label}
            <button onClick={() => { setPreset(''); setTypesFilter([]); }} className="ml-1.5"><XIcon className="w-3 h-3" /></button>
          </Badge>
        </div>
      )}

      {/* LIST */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-100 dark:bg-slate-700/60 rounded-xl animate-pulse" />)}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-12 text-center" data-testid="tasks-empty-state">
          <CheckCircle2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-200">
            {tab === 'overdue' ? "Nothing overdue — you're on top of it." :
             tab === 'future' ? 'No upcoming tasks yet.' :
             "No tasks for today — time to add some."}
          </p>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
            Try a different tab, adjust filters, or add a new task.
          </p>
          <div className="flex items-center gap-2 justify-center mt-4">
            <Button size="sm" onClick={() => setShowCreate(true)} className="h-9 bg-brand hover:bg-brand-dark text-white text-[13px]">
              <Plus className="w-4 h-4 mr-1.5" /> Add Task
            </Button>
            <Button size="sm" variant="outline" className="h-9 text-[13px]" onClick={async () => {
              try { const r = await seedDemo.mutateAsync(); toast.success(`Created ${r.data.created} demo tasks`); }
              catch { toast.error('Could not seed demo tasks'); }
            }} disabled={seedDemo.isPending} data-testid="tasks-seed-demo">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> {seedDemo.isPending ? 'Seeding...' : 'Load demo tasks'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5" data-testid="tasks-list">
          {/* Select all row */}
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(v) => v ? selectAll() : clearSelection()}
              data-testid="tasks-select-all-top"
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {filteredTasks.length} task{filteredTasks.length === 1 ? '' : 's'}
            </span>
          </div>
          {filteredTasks.map(t => (
            <TaskCard
              key={t.id}
              task={t}
              contact={contactsMap[t.contact_id]}
              property={propsMap[t.property_id]}
              selected={selected.has(t.id)}
              onToggleSelect={toggleSelect}
              onOpenComplete={(task) => setCompleteDlg(task)}
              onOpenEdit={(task) => setEditDlg(task)}
              onDelete={handleDelete}
              navigate={navigate}
            />
          ))}
        </div>
      )}

      <CompleteLogDialog task={completeDlg} open={!!completeDlg} onClose={() => setCompleteDlg(null)} />
      <Dialog open={!!editDlg} onOpenChange={(o) => !o && setEditDlg(null)}>
        <DialogContent className="sm:max-w-md" data-testid="edit-task-dialog">
          <DialogHeader><DialogTitle>Edit task</DialogTitle></DialogHeader>
          {editDlg && <TaskForm initial={editDlg} contacts={contacts} properties={properties} onSubmit={handleEdit} />}
        </DialogContent>
      </Dialog>
      <BulkRescheduleDialog open={showBulkResched} onClose={() => setShowBulkResched(false)} onSubmit={handleBulkReschedule} />
      <BulkSequenceDialog open={showBulkSequence} onClose={() => setShowBulkSequence(false)} onSubmit={handleBulkSequence} />
      <HowTasksWorkDialog open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
