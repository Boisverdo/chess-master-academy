import { useEffect, useState } from 'react';
import { onDataChange } from '../storage/events';

/** Charge des données asynchrones et les recharge à chaque modification des données du joueur. */
export function useData<T>(load: () => Promise<T>, deps: readonly unknown[] = []): { data: T | undefined; error: string | null } {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const run = () =>
      load().then(
        (v) => alive && (setData(v), setError(null)),
        (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
      );
    run();
    const off = onDataChange(run);
    return () => {
      alive = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error };
}
