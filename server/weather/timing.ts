export type TimingReporter = (name: string, durationMs: number) => void;

export async function timedQuery<T>(
  name: string,
  reportTiming: TimingReporter | undefined,
  query: () => Promise<T>,
): Promise<T> {
  if (!reportTiming) return query();

  const startedAt = performance.now();
  try {
    return await query();
  } finally {
    reportTiming(name, performance.now() - startedAt);
  }
}
