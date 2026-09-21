export function createWorkerQueue(onError: (error: unknown) => void) {
  const pending = new Map<string, () => Promise<void>>();
  let running = false;

  return async function enqueue(key: string, task: () => Promise<void>): Promise<void> {
    // 같은 회차가 대기 중이면 가장 최근 예약 실행으로 교체한다.
    pending.set(key, task);
    if (running) return;

    running = true;
    try {
      while (pending.size > 0) {
        const [nextKey, nextTask] = pending.entries().next().value!;
        pending.delete(nextKey);
        try {
          await nextTask();
        } catch (error) {
          onError(error);
        }
      }
    } finally {
      running = false;
    }
  };
}
