/**
 * Identifiant de l'application auprès de Google (« ID client OAuth », type Application Web).
 * Il est public par nature : il identifie l'application, il ne donne accès à rien sans ton accord.
 * Il est créé dans ta console Google Cloud (voir docs/guide-synchronisation.md).
 * Vide : la synchronisation est indiquée comme non configurée.
 */
const CLIENT_ID = '';

declare global {
  interface Window {
    /** Identifiant fictif injecté par les tests navigateur (le vrai service Google est alors simulé). */
    __CMA_TEST_GOOGLE_CLIENT_ID__?: string;
  }
}

export function googleClientId(): string {
  return (typeof window !== 'undefined' && window.__CMA_TEST_GOOGLE_CLIENT_ID__) || CLIENT_ID;
}

/** Seule permission demandée : le dossier privé et caché de l'application sur Google Drive (classée « non sensible » par Google). */
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
