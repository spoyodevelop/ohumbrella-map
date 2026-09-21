import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";

test("HTTP API는 수동 동기화 경로를 노출하지 않는다", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  const { app } = await import("./api.ts");
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/weather/sync`, {
      method: "POST",
    });
    assert.equal(response.status, 404);
  } finally {
    server.close();
    await once(server, "close");
  }
});
