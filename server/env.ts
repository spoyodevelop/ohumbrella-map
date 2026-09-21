import dotenv from "dotenv";
import { resolve } from "node:path";

let loaded = false;

export function loadServerEnv(root = process.cwd()): void {
  if (loaded) return;

  // 기존 프로세스 환경 변수 > .env.local > .env 순서로 우선한다.
  dotenv.config({ path: resolve(root, ".env.local"), quiet: true });
  dotenv.config({ path: resolve(root, ".env"), quiet: true });
  loaded = true;
}

export function requireKmaServiceKey(): string {
  const key = process.env.KMA_SERVICE_KEY?.trim();
  if (!key) throw new Error("KMA_SERVICE_KEY 환경 변수가 필요합니다.");
  return key;
}

export function requireTursoDatabaseUrl(): string {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) throw new Error("TURSO_DATABASE_URL 환경 변수가 필요합니다.");
  return url;
}
