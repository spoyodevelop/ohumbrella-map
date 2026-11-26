// 기상청은 가끔 1~3분 동안 모든 요청에 응답하지 않는다.
// 묶음 하나가 통째로 실패하면 그 구간으로 보고, 다음 묶음으로 넘어가지 않고
// 잠시 쉰 뒤 같은 묶음을 다시 보낸다. 끝까지 실패한 격자는 회차 끝에 한 번 더 받는다.

export interface GridCollectOptions<G> {
  chunkSize?: number;
  chunkGapMs?: number;
  outagePauseMs?: number;
  maxOutagePauses?: number;
  finalRetryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onChunkDone?: (done: number, total: number, chunk: G[]) => void;
  onOutage?: (pause: number, maxPauses: number, chunk: G[]) => void;
}

export interface GridCollectResult<G, R> {
  results: { grid: G; value: R }[];
  failed: { grid: G; error: unknown }[];
  outagePauses: number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fetchAll<G, R>(grids: G[], fetchOne: (grid: G) => Promise<R>) {
  const settled = await Promise.allSettled(grids.map((grid) => fetchOne(grid)));
  const ok: { grid: G; value: R }[] = [];
  const failed: { grid: G; error: unknown }[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") ok.push({ grid: grids[i], value: s.value });
    else failed.push({ grid: grids[i], error: s.reason });
  });
  return { ok, failed };
}

export async function collectGrids<G, R>(
  grids: G[],
  fetchOne: (grid: G) => Promise<R>,
  {
    chunkSize = 12,
    chunkGapMs = 150,
    outagePauseMs = 40_000,
    maxOutagePauses = 4,
    finalRetryDelayMs = 30_000,
    sleep = defaultSleep,
    onChunkDone,
    onOutage,
  }: GridCollectOptions<G> = {},
): Promise<GridCollectResult<G, R>> {
  const results: { grid: G; value: R }[] = [];
  let failed: { grid: G; error: unknown }[] = [];
  let outagePauses = 0;

  for (let i = 0; i < grids.length; i += chunkSize) {
    const chunk = grids.slice(i, i + chunkSize);
    let pending = chunk;
    while (true) {
      const { ok, failed: chunkFailed } = await fetchAll(pending, fetchOne);
      results.push(...ok);
      const wholeChunkFailed =
        pending.length > 0 && chunkFailed.length === pending.length;
      if (wholeChunkFailed && outagePauses < maxOutagePauses) {
        outagePauses++;
        onOutage?.(outagePauses, maxOutagePauses, pending);
        await sleep(outagePauseMs);
        pending = chunkFailed.map((f) => f.grid);
        continue;
      }
      failed.push(...chunkFailed);
      break;
    }
    onChunkDone?.(Math.min(i + chunkSize, grids.length), grids.length, chunk);
    await sleep(chunkGapMs);
  }

  if (failed.length > 0) {
    await sleep(finalRetryDelayMs);
    const retryGrids = failed.map((f) => f.grid);
    failed = [];
    for (let i = 0; i < retryGrids.length; i += chunkSize) {
      const { ok, failed: chunkFailed } = await fetchAll(
        retryGrids.slice(i, i + chunkSize),
        fetchOne,
      );
      results.push(...ok);
      failed.push(...chunkFailed);
      await sleep(chunkGapMs);
    }
  }

  return { results, failed, outagePauses };
}
