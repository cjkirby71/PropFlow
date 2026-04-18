import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useContact, useActivities, useDeals, useTemplates } from '../hooks/useApi';
import { ArrowLeft, Phone, Mail, Building, Tag, Sparkles, Plus, Clock, MessageSquare, PhoneCall, FileText, Send, MessageCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const TYPE_LABELS = { residential_lease: 'Residential Lease', commercial_sale: 'Commercial Sale', commercial_lease: 'Commercial Lease' };
const ACTIVITY_ICONS = { call: PhoneCall, email: Mail, note: FileText, meeting: Clock };

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showActivity, setShowActivity] = useState(false);
  const [showSendEmail, setShowSendEmail] = useState(false);
  const [showSendSMS, setShowSendSMS] = useState(false);
  const [emailForm, setEmailForm] = useState({ subject: '', body: '' });
  const [smsForm, setSmsForm] = useState({ message: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [scoreLoading, setScoreLoading] = useState(false);

  const { data: contact, isLoading: contactLoading, error: contactError } = useContact(id);
  const { data: allActivities = [] } = useActivities(id);
  const activities = allActivities;
  const { data: allDeals = [] } = useDeals();
  const deals = allDeals.filter(d => d.contact_id === id);
  const { data: emailTemplates = [] } = useTemplates('email');
  const { data: smsTemplates = [] } = useTemplates('sms');
  const loading = contactLoading;

  if (contactError) { navigate('/contacts'); return null; }

  const invalidateActivities = () => queryClient.invalidateQueries({ queryKey: ['activities'] });
  const invalidateContact = () => queryClient.invalidateQueries({ queryKey: ['contacts', id] });

  const handleAddActivity = async (actData) => {
    await api.post('/activities', { ...actData, contact_id: id });
    invalidateActivities();
    setShowActivity(false);
  };

  const handleScore = async () => {
    setScoreLoading(true);
    try {
      const { data } = await api.post('/ai/lead-score', { contact_id: id });
      alert(`Score: ${data.score}/100\n\n${data.reasoning}\n\nNext: ${data.next_action}`);
      invalidateContact();
    } catch (err) {
      alert('Scoring failed: ' + (err.response?.data?.detail || err.message));
    }
    setScoreLoading(false);
  };

  const handleSendEmail = async () => {
    if (!emailForm.subject || !emailForm.body) return alert('Subject and body required');
    setSendingEmail(true);
    try {
      await api.post('/email/send', { contact_id: id, to_email: contact.email, subject: emailForm.subject, body: emailForm.body });
      alert('Email sent successfully!');
      setShowSendEmail(false);
      setEmailForm({ subject: '', body: '' });
      invalidateActivities();
    } catch (err) {
      alert('Send failed: ' + (err.response?.data?.detail || err.message));
    }
    setSendingEmail(false);
  };

  const handleSendSMS = async () => {
    if (!smsForm.message) return alert('Message required');
    setSendingSMS(true);
    try {
      await api.post('/sms/send', { contact_id: id, to_phone: contact.phone, message: smsForm.message });
      alert('SMS sent successfully!');
      setShowSendSMS(false);
      setSmsForm({ message: '' });
      invalidateActivities();
    } catch (err) {
      alert('SMS failed: ' + (err.response?.data?.detail || err.message));
    }
    setSendingSMS(false);
  };

  const handleDraftAndFill = async () => {
    setEmailLoading(true);
    try {
      const { data } = await api.post('/ai/draft-email', { contact_id: id, context: '', tone: 'professional' });
      const lines = data.draft.split('\n');
      let subject = '';
      let body = data.draft;
      for (const line of lines) {
        if (line.toLowerCase().startsWith('subject:')) {
          subject = line.replace(/^subject:\s*/i, '').trim();
          body = data.draft.replace(line, '').trim();
          break;
        }
      }
      setEmailForm({ subject: subject || 'Follow-up', body });
      setShowSendEmail(true);
    } catch (err) {
      alert('AI draft failed: ' + (err.response?.data?.detail || err.message));
    }
    setEmailLoading(false);
  };

  const applyTemplate = (tpl, type) => {
    const replace = (text) => text
      .replace(/\{contact_name\}/g, contact?.name || '')
      .replace(/\{agent_name\}/g, 'Craig')
      .replace(/\{company_name\}/g, 'RE/SPACE Team')
      .replace(/\{property_address\}/g, '');
    if (type === 'email') {
      setEmailForm({ subject: replace(tpl.subject || ''), body: replace(tpl.body) });
      api.post(`/templates/${tpl.id}/use`).catch(() => {});
    } else {
      setSmsForm({ message: replace(tpl.body) });
      api.post(`/templates/${tpl.id}/use`).catch(() => {});
    }
  };

  if (loading) return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-slate-200 rounded w-48" /><div className="h-40 bg-slate-200 rounded-lg" /></div></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6" data-testid="contact-detail-page">
      <button onClick={() => navigate('/contacts')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors" data-testid="back-to-contacts">
        <ArrowLeft className="w-4 h-4" /> Back to Contacts
      </button>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 sm:p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-slate-600">{contact.name?.charAt(0)?.toUpperCase()}</span>
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-slate-900">{contact.name}</h1>
              {contact.company && <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5"><Building className="w-3.5 h-3.5" /> {contact.company}</p>}
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                {contact.email && <span className="text-sm text-slate-600 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {contact.email}</span>}
                {contact.phone && <span className="text-sm text-slate-600 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {contact.phone}</span>}
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge variant="outline">{TYPE_LABELS[contact.property_type] || contact.property_type}</Badge>
                <Badge variant="secondary">{contact.source}</Badge>
                {contact.tags?.map(t => <Badge key={t} className="bg-slate-100 text-slate-700"><Tag className="w-3 h-3 mr-1" />{t}</Badge>)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold ${contact.lead_score >= 70 ? 'bg-green-100 text-green-800' : contact.lead_score >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
              Score: {contact.lead_score || 0}/100
            </div>
            <Button variant="outline" size="sm" onClick={handleScore} disabled={scoreLoading} className="gap-1.5" data-testid="ai-score-button">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> {scoreLoading ? 'Scoring...' : 'AI Score'}
            </Button>
            <Button size="sm" onClick={handleDraftAndFill} disabled={emailLoading} className="bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 gap-1.5" data-testid="ai-email-button">
              <Sparkles className="w-3.5 h-3.5" /> {emailLoading ? 'Drafting...' : 'AI Draft Email'}
            </Button>
            {contact.email && (
              <Button size="sm" variant="outline" onClick={() => setShowSendEmail(true)} className="gap-1.5" data-testid="send-email-button">
                <Send className="w-3.5 h-3.5" /> Email
              </Button>
            )}
            {contact.phone && (
              <Button size="sm" variant="outline" onClick={() => setShowSendSMS(true)} className="gap-1.5" data-testid="send-sms-button">
                <MessageCircle className="w-3.5 h-3.5" /> SMS
              </Button>
            )}
          </div>
        </div>
        {contact.notes && <p className="text-sm text-slate-600 mt-4 border-t border-slate-100 pt-4">{contact.notes}</p>}
      </div>

      <Tabs defaultValue="activities" className="space-y-4">
        <TabsList data-testid="contact-detail-tabs">
          <TabsTrigger value="activities">Activities ({activities.length})</TabsTrigger>
          <TabsTrigger value="deals">Deals ({deals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-800">Activity Timeline</h3>
              <Dialog open={showActivity} onOpenChange={setShowActivity}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" data-testid="add-activity-button"><Plus className="w-3.5 h-3.5" /> Log Activity</Button>
                </DialogTrigger>
                <DialogContent data-testid="add-activity-dialog">
                  <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
                  <ActivityForm onSubmit={handleAddActivity} />
                </DialogContent>
              </Dialog>
            </div>
            {activities.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No activities logged yet.</p>
            ) : (
              <div className="space-y-3">
                {activities.map((a, i) => {
                  const Icon = ACTIVITY_ICONS[a.activity_type] || MessageSquare;
                  return (
                    <div key={i} className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0" data-testid={`activity-item-${i}`}>
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-700">{a.description}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{a.activity_type} &middot; {new Date(a.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="deals">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
            <h3 className="text-lg font-medium text-slate-800 mb-4">Associated Deals</h3>
            {deals.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No deals linked to this contact.</p>
            ) : (
              <div className="space-y-3">
                {deals.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate('/pipeline')} data-testid={`deal-link-${d.id}`}>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{d.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{TYPE_LABELS[d.pipeline_type]} &middot; {d.stage}</p>
                    </div>
                    {d.value > 0 && <span className="text-sm font-semibold text-slate-900">${d.value.toLocaleString()}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Send Email Dialog */}
      <Dialog open={showSendEmail} onOpenChange={setShowSendEmail}>
        <DialogContent className="sm:max-w-lg" data-testid="send-email-dialog">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="w-4 h-4 text-blue-500" /> Send Email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {emailTemplates.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Use Template</Label>
                <Select onValueChange={v => { const t = emailTemplates.find(t => t.id === v); if (t) applyTemplate(t, 'email'); }}>
                  <SelectTrigger className="bg-white" data-testid="email-template-select"><SelectValue placeholder="Select a template..." /></SelectTrigger>
                  <SelectContent>
                    {emailTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">To</Label>
              <Input value={contact?.email || ''} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Subject</Label>
              <Input value={emailForm.subject} onChange={e => setEmailForm({...emailForm, subject: e.target.value})} placeholder="Email subject" className="bg-white border-slate-300" data-testid="email-subject-input" />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Body</Label>
              <Textarea value={emailForm.body} onChange={e => setEmailForm({...emailForm, body: e.target.value})} rows={8} className="bg-white border-slate-300" data-testid="email-body-input" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSendEmail(false)}>Cancel</Button>
              <Button onClick={handleSendEmail} disabled={sendingEmail} className="bg-slate-900 text-white hover:bg-slate-800 gap-1.5" data-testid="send-email-submit">
                <Send className="w-3.5 h-3.5" /> {sendingEmail ? 'Sending...' : 'Send Email'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send SMS Dialog */}
      <Dialog open={showSendSMS} onOpenChange={setShowSendSMS}>
        <DialogContent className="sm:max-w-md" data-testid="send-sms-dialog">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-green-500" /> Send SMS</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {smsTemplates.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Use Template</Label>
                <Select onValueChange={v => { const t = smsTemplates.find(t => t.id === v); if (t) applyTemplate(t, 'sms'); }}>
                  <SelectTrigger className="bg-white" data-testid="sms-template-select"><SelectValue placeholder="Select a template..." /></SelectTrigger>
                  <SelectContent>
                    {smsTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">To</Label>
              <Input value={contact?.phone || ''} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Message</Label>
              <Textarea value={smsForm.message} onChange={e => setSmsForm({message: e.target.value})} rows={4} placeholder="Type your message..." className="bg-white border-slate-300" data-testid="sms-message-input" />
              <p className="text-xs text-slate-400 mt-1">{smsForm.message.length}/160 characters</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSendSMS(false)}>Cancel</Button>
              <Button onClick={handleSendSMS} disabled={sendingSMS} className="bg-slate-900 text-white hover:bg-slate-800 gap-1.5" data-testid="send-sms-submit">
                <MessageCircle className="w-3.5 h-3.5" /> {sendingSMS ? 'Sending...' : 'Send SMS'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActivityForm({ onSubmit }) {
  const [type, setType] = useState('note');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({ activity_type: type, description: desc });
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="bg-white" data-testid="activity-type-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="note">Note</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Description</Label>
        <Textarea value={desc} onChange={e => setDesc(e.target.value)} required rows={3} className="bg-white border-slate-300" data-testid="activity-description-input" />
      </div>
      <Button type="submit" disabled={submitting} className="w-full bg-slate-900 text-white hover:bg-slate-800" data-testid="activity-form-submit">
        {submitting ? 'Logging...' : 'Log Activity'}
      </Button>
    </form>
  );
}
