import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { NotationStyle } from '../core/notation';
import { readJson, writeJson } from './storage';

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface Settings {
  notation: NotationStyle;
  showLegalMoves: boolean;
  coordinates: boolean;
  theme: ThemeChoice;
}

export const DEFAULT_SETTINGS: Settings = {
  notation: 'figurine',
  showLegalMoves: true,
  coordinates: true,
  theme: 'system',
};

const KEY = 'cma.settings.v1';

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>(KEY, {}) }));

  useEffect(() => {
    writeJson(KEY, settings);
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, update: (patch) => setSettings((s) => ({ ...s, ...patch })) }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings doit être utilisé dans <SettingsProvider>');
  return ctx;
}
