import React, { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import { Plus, CheckCircle2, Circle, Clock, AlertTriangle, Trash2, Calendar } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';

const PRIORITY_STYLES = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState('all');
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter === 'active') params.completed = 'false';
      if (filter === 'completed') params.completed = 'true';
      const [tasksRes, contactsRes, dealsRes] = await Promise.all([
        api.get('/tasks', { params }),
        api.get('/contacts'),
        api.get('/deals'),
      ]);
      setTasks(tasksRes.data);
      setContacts(contactsRes.data);
      setDeals(dealsRes.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const toggleComplete = async (task) => {
    await api.put(`/tasks/${task.id}`, { completed: !task.completed });
    fetchTasks();
  };

  const handleDelete = async (id) => {
    await api.delete(`/tasks/${id}`);
    fetchTasks();
  };

  const getContactName = (id) => contacts.find(c => c.id === id)?.name || '';
  const getDealTitle = (id) => deals.find(d => d.id === id)?.title || '';

  const isOverdue = (task) => {
    if (task.completed || !task.due_date) return false;
    return new Date(task.due_date) < new Date();
  };

  const today = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(t => t.due_date?.startsWith(today) && !t.completed);
  const overdueTasks = tasks.filter(t => isOverdue(t));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5" data-testid="tasks-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Tasks</h1>
          <p className="text-sm text-slate-500 mt-1">{tasks.filter(t => !t.completed).length} active tasks</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 text-white hover:bg-slate-800 gap-2" data-testid="add-task-button">
              <Plus className="w-4 h-4" /> Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" data-testid="add-task-dialog">
            <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
            <TaskForm contacts={contacts} deals={deals} onSubmit={async (d) => { await api.post('/tasks', d); setShowAdd(false); fetchTasks(); }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick stats */}
      <div className="flex gap-3 flex-wrap">
        {overdueTasks.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md text-sm text-red-700" data-testid="overdue-tasks-badge">
            <AlertTriangle className="w-4 h-4" /> {overdueTasks.length} overdue
          </div>
        )}
        {todayTasks.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700" data-testid="today-tasks-badge">
            <Clock className="w-4 h-4" /> {todayTasks.length} due today
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2" data-testid="task-filters">
        {['all', 'active', 'completed'].map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className={filter === f ? 'bg-slate-900 text-white' : ''} data-testid={`task-filter-${f}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div>
      ) : tasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center" data-testid="tasks-empty-state">
          <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm mb-3">{filter === 'all' ? 'No tasks yet.' : `No ${filter} tasks.`}</p>
          <Button onClick={() => setShowAdd(true)} className="bg-slate-900 text-white hover:bg-slate-800 gap-2"><Plus className="w-4 h-4" /> Add Task</Button>
        </div>
      ) : (
        <div className="space-y-2" data-testid="tasks-list">
          {tasks.map(task => (
            <div key={task.id} className={`bg-white border rounded-lg p-4 flex items-start gap-3 hover:shadow-sm transition-shadow ${isOverdue(task) ? 'border-red-200 bg-red-50/30' : 'border-slate-200'} ${task.completed ? 'opacity-60' : ''}`} data-testid={`task-item-${task.id}`}>
              <Checkbox checked={task.completed} onCheckedChange={() => toggleComplete(task)} className="mt-0.5" data-testid={`task-checkbox-${task.id}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-medium ${task.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>{task.title}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={`text-xs border ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium}`}>{task.priority}</Badge>
                    <button onClick={() => handleDelete(task.id)} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors" data-testid={`delete-task-${task.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {task.description && <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {task.due_date && (
                    <span className={`text-xs flex items-center gap-1 ${isOverdue(task) ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                      <Calendar className="w-3 h-3" /> {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  )}
                  {task.contact_id && <span className="text-xs text-slate-500">{getContactName(task.contact_id)}</span>}
                  {task.deal_id && <span className="text-xs text-slate-500">{getDealTitle(task.deal_id)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskForm({ contacts, deals, onSubmit }) {
  const [form, setForm] = useState({
    title: '', description: '', due_date: '', contact_id: '', deal_id: '', priority: 'medium', completed: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try { await onSubmit(form); } catch (err) { alert(err.response?.data?.detail || err.message); }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Title *</Label>
        <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required className="bg-white border-slate-300" data-testid="task-form-title" />
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Description</Label>
        <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="bg-white border-slate-300" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Due Date</Label>
          <Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="bg-white border-slate-300" data-testid="task-form-due-date" />
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Priority</Label>
          <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
            <SelectTrigger className="bg-white" data-testid="task-form-priority"><SelectValue /></SelectTrigger>
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
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Contact</Label>
          <Select value={form.contact_id} onValueChange={v => setForm({...form, contact_id: v})}>
            <SelectTrigger className="bg-white"><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Deal</Label>
          <Select value={form.deal_id} onValueChange={v => setForm({...form, deal_id: v})}>
            <SelectTrigger className="bg-white"><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {deals.map(d => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={submitting} className="w-full bg-slate-900 text-white hover:bg-slate-800" data-testid="task-form-submit">
        {submitting ? 'Creating...' : 'Create Task'}
      </Button>
    </form>
  );
}
