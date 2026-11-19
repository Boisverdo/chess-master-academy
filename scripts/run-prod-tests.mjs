/** Lance toute la suite de bout en bout sur la VERSION DE PRODUCTION (compilée). */
import { spawnSync } from 'node:child_process';

const r = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], { stdio: 'inherit', shell: true, env: { ...process.env, CMA_PROD: '1' } });
process.exit(r.status ?? 1);
