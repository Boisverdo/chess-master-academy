/**
 * Accès au dossier privé de l'application sur Google Drive (« appDataFolder ») par l'API officielle Drive v3.
 * Ce dossier est caché : il n'apparaît pas dans Google Drive, et l'application ne voit aucun autre fichier.
 * Un seul fichier y est stocké : l'instantané de synchronisation.
 */
export const SYNC_FILE_NAME = 'chess-master-academy-sync.json';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
/** Taille maximale acceptée au téléchargement (garde-fou). */
const MAX_BYTES = 40_000_000;

export class DriveError extends Error {
  constructor(
    message: string,
    /** `auth` : jeton expiré ou retiré ; `offline` : pas de réseau ; `quota` : limite de Google ; `missing` : fichier absent ; `other`. */
    readonly kind: 'auth' | 'offline' | 'quota' | 'missing' | 'other',
  ) {
    super(message);
  }
}

export interface DriveFile {
  id: string;
  modifiedTime?: string;
}

export interface DriveApi {
  find(): Promise<DriveFile | null>;
  download(id: string): Promise<unknown>;
  create(content: unknown): Promise<DriveFile>;
  update(id: string, content: unknown): Promise<DriveFile>;
  remove(id: string): Promise<void>;
}

export class GoogleDrive implements DriveApi {
  constructor(
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
    private readonly wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  /** Requête avec nouvelles tentatives espacées en cas de limite (429) ou d'erreur passagère de Google (5xx). */
  private async call(url: string, init: RequestInit = {}): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetchImpl(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${this.token}` } });
      } catch {
        throw new DriveError('Pas de connexion Internet : la synchronisation reprendra plus tard.', 'offline');
      }
      if (res.ok) return res;
      if (res.status === 401) throw new DriveError('L’autorisation Google a expiré.', 'auth');
      if (res.status === 404) throw new DriveError('Le fichier de synchronisation n’existe plus sur Google Drive.', 'missing');
      const retryable = res.status === 429 || res.status >= 500 || (res.status === 403 && /rate|quota/i.test(await res.clone().text()));
      if (retryable && attempt < 3) {
        await this.wait(1000 * 2 ** attempt);
        continue;
      }
      if (res.status === 403) {
        const body = await res.text();
        if (/insufficient|scope|permission/i.test(body)) throw new DriveError('L’accès au dossier de l’application sur Google Drive n’a pas été accordé.', 'auth');
        throw new DriveError('Google Drive limite temporairement les accès : nouvel essai plus tard.', 'quota');
      }
      if (retryable) throw new DriveError('Google Drive ne répond pas pour le moment : nouvel essai plus tard.', 'quota');
      throw new DriveError(`Google Drive a refusé la demande (code ${res.status}).`, 'other');
    }
  }

  async find(): Promise<DriveFile | null> {
    const q = encodeURIComponent(`name = '${SYNC_FILE_NAME}' and trashed = false`);
    const res = await this.call(`${API}?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc&pageSize=10`);
    const data = (await res.json()) as { files?: DriveFile[] };
    return data.files?.[0] ?? null;
  }

  async download(id: string): Promise<unknown> {
    const res = await this.call(`${API}/${encodeURIComponent(id)}?alt=media`);
    const size = Number(res.headers.get('content-length') ?? 0);
    if (size > MAX_BYTES) throw new DriveError('Le fichier de synchronisation est anormalement volumineux.', 'other');
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new DriveError('Le fichier de synchronisation est anormalement volumineux.', 'other');
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new DriveError('Le fichier de synchronisation sur Google Drive est endommagé.', 'other');
    }
  }

  async create(content: unknown): Promise<DriveFile> {
    const boundary = `cma${Math.random().toString(36).slice(2)}`;
    const meta = JSON.stringify({ name: SYNC_FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(content)}\r\n--${boundary}--`;
    const res = await this.call(`${UPLOAD}?uploadType=multipart&fields=id,modifiedTime`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
    return (await res.json()) as DriveFile;
  }

  async update(id: string, content: unknown): Promise<DriveFile> {
    const res = await this.call(`${UPLOAD}/${encodeURIComponent(id)}?uploadType=media&fields=id,modifiedTime`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) });
    return (await res.json()) as DriveFile;
  }

  async remove(id: string): Promise<void> {
    await this.call(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}
