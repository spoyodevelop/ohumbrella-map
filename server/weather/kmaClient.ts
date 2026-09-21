interface KmaApiResponse<T> {
  response?: {
    header?: {
      resultCode: string;
      resultMsg: string;
    };
    body?: {
      items?: {
        item?: T[];
      };
    };
  };
}

export type KmaFetchResult<T> =
  | { kind: "items"; items: T[] }
  | { kind: "no-data" };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchKmaWithRetry<T>(
  url: string,
  maxTries = 3,
  initialDelay = 400,
  fetchImpl: typeof fetch = fetch,
): Promise<KmaFetchResult<T>> {
  let delay = initialDelay;
  let lastError: unknown;

  for (let tries = 1; tries <= maxTries; tries++) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      const data = (await response.json()) as KmaApiResponse<T>;
      const header = data?.response?.header;
      if (!header) {
        throw new Error("응답 헤더 없음");
      }

      if (header.resultCode === "03") {
        return { kind: "no-data" };
      }
      if (header.resultCode !== "00") {
        throw new Error(`[${header.resultCode}] ${header.resultMsg}`);
      }

      const items = data.response?.body?.items?.item;
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("정상 응답에 항목 없음");
      }
      return { kind: "items", items };
    } catch (error) {
      lastError = error;
      if (tries < maxTries) {
        await sleep(delay);
        delay *= 2;
      }
    }
  }

  throw new Error(`KMA 요청 ${maxTries}회 실패`, { cause: lastError });
}
