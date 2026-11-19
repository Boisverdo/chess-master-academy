/** Moteur du navigateur : Stockfish 19 lite (WebAssembly) dans un Web Worker. Chargé à la demande. */
import { Engine, type UciTransport } from './engine';

const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`;

function workerTransport(): UciTransport {
  const worker = new Worker(ENGINE_URL);
  const listeners: ((l: string) => void)[] = [];
  worker.onmessage = (e: MessageEvent) => {
    const data = String(e.data);
    for (const line of data.split('\n')) if (line) listeners.forEach((fn) => fn(line));
  };
  return {
    send: (c) => worker.postMessage(c),
    onLine: (fn) => listeners.push(fn),
    terminate: () => worker.terminate(),
  };
}

let instance: Engine | null = null;
let failed: string | null = null;

/** Moteur partagé de l'application (une seule instance). */
export async function getEngine(): Promise<Engine> {
  if (failed) throw new Error(failed);
  if (!instance) {
    try {
      instance = new Engine(workerTransport());
      await instance.init();
    } catch (e) {
      instance?.terminate();
      instance = null;
      failed = `Le moteur d’analyse n’a pas pu démarrer (${e instanceof Error ? e.message : String(e)}). Les leçons et exercices restent disponibles.`;
      throw new Error(failed);
    }
  }
  return instance;
}
