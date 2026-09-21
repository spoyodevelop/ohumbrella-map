import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadServerEnv } from "./env.ts";

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
