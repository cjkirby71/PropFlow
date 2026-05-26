import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// Lightweight context for opening/closing the floating Elara drawer and
// passing optional "context" hints (e.g., contact_id) when invoked from a
// specific page like ContactDetail or InboxThread.
const ElaraContext = createContext(null);

export function ElaraProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [pageContext, setPageContext] = useState(null); // { page, contact_id, ... }
  const [pendingPrompt, setPendingPrompt] = useState(''); // Optional pre-filled prompt

  const openDrawer = useCallback((opts = {}) => {
    if (opts.context !== undefined) setPageContext(opts.context);
    if (opts.conversationId !== undefined) setActiveConversationId(opts.conversationId || null);
    if (opts.prompt) setPendingPrompt(opts.prompt);
    setOpen(true);
  }, []);

  const closeDrawer = useCallback(() => setOpen(false), []);

  const toggleDrawer = useCallback(() => setOpen((v) => !v), []);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setPendingPrompt('');
  }, []);

  const value = useMemo(
    () => ({
      open,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      activeConversationId,
      setActiveConversationId,
      pageContext,
      setPageContext,
      pendingPrompt,
      setPendingPrompt,
      startNewConversation,
    }),
    [open, openDrawer, closeDrawer, toggleDrawer, activeConversationId, pageContext, pendingPrompt, startNewConversation]
  );

  return <ElaraContext.Provider value={value}>{children}</ElaraContext.Provider>;
}

export const useElaraUI = () => {
  const ctx = useContext(ElaraContext);
  if (!ctx) throw new Error('useElaraUI must be used inside <ElaraProvider>');
  return ctx;
};
