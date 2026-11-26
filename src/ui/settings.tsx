import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { NotationStyle } from '../core/notation';
import { readJson, writeJson } from './storage';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type BoardTheme = 'ardoise' | 'bois' | 'vert' | 'contraste';

export const BOARD_THEMES: { id: BoardTheme; label: string }[] = [
  { id: 'ardoise', label: 'Ardoise (par défaut)' },
  { id: 'bois', label: 'Bois' },
  { id: 'vert', label: 'Vert' },
  { id: 'contraste', label: 'Contraste élevé' },
];

export interface Settings {
  notation: NotationStyle;
  showLegalMoves: boolean;
  coordinates: boolean;
  theme: ThemeChoice;
  boardTheme: BoardTheme;
  /** Sons des coups (désactivés par défaut). */
  sound: boolean;
  /** Vibration courte à chaque coup, sur les appareils qui la proposent. */
  vibration: boolean;
  /** Voix de l'entraîneur : lecture à voix haute des explications (désactivée par défaut). */
  coachVoice: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  notation: 'figurine',
  showLegalMoves: true,
  coordinates: true,
  theme: 'system',
  boardTheme: 'ardoise',
  sound: false,
  vibration: true,
  coachVoice: false,
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
    if (settings.boardTheme === 'ardoise') root.removeAttribute('data-board');
    else root.setAttribute('data-board', settings.boardTheme);
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, update: (patch) => setSettings((s) => ({ ...s, ...patch })) }}>
      {children}
    </SettingsContext.Provider>
  );
}

/** Réglages si disponibles (un échiquier affiché hors de <SettingsProvider> garde les valeurs par défaut). */
export function useOptionalSettings(): Settings {
  return useContext(SettingsContext)?.settings ?? DEFAULT_SETTINGS;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings doit être utilisé dans <SettingsProvider>');
  return ctx;
}
