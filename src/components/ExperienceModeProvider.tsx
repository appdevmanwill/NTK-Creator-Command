'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ExperienceMode = 'guided' | 'pro';

interface ExperienceModeContextValue {
  mode: ExperienceMode;
  setMode: (mode: ExperienceMode) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
}

const ExperienceModeContext = createContext<ExperienceModeContextValue>({
  mode: 'guided',
  setMode: () => {},
  helpOpen: false,
  setHelpOpen: () => {},
});

const STORAGE_KEY = 'ntk-experience-mode';

export function ExperienceModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ExperienceMode>('guided');
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'pro' || saved === 'guided') {
      setModeState(saved);
    }
  }, []);

  const setMode = (next: ExperienceMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <ExperienceModeContext.Provider value={{ mode, setMode, helpOpen, setHelpOpen }}>
      {children}
    </ExperienceModeContext.Provider>
  );
}

export function useExperienceMode() {
  return useContext(ExperienceModeContext);
}
