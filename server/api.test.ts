import assert from "node:assert/strict";
import { test } from "node:test";

test("서버 설정 오류의 상세 내용을 500 응답에 노출하지 않는다", async () => {
  const previousDsn = process.env.SENTRY_DSN;
  const previousDbUrl = process.env.TURSO_DATABASE_URL;
  process.env.SENTRY_DSN = "";
  process.env.TURSO_DATABASE_URL = "file::memory:";
  const { app } = await import("./api.ts");
  const previousId = process.env.NAVER_CLIENT_ID;
  const previousViteId = process.env.VITE_NAVER_CLIENT_ID;
  const previousSecret = process.env.NAVER_CLIENT_SECRET;
  delete process.env.NAVER_CLIENT_ID;
  delete process.env.VITE_NAVER_CLIENT_ID;
  delete process.env.NAVER_CLIENT_SECRET;

  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/gc?coords=127,37`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "서버 내부 오류가 발생했습니다." });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previousId === undefined) delete process.env.NAVER_CLIENT_ID;
    else process.env.NAVER_CLIENT_ID = previousId;
    if (previousViteId === undefined) delete process.env.VITE_NAVER_CLIENT_ID;
    else process.env.VITE_NAVER_CLIENT_ID = previousViteId;
    if (previousSecret === undefined) delete process.env.NAVER_CLIENT_SECRET;
    else process.env.NAVER_CLIENT_SECRET = previousSecret;
    if (previousDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = previousDsn;
    if (previousDbUrl === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = previousDbUrl;
  }
});
