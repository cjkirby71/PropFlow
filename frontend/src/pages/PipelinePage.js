import React, { useEffect, useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../lib/api';
import { Plus, DollarSign, User, Building2, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

const PIPELINE_LABELS = {
  residential_lease: 'Residential Lease',
  commercial_sale: 'Commercial Sale',
  commercial_lease: 'Commercial Lease',
};

const STAGE_COLORS = {
  'New Lead': 'bg-indigo-100 border-indigo-200',
  'Contacted': 'bg-yellow-50 border-yellow-200',
  'Showing': 'bg-lime-50 border-lime-200',
  'Application': 'bg-orange-50 border-orange-200',
  'Lease Signed': 'bg-green-50 border-green-200',
  'Tour': 'bg-lime-50 border-lime-200',
  'LOI': 'bg-orange-50 border-orange-200',
  'Due Diligence': 'bg-amber-50 border-amber-200',
  'Closing': 'bg-emerald-50 border-emerald-200',
  'Proposal': 'bg-sky-50 border-sky-200',
  'Negotiation': 'bg-purple-50 border-purple-200',
  'Closed': 'bg-green-100 border-green-300',
};

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState('residential_lease');
  const [stages, setStages] = useState({});
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editDeal, setEditDeal] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [stagesRes, dealsRes, contactsRes, propsRes] = await Promise.all([
        api.get('/pipelines/stages'),
        api.get('/deals', { params: { pipeline_type: pipeline } }),
        api.get('/contacts'),
        api.get('/properties'),
      ]);
      setStages(stagesRes.data);
      setDeals(dealsRes.data);
      setContacts(contactsRes.data);
      setProperties(propsRes.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [pipeline]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const currentStages = stages[pipeline] || [];
  const dealsByStage = {};
  currentStages.forEach(s => { dealsByStage[s] = deals.filter(d => d.stage === s); });

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStage = destination.droppableId;
    // Optimistic update
    setDeals(prev => prev.map(d => d.id === draggableId ? { ...d, stage: newStage } : d));
    try {
      await api.put(`/deals/${draggableId}`, { stage: newStage });
    } catch {
      fetchData(); // Revert on error
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this deal?')) return;
    await api.delete(`/deals/${id}`);
    fetchData();
  };

  const getContactName = (contactId) => contacts.find(c => c.id === contactId)?.name || '';
  const getPropertyName = (propertyId) => properties.find(p => p.id === propertyId)?.name || '';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5" data-testid="pipeline-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Pipeline</h1>
          <p className="text-sm text-slate-500 mt-1">Drag deals between stages to update</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 text-white hover:bg-slate-800 gap-2" data-testid="add-deal-button">
              <Plus className="w-4 h-4" /> Add Deal
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" data-testid="add-deal-dialog">
            <DialogHeader><DialogTitle>New Deal</DialogTitle></DialogHeader>
            <DealForm pipeline={pipeline} stages={currentStages} contacts={contacts} properties={properties} onSubmit={async (d) => { await api.post('/deals', d); setShowAdd(false); fetchData(); }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Pipeline tabs */}
      <Tabs value={pipeline} onValueChange={setPipeline} data-testid="pipeline-tabs">
        <TabsList className="bg-slate-100">
          {Object.entries(PIPELINE_LABELS).map(([k, v]) => (
            <TabsTrigger key={k} value={k} className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm" data-testid={`pipeline-tab-${k}`}>{v}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">{[1,2,3,4].map(i => <div key={i} className="w-80 flex-shrink-0 h-96 bg-slate-100 rounded-lg animate-pulse" />)}</div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex overflow-x-auto gap-4 pb-4" style={{ minHeight: 'calc(100vh - 280px)' }} data-testid="pipeline-board">
            {currentStages.map(stage => (
              <Droppable key={stage} droppableId={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`w-80 flex-shrink-0 flex flex-col rounded-lg border ${STAGE_COLORS[stage] || 'bg-slate-50 border-slate-200'} ${snapshot.isDraggingOver ? 'ring-2 ring-blue-400' : ''}`}
                    data-testid={`pipeline-column-${stage.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="px-3 py-3 border-b border-slate-200/60">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-800">{stage}</h3>
                        <span className="text-xs font-semibold text-slate-500 bg-white/80 px-2 py-0.5 rounded-full">{dealsByStage[stage]?.length || 0}</span>
                      </div>
                    </div>
                    <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px]">
                      {dealsByStage[stage]?.map((deal, index) => (
                        <Draggable key={deal.id} draggableId={deal.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow ${snapshot.isDragging ? 'shadow-lg scale-105 rotate-1' : ''}`}
                              data-testid={`deal-card-${deal.id}`}
                            >
                              <div className="flex items-start justify-between">
                                <h4 className="text-sm font-medium text-slate-900 leading-tight">{deal.title}</h4>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="p-1 hover:bg-slate-100 rounded" data-testid={`deal-menu-${deal.id}`}><MoreHorizontal className="w-3.5 h-3.5 text-slate-400" /></button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setEditDeal(deal)}><Edit className="w-3.5 h-3.5 mr-2" /> Edit</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDelete(deal.id)} className="text-red-600"><Trash2 className="w-3.5 h-3.5 mr-2" /> Delete</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="mt-2 space-y-1">
                                {deal.contact_id && <p className="text-xs text-slate-500 flex items-center gap-1"><User className="w-3 h-3" /> {getContactName(deal.contact_id)}</p>}
                                {deal.property_id && <p className="text-xs text-slate-500 flex items-center gap-1"><Building2 className="w-3 h-3" /> {getPropertyName(deal.property_id)}</p>}
                              </div>
                              {deal.value > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-100">
                                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1"><DollarSign className="w-3 h-3" /> {deal.value.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {(!dealsByStage[stage] || dealsByStage[stage].length === 0) && (
                        <div className="text-center py-8 text-xs text-slate-400">No deals</div>
                      )}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      )}

      {/* Edit Deal Dialog */}
      <Dialog open={!!editDeal} onOpenChange={(o) => { if (!o) setEditDeal(null); }}>
        <DialogContent className="sm:max-w-md" data-testid="edit-deal-dialog">
          <DialogHeader><DialogTitle>Edit Deal</DialogTitle></DialogHeader>
          {editDeal && <DealForm initial={editDeal} pipeline={pipeline} stages={currentStages} contacts={contacts} properties={properties} onSubmit={async (d) => { await api.put(`/deals/${editDeal.id}`, d); setEditDeal(null); fetchData(); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DealForm({ initial, pipeline, stages, contacts, properties, onSubmit }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    pipeline_type: initial?.pipeline_type || pipeline,
    stage: initial?.stage || stages[0] || '',
    contact_id: initial?.contact_id || '',
    property_id: initial?.property_id || '',
    value: initial?.value || 0,
    notes: initial?.notes || '',
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
        <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required className="bg-white border-slate-300" data-testid="deal-form-title" />
      </div>
      {!initial && (
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Stage</Label>
          <Select value={form.stage} onValueChange={v => setForm({...form, stage: v})}>
            <SelectTrigger className="bg-white" data-testid="deal-form-stage"><SelectValue /></SelectTrigger>
            <SelectContent>
              {stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Contact</Label>
          <Select value={form.contact_id} onValueChange={v => setForm({...form, contact_id: v})}>
            <SelectTrigger className="bg-white" data-testid="deal-form-contact"><SelectValue placeholder="Select contact" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No contact</SelectItem>
              {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Property</Label>
          <Select value={form.property_id} onValueChange={v => setForm({...form, property_id: v})}>
            <SelectTrigger className="bg-white" data-testid="deal-form-property"><SelectValue placeholder="Select property" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No property</SelectItem>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Deal Value ($)</Label>
        <Input type="number" value={form.value} onChange={e => setForm({...form, value: parseFloat(e.target.value) || 0})} className="bg-white border-slate-300" data-testid="deal-form-value" />
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Notes</Label>
        <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="bg-white border-slate-300" data-testid="deal-form-notes" />
      </div>
      <Button type="submit" disabled={submitting} className="w-full bg-slate-900 text-white hover:bg-slate-800" data-testid="deal-form-submit">
        {submitting ? 'Saving...' : initial ? 'Update Deal' : 'Create Deal'}
      </Button>
    </form>
  );
}
