import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

function getSystemPreference() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function getInitialTheme() {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('propflow-theme');
    if (stored === 'dark' || stored === 'light') return stored;
  }
  return getSystemPreference();
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  // Apply theme to <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('propflow-theme', theme);
  }, [theme]);

  // Listen for OS-level preference changes (only if user hasn't manually set)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      const stored = localStorage.getItem('propflow-theme');
      if (!stored) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setTheme = useCallback((t) => {
    setThemeState(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
