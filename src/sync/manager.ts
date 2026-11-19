/**
 * Synchronisation automatique avec Google Drive.
 *
 * - Au démarrage, puis quelques secondes après chaque changement, l'appareil fusionne ses données avec la copie
 *   du dossier privé de l'application sur Google Drive, puis y envoie le résultat.
 * - L'autorisation de Google dure environ une heure. Ensuite, la synchronisation se met en pause jusqu'au
 *   prochain toucher sur « Reprendre » (Google ne redemande pas l'accord, et jamais le mot de passe à l'application).
 * - Hors ligne, rien n'est perdu : tout reste sur l'appareil et part à la synchronisation suivante.
 * - Un fichier distant illisible ou d'une version plus récente n'est jamais écrasé.
 */
import { googleClientId } from '../integrations/google/config';
import { GoogleAuthError, requestGoogleToken, revokeGoogleToken, type GoogleToken } from '../integrations/google/auth';
import { DriveError, GoogleDrive, type DriveApi } from '../integrations/google/drive';
import { db, type CmaDatabase, type SyncState } from '../storage/db';
import { onDataChange } from '../storage/events';
import { mergeIntoLocal } from './local';
import { emptySnapshot, snapshotHash, SyncFormatError, validateSnapshot } from './snapshot';

export type SyncStatus = 'unconfigured' | 'off' | 'idle' | 'syncing' | 'needs-auth' | 'offline' | 'error';

export interface SyncView {
  status: SyncStatus;
  connectedAt?: number;
  lastSyncAt?: number;
  /** Des changements de cet appareil attendent la prochaine synchronisation. */
  pending: boolean;
  message?: string;
}

export interface SyncDeps {
  db: CmaDatabase;
  clientId: () => string;
  requestToken: (clientId: string, prompt: '' | 'consent') => Promise<GoogleToken>;
  revokeToken: (token: string) => Promise<void>;
  drive: (token: string) => DriveApi;
  now: () => number;
  /** Délai entre un changement et la synchronisation (regroupe les changements rapprochés). */
  debounceMs: number;
}

export class SyncManager {
  private view: SyncView = { status: 'off', pending: false };
  private readonly listeners = new Set<(v: SyncView) => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private applying = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  constructor(private readonly deps: SyncDeps) {}

  get state(): SyncView {
    return this.view;
  }

  subscribe(fn: (v: SyncView) => void): () => void {
    this.listeners.add(fn);
    fn(this.view);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<SyncView>): void {
    this.view = { ...this.view, ...patch };
    if (!('message' in patch) && patch.status && patch.status !== 'error' && patch.status !== 'offline') this.view.message = undefined;
    for (const fn of this.listeners) fn(this.view);
  }

  private row(): Promise<SyncState | undefined> {
    return this.deps.db.sync.get('google');
  }

  /** Démarrage de l'application : reprend la synchronisation si elle est active sur cet appareil. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    onDataChange(() => this.changed());
    await this.refresh();
    if (this.view.status === 'idle') await this.syncNow();
  }

  /** Relit l'état (après « Tout effacer », par exemple). */
  async refresh(): Promise<void> {
    if (!this.deps.clientId()) return this.set({ status: 'unconfigured' });
    const row = await this.row();
    if (!row) return this.set({ status: 'off', connectedAt: undefined, lastSyncAt: undefined, pending: false });
    const valid = !!row.token && (row.tokenExpiresAt ?? 0) > this.deps.now();
    this.set({ status: valid ? 'idle' : 'needs-auth', connectedAt: row.connectedAt, lastSyncAt: row.lastSyncAt });
  }

  /** Première liaison (à la suite d'un geste) : fenêtre de Google, puis première synchronisation. */
  async connect(): Promise<void> {
    await this.authorize('consent', true);
  }

  /** Après expiration de l'autorisation (à la suite d'un geste) : nouvelle autorisation sans redemander l'accord. */
  async resume(): Promise<void> {
    await this.authorize('', false);
  }

  private async authorize(prompt: '' | 'consent', first: boolean): Promise<void> {
    const clientId = this.deps.clientId();
    if (!clientId) return this.set({ status: 'unconfigured' });
    try {
      const t = await this.deps.requestToken(clientId, prompt);
      const prev = await this.row();
      await this.deps.db.sync.put({ ...(prev ?? {}), id: 'google', connectedAt: prev?.connectedAt ?? this.deps.now(), token: t.token, tokenExpiresAt: t.expiresAt });
      this.set({ status: 'syncing', connectedAt: prev?.connectedAt ?? this.deps.now() });
    } catch (e) {
      const msg = e instanceof GoogleAuthError ? e.message : 'La connexion à Google a échoué.';
      this.set(first && !(await this.row()) ? { status: 'off', message: msg } : { status: 'needs-auth', message: msg });
      return;
    }
    await this.syncNow();
  }

  /** Un changement local : synchronisation différée (ou mise en attente si l'autorisation a expiré). */
  private changed(): void {
    if (this.applying) return;
    if (this.view.status === 'off' || this.view.status === 'unconfigured') return;
    this.set({ pending: true });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.syncNow();
    }, this.deps.debounceMs);
  }

  /** Synchronise maintenant (une seule à la fois ; une demande pendant une synchronisation en relance une après). */
  async syncNow(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        await this.once();
      } while (this.again && this.view.status === 'idle');
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async once(): Promise<void> {
    const row = await this.row();
    if (!row) return this.set({ status: this.deps.clientId() ? 'off' : 'unconfigured' });
    if (!row.token || (row.tokenExpiresAt ?? 0) <= this.deps.now()) return this.set({ status: 'needs-auth' });
    this.set({ status: 'syncing', pending: false });
    const drive = this.deps.drive(row.token);
    try {
      let fileId = row.fileId;
      let remoteRaw: unknown = null;
      if (fileId) {
        try {
          remoteRaw = await drive.download(fileId);
        } catch (e) {
          if (!(e instanceof DriveError && e.kind === 'missing')) throw e;
          fileId = undefined;
        }
      }
      if (!fileId) {
        const found = await drive.find();
        fileId = found?.id;
        remoteRaw = found ? await drive.download(found.id) : null;
      }
      const remote = remoteRaw === null ? emptySnapshot() : validateSnapshot(remoteRaw);

      this.applying = true;
      let merged;
      try {
        ({ merged } = await mergeIntoLocal(remote, this.deps.db));
      } finally {
        this.applying = false;
      }
      if (!fileId) fileId = (await drive.create(merged)).id;
      else if (snapshotHash(merged) !== snapshotHash(remote)) await drive.update(fileId, merged);

      const now = this.deps.now();
      const latest = await this.row();
      if (!latest) return this.set({ status: 'off' }); // délié pendant la synchronisation
      await this.deps.db.sync.put({ ...latest, fileId, lastSyncAt: now });
      this.set({ status: 'idle', lastSyncAt: now });
    } catch (e) {
      this.applying = false;
      this.set({ pending: true });
      if (e instanceof DriveError && e.kind === 'auth') {
        const latest = await this.row();
        if (latest) await this.deps.db.sync.put({ ...latest, token: undefined, tokenExpiresAt: undefined });
        return this.set({ status: 'needs-auth', message: e.message });
      }
      if (e instanceof DriveError && e.kind === 'offline') return this.set({ status: 'offline', message: e.message });
      const message = e instanceof DriveError || e instanceof SyncFormatError ? e.message : `Synchronisation interrompue : ${e instanceof Error ? e.message : String(e)}`;
      this.set({ status: 'error', message });
    }
  }

  /** Délie cet appareil. Si demandé, supprime aussi la copie sur Google Drive (les autres appareils gardent leurs données). */
  async disconnect(deleteRemote: boolean): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    const row = await this.row();
    let message: string | undefined;
    if (row?.token && (row.tokenExpiresAt ?? 0) > this.deps.now()) {
      try {
        if (deleteRemote) {
          const drive = this.deps.drive(row.token);
          const id = row.fileId ?? (await drive.find())?.id;
          if (id) await drive.remove(id);
        }
        await this.deps.revokeToken(row.token);
      } catch (e) {
        if (deleteRemote) {
          this.set({ status: 'error', message: `La copie sur Google Drive n’a pas pu être supprimée : ${e instanceof Error ? e.message : String(e)}` });
          return;
        }
      }
    } else if (deleteRemote) {
      message = 'Reconnecte-toi d’abord à Google pour supprimer la copie sur Google Drive.';
      this.set({ status: 'needs-auth', message });
      return;
    }
    await this.deps.db.sync.delete('google');
    this.set({ status: 'off', connectedAt: undefined, lastSyncAt: undefined, pending: false, message: deleteRemote ? 'Cet appareil est délié et la copie sur Google Drive est supprimée.' : 'Cet appareil est délié. La copie sur Google Drive est conservée.' });
  }
}

let instance: SyncManager | null = null;

/** Gestionnaire de l'application (dépendances réelles : Google, IndexedDB). */
export function getSyncManager(): SyncManager {
  instance ??= new SyncManager({
    db,
    clientId: googleClientId,
    requestToken: requestGoogleToken,
    revokeToken: revokeGoogleToken,
    drive: (token) => new GoogleDrive(token),
    now: () => Date.now(),
    debounceMs: 8000,
  });
  return instance;
}
