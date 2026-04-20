import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: Unwrap paginated response { data: [...], pagination: {...} }
// Falls back to raw array for non-paginated endpoints
// ═══════════════════════════════════════════════════════════════════════════════
const unwrap = (res) => {
  const d = res.data;
  return d && d.data && d.pagination ? d.data : d;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTACTS
// ─────────────────────────────────────────────────────────────────────────────
export function useContacts(search = '', propertyType = '', smartList = '', collection = '') {
  return useQuery({
    queryKey: ['contacts', { search, propertyType, smartList, collection }],
    queryFn: async () => {
      const params = {};
      if (search) params.search = search;
      if (propertyType) params.property_type = propertyType;
      if (smartList) params.smart_list = smartList;
      if (collection) params.collection = collection;
      params.limit = 500;
      const res = await api.get('/contacts', { params });
      return unwrap(res);
    },
    keepPreviousData: true,
  });
}

export function useContactSmartCounts() {
  return useQuery({
    queryKey: ['contacts-smart-counts'],
    queryFn: async () => (await api.get('/contacts/smart-counts')).data,
    staleTime: 30 * 1000,
  });
}

export function useContact(id) {
  return useQuery({
    queryKey: ['contacts', id],
    queryFn: async () => (await api.get(`/contacts/${id}`)).data,
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/contacts', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/contacts/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contacts', id] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/contacts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useImportContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData) => api.post('/contacts/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPERTIES
// ─────────────────────────────────────────────────────────────────────────────
export function useProperties(propType = '', listType = '') {
  return useQuery({
    queryKey: ['properties', { propType, listType }],
    queryFn: async () => {
      const params = { limit: 500 };
      if (propType) params.property_type = propType;
      if (listType) params.listing_type = listType;
      const res = await api.get('/properties', { params });
      return unwrap(res);
    },
  });
}

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/properties', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
}

export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/properties/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/properties/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
}

export function useImportProperties() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData) => api.post('/properties/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DEALS / PIPELINE
// ─────────────────────────────────────────────────────────────────────────────
export function usePipelineStages() {
  return useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: async () => (await api.get('/pipelines/stages')).data,
    staleTime: 5 * 60 * 1000, // stages are static
  });
}

export function useDeals(pipelineType = '', scope = '') {
  return useQuery({
    queryKey: ['deals', { pipelineType, scope }],
    queryFn: async () => {
      const params = { limit: 500 };
      if (pipelineType) params.pipeline_type = pipelineType;
      if (scope) params.scope = scope;
      const res = await api.get('/deals', { params });
      return unwrap(res);
    },
    staleTime: 10 * 1000, // Pipeline needs fresher data
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/deals', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

/**
 * Optimistic update for deal stage changes (kanban drag-and-drop).
 * Immediately updates the cache so the UI feels instant, then
 * revalidates in the background. Rolls back on error.
 */
export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/deals/${id}`, data),
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await qc.cancelQueries({ queryKey: ['deals'] });
      // Snapshot all deal query caches for rollback
      const previousQueries = qc.getQueriesData({ queryKey: ['deals'] });
      // Optimistically update every matching deals cache
      qc.setQueriesData({ queryKey: ['deals'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((deal) =>
          deal.id === id ? { ...deal, ...data } : deal
        );
      });
      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      // Rollback on failure
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          qc.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['tasks'] }); // auto-tasks may have been created
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/deals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────────────────
export function useTasks(filter = '') {
  return useQuery({
    queryKey: ['tasks', { filter }],
    queryFn: async () => {
      const params = { limit: 500 };
      if (filter === 'active') params.completed = 'false';
      if (filter === 'completed') params.completed = 'true';
      const res = await api.get('/tasks', { params });
      return unwrap(res);
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/tasks', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/tasks/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

// ── Phase 15: Tasks page (FUB-parity) ──
export function useTaskCounts({ assignee = 'me', taskType = '' } = {}) {
  return useQuery({
    queryKey: ['task-counts', { assignee, taskType }],
    queryFn: async () => {
      const params = { assignee };
      if (taskType) params.task_type = taskType;
      return (await api.get('/tasks/counts', { params })).data;
    },
    staleTime: 15 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useTaskBucket({ bucket = 'today', assignee = 'me', taskType = '' } = {}) {
  return useQuery({
    queryKey: ['task-bucket', { bucket, assignee, taskType }],
    queryFn: async () => {
      const params = { bucket, assignee };
      if (taskType) params.task_type = taskType;
      const res = await api.get('/tasks/bucket', { params });
      return res.data.tasks || [];
    },
    staleTime: 10 * 1000,
    keepPreviousData: true,
  });
}

export function useCompleteAndLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.post(`/tasks/${id}/complete-and-log`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-counts'] });
      qc.invalidateQueries({ queryKey: ['task-bucket'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useTasksBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/tasks/bulk', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-counts'] });
      qc.invalidateQueries({ queryKey: ['task-bucket'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useSeedTasksDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/tasks/seed-demo'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-counts'] });
      qc.invalidateQueries({ queryKey: ['task-bucket'] });
    },
  });
}

// ── Phase 17: Org / Admin settings ──
export function useOrgSettings() {
  return useQuery({
    queryKey: ['org-settings'],
    queryFn: async () => (await api.get('/settings')).data,
    staleTime: 30 * 1000,
  });
}

export function useUpdateOrgSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.put('/settings', data),
    onSuccess: (res) => {
      qc.setQueryData(['org-settings'], res.data);
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useSettingsSummary() {
  return useQuery({
    queryKey: ['settings-summary'],
    queryFn: async () => (await api.get('/settings/summary')).data,
    staleTime: 60 * 1000,
  });
}

// ── Phase 18: Reporting / Analytics ──
export function useLeasingReport({ dateRange = '30d', scope = 'me' } = {}) {
  return useQuery({
    queryKey: ['leasing-report', { dateRange, scope }],
    queryFn: async () => (await api.get('/reports/leasing', { params: { date_range: dateRange, scope } })).data,
    staleTime: 30 * 1000,
    keepPreviousData: true,
  });
}

export function useBenchmarks({ dateRange = '30d', universityZone = 'all' } = {}) {
  return useQuery({
    queryKey: ['benchmarks', { dateRange, universityZone }],
    queryFn: async () => (await api.get('/reports/benchmarks', { params: { date_range: dateRange, university_zone: universityZone } })).data,
    staleTime: 60 * 1000,
    keepPreviousData: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITIES
// ─────────────────────────────────────────────────────────────────────────────
export function useActivities(contactId = '', dealId = '') {
  return useQuery({
    queryKey: ['activities', { contactId, dealId }],
    queryFn: async () => {
      const params = { limit: 500 };
      if (contactId) params.contact_id = contactId;
      if (dealId) params.deal_id = dealId;
      const res = await api.get('/activities', { params });
      return unwrap(res);
    },
    enabled: !!(contactId || dealId || true), // always enabled
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/activities', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
export function useTemplates(category = '') {
  return useQuery({
    queryKey: ['templates', { category }],
    queryFn: async () => {
      const params = { limit: 500 };
      if (category && category !== 'all') params.category = category;
      const res = await api.get('/templates', { params });
      return unwrap(res);
    },
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/templates', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/templates/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => (await api.get('/dashboard/stats')).data,
    staleTime: 30 * 1000,
  });
}

// Phase 11: FUB-parity leasing overview (KPIs + sparklines + activity + action items)
export function useLeasingOverview(range = '30d', scope = 'me') {
  return useQuery({
    queryKey: ['leasing-overview', range, scope],
    queryFn: async () =>
      (await api.get('/dashboard/leasing-overview', { params: { range, scope } })).data,
    staleTime: 30 * 1000,
    keepPreviousData: true,
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS: API Keys, Team, Webhooks
// ─────────────────────────────────────────────────────────────────────────────
export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const res = await api.get('/api-keys');
      return unwrap(res);
    },
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/api-keys', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useDeleteApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyPreview) => api.delete(`/api-keys/${keyPreview}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const res = await api.get('/team/members');
      return unwrap(res);
    },
  });
}

export function useInviteTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/team/invite', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members'] }),
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/team/members/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members'] }),
  });
}

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const res = await api.get('/webhooks');
      return unwrap(res);
    },
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/webhooks', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/webhooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useToggleWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.put(`/webhooks/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SEQUENCES
// ─────────────────────────────────────────────────────────────────────────────
export function useSequences() {
  return useQuery({
    queryKey: ['sequences'],
    queryFn: async () => {
      const res = await api.get('/sequences', { params: { limit: 100 } });
      return unwrap(res);
    },
  });
}

export function useCreateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/sequences', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sequences'] }),
  });
}

export function useUpdateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/sequences/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sequences'] }),
  });
}

export function useDeleteSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/sequences/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sequences'] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS & REPORTS
// ─────────────────────────────────────────────────────────────────────────────
export function useReports() {
  return useQuery({
    queryKey: ['reports'],
    queryFn: async () => (await api.get('/reports')).data,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// USER SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
export function useUpdateUserSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.put('/users/me', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Centralized useApi hook (exports all query/mutation builders)
// ═══════════════════════════════════════════════════════════════════════════════
export function useApi() {
  return {
    // Sequences
    sequencesQuery: useSequences,
    createSequenceMutation: useCreateSequence,
    updateSequenceMutation: useUpdateSequence,
    deleteSequenceMutation: useDeleteSequence,
    
    // Reports
    reportsQuery: useReports,
    
    // User Settings
    updateUserSettingsMutation: useUpdateUserSettings,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// CONTACT PROFILE PAGE  (Phase 9 — FUB-parity)
// ─────────────────────────────────────────────────────────────────────────────

// Client types + stage catalog
export function useClientTypes() {
  return useQuery({
    queryKey: ['client-types'],
    queryFn: async () => (await api.get('/client-types')).data,
    staleTime: 30 * 60 * 1000,
  });
}

// Invalidate helpers
function invalidateContact(qc, id) {
  qc.invalidateQueries({ queryKey: ['contacts'] });
  qc.invalidateQueries({ queryKey: ['contacts', id] });
}

// ── Photo ──
export function useUploadContactPhoto(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photo_url) => api.post(`/contacts/${contactId}/photo`, { photo_url }),
    onSuccess: () => invalidateContact(qc, contactId),
  });
}
export function useDeleteContactPhoto(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/contacts/${contactId}/photo`),
    onSuccess: () => invalidateContact(qc, contactId),
  });
}

// ── Stage ──
export function useUpdateContactStage(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.put(`/contacts/${contactId}/stage`, data),
    onSuccess: () => {
      invalidateContact(qc, contactId);
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

// ── Tags ──
export function useAddContactTag(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tag) => api.post(`/contacts/${contactId}/tags`, { tag }),
    onSuccess: () => invalidateContact(qc, contactId),
  });
}
export function useRemoveContactTag(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tag) => api.delete(`/contacts/${contactId}/tags/${encodeURIComponent(tag)}`),
    onSuccess: () => invalidateContact(qc, contactId),
  });
}

// ── Files ──
export function useContactFiles(contactId) {
  return useQuery({
    queryKey: ['contact-files', contactId],
    queryFn: async () => (await api.get(`/contacts/${contactId}/files`)).data,
    enabled: !!contactId,
  });
}
export function useUploadContactFile(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post(`/contacts/${contactId}/files`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-files', contactId] }),
  });
}
export function useDeleteContactFile(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileId) => api.delete(`/contacts/${contactId}/files/${fileId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-files', contactId] }),
  });
}
export async function downloadContactFile(contactId, fileId) {
  return (await api.get(`/contacts/${contactId}/files/${fileId}`)).data;
}

// ── Lease ──
export function useContactLease(contactId) {
  return useQuery({
    queryKey: ['contact-lease', contactId],
    queryFn: async () => (await api.get(`/contacts/${contactId}/lease`)).data,
    enabled: !!contactId,
  });
}
export function useSaveLease(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post(`/contacts/${contactId}/lease`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-lease', contactId] }),
  });
}

// ── Maintenance tickets ──
export function useMaintenanceTickets(contactId) {
  return useQuery({
    queryKey: ['contact-tickets', contactId],
    queryFn: async () => (await api.get(`/contacts/${contactId}/maintenance`)).data,
    enabled: !!contactId,
  });
}
export function useCreateTicket(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post(`/contacts/${contactId}/maintenance`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-tickets', contactId] });
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}
export function useUpdateTicket(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/contacts/${contactId}/maintenance/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-tickets', contactId] }),
  });
}
export function useDeleteTicket(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/contacts/${contactId}/maintenance/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-tickets', contactId] }),
  });
}

// ── Calendar events (per-contact) ──
export function useContactEvents(contactId) {
  return useQuery({
    queryKey: ['contact-events', contactId],
    queryFn: async () => (await api.get(`/contacts/${contactId}/events`)).data,
    enabled: !!contactId,
  });
}
export function useCreateEvent(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post(`/contacts/${contactId}/events`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-events', contactId] }),
  });
}
export function useUpdateEvent(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/contacts/${contactId}/events/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-events', contactId] }),
  });
}
export function useDeleteEvent(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/contacts/${contactId}/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-events', contactId] }),
  });
}

// ── Collaborators ──
export function useCollaborators(contactId) {
  return useQuery({
    queryKey: ['contact-collaborators', contactId],
    queryFn: async () => (await api.get(`/contacts/${contactId}/collaborators`)).data,
    enabled: !!contactId,
  });
}
export function useAddCollaborator(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (user_id) => api.post(`/contacts/${contactId}/collaborators`, { user_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-collaborators', contactId] }),
  });
}
export function useRemoveCollaborator(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (user_id) => api.delete(`/contacts/${contactId}/collaborators/${user_id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-collaborators', contactId] }),
  });
}

// ── AI ──
export function useAIRetentionSummary(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/ai/retention-summary', { contact_id: contactId }),
    onSuccess: () => invalidateContact(qc, contactId),
  });
}
export function useAIAnalyzeEmailThread(contactId) {
  return useMutation({
    mutationFn: () => api.post('/ai/analyze-email-thread', { contact_id: contactId }),
  });
}

// ── One-click actions ──
export function useConvertToTenant(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/contacts/${contactId}/convert-to-tenant`),
    onSuccess: () => {
      invalidateContact(qc, contactId);
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}
export function useSendRenewalOffer(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/contacts/${contactId}/send-renewal-offer`),
    onSuccess: () => {
      invalidateContact(qc, contactId);
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// PHASE 10 — Lease Applications Pipeline
// ─────────────────────────────────────────────────────────────────────────────

export function useLeasePipelineSummary(pipelineType = 'lease_applications', scope = 'me') {
  return useQuery({
    queryKey: ['pipeline-summary', { pipelineType, scope }],
    queryFn: async () => (await api.get('/deals/pipeline-summary', {
      params: { pipeline_type: pipelineType, scope },
    })).data,
    staleTime: 10 * 1000,
  });
}

export function useCustomStages(pipelineType = 'lease_applications') {
  return useQuery({
    queryKey: ['custom-stages', { pipelineType }],
    queryFn: async () => (await api.get('/pipeline/custom-stages', {
      params: { pipeline_type: pipelineType },
    })).data,
    staleTime: 60 * 1000,
  });
}

export function useAddCustomStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pipeline_type, name }) => api.post('/pipeline/custom-stages', { pipeline_type, name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-stages'] });
      qc.invalidateQueries({ queryKey: ['pipeline-summary'] });
    },
  });
}

export function useRemoveCustomStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pipeline_type, name }) =>
      api.delete(`/pipeline/custom-stages/${pipeline_type}/${encodeURIComponent(name)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-stages'] });
      qc.invalidateQueries({ queryKey: ['pipeline-summary'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 14 — UNIFIED INBOX
// ─────────────────────────────────────────────────────────────────────────────
export function useInboxCounts() {
  return useQuery({
    queryKey: ['inbox-counts'],
    queryFn: async () => (await api.get('/inbox/counts')).data,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useInboxThreads({ folder = 'inbox', channel = '', search = '' } = {}) {
  return useQuery({
    queryKey: ['inbox-threads', { folder, channel, search }],
    queryFn: async () => {
      const params = { folder, limit: 150 };
      if (channel) params.channel = channel;
      if (search) params.search = search;
      const res = await api.get('/inbox/threads', { params });
      return res.data.threads || [];
    },
    staleTime: 15 * 1000,
    keepPreviousData: true,
  });
}

export function useInboxThread(contactId) {
  return useQuery({
    queryKey: ['inbox-thread', contactId],
    queryFn: async () => (await api.get(`/inbox/threads/${contactId}`)).data,
    enabled: !!contactId,
    staleTime: 5 * 1000,
  });
}

export function useSendInboxReply(contactId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post(`/inbox/threads/${contactId}/reply`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-thread', contactId] });
      qc.invalidateQueries({ queryKey: ['inbox-threads'] });
      qc.invalidateQueries({ queryKey: ['inbox-counts'] });
    },
  });
}

export function useMarkThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactId) => api.post(`/inbox/threads/${contactId}/read`),
    onSuccess: (_, contactId) => {
      qc.invalidateQueries({ queryKey: ['inbox-thread', contactId] });
      qc.invalidateQueries({ queryKey: ['inbox-threads'] });
      qc.invalidateQueries({ queryKey: ['inbox-counts'] });
    },
  });
}

export function useAssignThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactId) => api.post(`/inbox/threads/${contactId}/assign`),
    onSuccess: (_, contactId) => {
      qc.invalidateQueries({ queryKey: ['inbox-thread', contactId] });
      qc.invalidateQueries({ queryKey: ['inbox-threads'] });
      qc.invalidateQueries({ queryKey: ['inbox-counts'] });
    },
  });
}

export function useCloseThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactId) => api.post(`/inbox/threads/${contactId}/close`),
    onSuccess: (_, contactId) => {
      qc.invalidateQueries({ queryKey: ['inbox-thread', contactId] });
      qc.invalidateQueries({ queryKey: ['inbox-threads'] });
      qc.invalidateQueries({ queryKey: ['inbox-counts'] });
    },
  });
}

export function useSaveInboxDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.put('/inbox/drafts', data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['inbox-thread', vars.contact_id] });
      qc.invalidateQueries({ queryKey: ['inbox-counts'] });
    },
  });
}

export function useSeedInboxDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/inbox/seed-demo'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-threads'] });
      qc.invalidateQueries({ queryKey: ['inbox-counts'] });
    },
  });
}
