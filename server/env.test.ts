import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadServerEnv, requireKmaServiceKey, requireTursoAuthToken, requireTursoDatabaseUrl } from "./env.ts";

test("환경 변수는 프로세스, .env.local, .env 순서로 우선하고 한 번만 읽는다", () => {
  const root = mkdtempSync(join(tmpdir(), "ohumbrella-env-"));
  const processKey = "OHUMBRELLA_ENV_TEST_PROCESS";
  const localKey = "OHUMBRELLA_ENV_TEST_LOCAL";
  const baseKey = "OHUMBRELLA_ENV_TEST_BASE";
  try {
    writeFileSync(join(root, ".env.local"), `${processKey}=local\n${localKey}=local\n`);
    writeFileSync(join(root, ".env"), `${localKey}=base\n${baseKey}=base\n`);
    process.env[processKey] = "process";

    loadServerEnv(root);
    assert.equal(process.env[processKey], "process");
    assert.equal(process.env[localKey], "local");
    assert.equal(process.env[baseKey], "base");

    writeFileSync(join(root, ".env.local"), `${localKey}=changed\n`);
    loadServerEnv(root);
    assert.equal(process.env[localKey], "local");
  } finally {
    delete process.env[processKey];
    delete process.env[localKey];
    delete process.env[baseKey];
    rmSync(root, { recursive: true, force: true });
  }
});

test("기상청 인증키가 없거나 공백이면 서버 시작용 검증에서 실패한다", () => {
  const previous = process.env.KMA_SERVICE_KEY;
  try {
    delete process.env.KMA_SERVICE_KEY;
    assert.throws(requireKmaServiceKey, /KMA_SERVICE_KEY/);
    process.env.KMA_SERVICE_KEY = "  ";
    assert.throws(requireKmaServiceKey, /KMA_SERVICE_KEY/);
    process.env.KMA_SERVICE_KEY = " test-key ";
    assert.equal(requireKmaServiceKey(), "test-key");
  } finally {
    if (previous === undefined) delete process.env.KMA_SERVICE_KEY;
    else process.env.KMA_SERVICE_KEY = previous;
  }
});

test("DB 주소가 없거나 공백이면 모든 환경에서 실패한다", () => {
  const previous = process.env.TURSO_DATABASE_URL;
  try {
    delete process.env.TURSO_DATABASE_URL;
    assert.throws(requireTursoDatabaseUrl, /TURSO_DATABASE_URL/);
    process.env.TURSO_DATABASE_URL = "  ";
    assert.throws(requireTursoDatabaseUrl, /TURSO_DATABASE_URL/);
    process.env.TURSO_DATABASE_URL = " file::memory: ";
    assert.equal(requireTursoDatabaseUrl(), "file::memory:");
  } finally {
    if (previous === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = previous;
  }
});

test("원격 DB 주소에는 인증 토큰이 필요하고 명시적 SQLite 주소에는 필요하지 않다", () => {
  const previous = process.env.TURSO_AUTH_TOKEN;
  try {
    delete process.env.TURSO_AUTH_TOKEN;
    assert.equal(requireTursoAuthToken("file::memory:"), undefined);
    assert.throws(() => requireTursoAuthToken("libsql://example.turso.io"), /TURSO_AUTH_TOKEN/);
    process.env.TURSO_AUTH_TOKEN = " token ";
    assert.equal(requireTursoAuthToken("libsql://example.turso.io"), "token");
  } finally {
    if (previous === undefined) delete process.env.TURSO_AUTH_TOKEN;
    else process.env.TURSO_AUTH_TOKEN = previous;
  }
});
