import { QueryClient } from '@tanstack/react-query';

/**
 * Global QueryClient with sensible defaults:
 * - staleTime: 30s — data is considered fresh for 30 seconds (no refetch)
 * - gcTime: 5min — unused cache entries are garbage collected after 5 minutes
 * - refetchOnWindowFocus: true — auto-refetch when user returns to the tab
 * - retry: 1 — retry failed requests once
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
