/**
 * Connexion à Google par la bibliothèque officielle Google Identity Services (modèle « jeton »).
 * L'application ne voit jamais le mot de passe : la connexion se fait dans la fenêtre de Google.
 * Le jeton obtenu est valable environ une heure et limité au dossier privé de l'application sur Drive.
 */
import { DRIVE_APPDATA_SCOPE } from './config';

const GIS_URL = 'https://accounts.google.com/gsi/client';

export interface GoogleToken {
  token: string;
  expiresAt: number;
}

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    /** `popup` : fenêtre bloquée ou fermée ; `denied` : autorisation refusée ; `load` : bibliothèque injoignable. */
    readonly kind: 'popup' | 'denied' | 'load' | 'other',
  ) {
    super(message);
  }
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
  scope?: string;
}
interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}
interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    prompt?: string;
    include_granted_scopes?: boolean;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type?: string }) => void;
  }): TokenClient;
  revoke(token: string, done?: () => void): void;
  hasGrantedAllScopes?(r: TokenResponse, ...scopes: string[]): boolean;
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

let loading: Promise<GoogleOAuth2> | null = null;

/** Charge la bibliothèque de Google, seulement quand la synchronisation est utilisée. */
export function loadGoogleIdentity(): Promise<GoogleOAuth2> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  loading ??= new Promise<GoogleOAuth2>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_URL;
    s.async = true;
    s.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google.accounts.oauth2) : reject(new GoogleAuthError('La bibliothèque de connexion Google ne s’est pas chargée.', 'load')));
    s.onerror = () => reject(new GoogleAuthError('Impossible de joindre Google (connexion Internet ?).', 'load'));
    document.head.appendChild(s);
  }).catch((e: unknown) => {
    loading = null;
    throw e;
  });
  return loading;
}

/**
 * Demande un jeton. `prompt: ''` : Google ne redemande l'accord que la première fois.
 * Doit être appelé à la suite d'un geste (toucher, clic) : sinon le navigateur bloque la fenêtre de Google.
 */
export async function requestGoogleToken(clientId: string, prompt: '' | 'consent' = ''): Promise<GoogleToken> {
  const oauth2 = await loadGoogleIdentity();
  return new Promise<GoogleToken>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_APPDATA_SCOPE,
      prompt,
      include_granted_scopes: false,
      callback: (r) => {
        if (r.error || !r.access_token) {
          reject(new GoogleAuthError(r.error === 'access_denied' ? 'Autorisation refusée.' : `Google a refusé la connexion (${r.error ?? 'réponse vide'}).`, r.error === 'access_denied' ? 'denied' : 'other'));
          return;
        }
        if (oauth2.hasGrantedAllScopes && !oauth2.hasGrantedAllScopes(r, DRIVE_APPDATA_SCOPE)) {
          reject(new GoogleAuthError('L’accès au dossier de l’application sur Google Drive n’a pas été accordé (case à cocher dans la fenêtre de Google).', 'denied'));
          return;
        }
        resolve({ token: r.access_token, expiresAt: Date.now() + (Number(r.expires_in ?? 3600) - 60) * 1000 });
      },
      error_callback: (e) =>
        reject(new GoogleAuthError(e.type === 'popup_failed_to_open' ? 'La fenêtre de Google a été bloquée par le navigateur.' : e.type === 'popup_closed' ? 'La fenêtre de Google a été fermée.' : 'La connexion à Google a échoué.', 'popup')),
    });
    client.requestAccessToken({ prompt });
  });
}

/** Retire l'autorisation accordée à l'application (comme depuis le compte Google). */
export async function revokeGoogleToken(token: string): Promise<void> {
  const oauth2 = await loadGoogleIdentity();
  await new Promise<void>((resolve) => oauth2.revoke(token, () => resolve()));
}
