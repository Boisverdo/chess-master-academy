import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

/**
 * Politique de sécurité du contenu (version de production uniquement : le serveur de
 * développement a besoin de scripts injectés). Seules les connexions vers l'application
 * elle-même, l'API publique de Chess.com et, pour la synchronisation facultative, la connexion Google
 * (Google Identity Services) et l'API Google Drive sont autorisées.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client",
  "worker-src 'self'",
  "connect-src 'self' https://api.chess.com https://lichess.org https://www.googleapis.com https://accounts.google.com/gsi/",
  "frame-src https://accounts.google.com/gsi/",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function securityHeaders(): Plugin {
  return {
    name: 'cma-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer" content="no-referrer" />`),
  };
}

/** Génère dist/sw.js avec la liste de tous les fichiers compilés (mise en cache hors ligne). */
function offlineWorker(): Plugin {
  return {
    name: 'cma-service-worker',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve('dist');
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) walk(full);
          else if (e.name !== 'sw.js' && !e.name.endsWith('.txt')) files.push(path.relative(dist, full).split(path.sep).join('/'));
        }
      };
      walk(dist);
      const hash = crypto.createHash('sha256');
      const template = fs.readFileSync('scripts/sw-template.js', 'utf8');
      hash.update(template); // une modification du service lui-même change aussi la version
      // Empreinte de chaque fichier : à la mise à jour, les fichiers inchangés sont repris du cache.
      const rev = new Map<string, string>();
      for (const f of files.sort()) {
        const content = fs.readFileSync(path.join(dist, f));
        hash.update(f).update(content);
        rev.set(f, crypto.createHash('sha256').update(content).digest('hex').slice(0, 12));
      }
      const version = `${pkg.version}-${hash.digest('hex').slice(0, 10)}`;
      const list = ['./', ...files.filter((f) => f !== 'index.html'), 'index.html'].map((f) => [f, rev.get(f === './' ? 'index.html' : f)!]);
      const sw = template.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(list, null, 1));
      fs.writeFileSync(path.join(dist, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  plugins: [react(), securityHeaders(), offlineWorker()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  base: './',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    // La base d'exercices (≈ 500 Ko, chargée seulement à la demande) dépasse le seuil d'avertissement par défaut.
    chunkSizeWarningLimit: 600,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
  },
});
