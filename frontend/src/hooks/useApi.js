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
export function useContacts(search = '', propertyType = '') {
  return useQuery({
    queryKey: ['contacts', { search, propertyType }],
    queryFn: async () => {
      const params = {};
      if (search) params.search = search;
      if (propertyType) params.property_type = propertyType;
      params.limit = 500;
      const res = await api.get('/contacts', { params });
      return unwrap(res);
    },
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

export function useDeals(pipelineType = '') {
  return useQuery({
    queryKey: ['deals', { pipelineType }],
    queryFn: async () => {
      const params = { limit: 500 };
      if (pipelineType) params.pipeline_type = pipelineType;
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
