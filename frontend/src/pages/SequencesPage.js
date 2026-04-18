import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play, Pause, Trash2, Edit, Users } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { useApi } from '../hooks/useApi';
import { toast } from 'sonner';

export default function SequencesPage() {
  const { sequencesQuery, createSequenceMutation, updateSequenceMutation, deleteSequenceMutation } = useApi();
  const queryClient = useQueryClient();
  const { data, isLoading } = sequencesQuery();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    trigger: 'contact_created',
    trigger_value: '',
    active: true,
    steps: [{ type: 'email', delay_days: 0, subject: '', body: '' }]
  });

  const createMutation = createSequenceMutation({
    onSuccess: () => {
      toast.success('Sequence created');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create sequence');
    }
  });

  const updateMutation = updateSequenceMutation({
    onSuccess: () => {
      toast.success('Sequence updated');
      setDialogOpen(false);
      setEditingSequence(null);
      resetForm();
    }
  });

  const deleteMutation = deleteSequenceMutation({
    onSuccess: () => {
      toast.success('Sequence deleted');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      trigger: 'contact_created',
      trigger_value: '',
      active: true,
      steps: [{ type: 'email', delay_days: 0, subject: '', body: '' }]
    });
  };

  const handleEdit = (sequence) => {
    setEditingSequence(sequence);
    setFormData({
      name: sequence.name,
      trigger: sequence.trigger,
      trigger_value: sequence.trigger_value || '',
      active: sequence.active,
      steps: sequence.steps || [{ type: 'email', delay_days: 0, subject: '', body: '' }]
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingSequence) {
      updateMutation.mutate({ id: editingSequence.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const addStep = () => {
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, { type: 'email', delay_days: 1, subject: '', body: '' }]
    }));
  };

  const removeStep = (index) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const updateStep = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) => i === index ? { ...step, [field]: value } : step)
    }));
  };

  const toggleActive = async (sequence) => {
    await updateMutation.mutateAsync({ 
      id: sequence.id, 
      data: { active: !sequence.active } 
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-600 rounded w-1/4"></div>
          <div className="h-32 bg-slate-200 dark:bg-slate-600 rounded"></div>
        </div>
      </div>
    );
  }

  const sequences = data?.data || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Drip Sequences</h1>
          <p className="text-slate-600 dark:text-slate-400 dark:text-slate-500 mt-1">Automated email & SMS campaigns</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingSequence(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Sequence
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSequence ? 'Edit' : 'Create'} Drip Sequence</DialogTitle>
              <DialogDescription>
                Build automated email/SMS campaigns triggered by contact events
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Sequence Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Welcome Series"
                  required
                />
              </div>
              <div>
                <Label htmlFor="trigger">Trigger Event</Label>
                <Select
                  value={formData.trigger}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, trigger: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact_created">New Contact Created</SelectItem>
                    <SelectItem value="deal_stage_changed">Deal Stage Changed</SelectItem>
                    <SelectItem value="property_viewed">Property Viewed</SelectItem>
                    <SelectItem value="manual">Manual Enrollment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="active">Active</Label>
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Steps ({formData.steps.length})</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addStep}>
                    <Plus className="w-4 h-4 mr-1" /> Add Step
                  </Button>
                </div>
                {formData.steps.map((step, index) => (
                  <Card key={index} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Step {index + 1}</Badge>
                      {formData.steps.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStep(index)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Type</Label>
                        <Select
                          value={step.type}
                          onValueChange={(value) => updateStep(index, 'type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Delay (days)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={step.delay_days}
                          onChange={(e) => updateStep(index, 'delay_days', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    {step.type === 'email' && (
                      <div>
                        <Label>Subject</Label>
                        <Input
                          value={step.subject || ''}
                          onChange={(e) => updateStep(index, 'subject', e.target.value)}
                          placeholder="Welcome to our platform!"
                        />
                      </div>
                    )}
                    <div>
                      <Label>Message</Label>
                      <Textarea
                        value={step.body}
                        onChange={(e) => updateStep(index, 'body', e.target.value)}
                        placeholder="Hi {{contact.name}}, welcome to our platform..."
                        rows={4}
                        required
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">
                        Variables: {'{{contact.name}}'}, {'{{contact.email}}'}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingSequence ? 'Update' : 'Create'} Sequence
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {sequences.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No sequences yet</h3>
          <p className="text-slate-600 dark:text-slate-400 dark:text-slate-500 mb-4">Create your first drip campaign to nurture leads automatically</p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Sequence
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sequences.map((sequence) => (
            <Card key={sequence.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{sequence.name}</h3>
                    <Badge variant={sequence.active ? "default" : "secondary"}>
                      {sequence.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 dark:text-slate-500 mb-3">
                    Trigger: <span className="font-medium">{sequence.trigger.replace(/_/g, ' ')}</span>
                    {sequence.trigger_value && ` (${sequence.trigger_value})`}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-500">
                    <span>{sequence.steps?.length || 0} steps</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActive(sequence)}
                    disabled={updateMutation.isPending}
                  >
                    {sequence.active ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(sequence)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm('Delete this sequence?')) {
                        deleteMutation.mutate(sequence.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
