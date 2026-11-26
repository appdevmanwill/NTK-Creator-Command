'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  resolved: 'dark',
  setMode: () => {},
});

const STORAGE_KEY = 'ntk-theme-mode';

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

function applyThemeToDocument(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#09090b' : '#f6f3ec');
  }
  const bridge = (window as unknown as { NTKAndroidBridge?: { setSystemBars?: (mode: string) => void } })
    .NTKAndroidBridge;
  bridge?.setSystemBars?.(resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) || 'system';
    const valid: ThemeMode = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    setModeState(valid);
    const nextResolved = resolveTheme(valid);
    setResolved(nextResolved);
    applyThemeToDocument(nextResolved);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const currentSaved = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) || 'system';
      if (currentSaved === 'system') {
        const sysResolved = resolveTheme('system');
        setResolved(sysResolved);
        applyThemeToDocument(sysResolved);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    const nextResolved = resolveTheme(next);
    setResolved(nextResolved);
    applyThemeToDocument(nextResolved);
  };

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
