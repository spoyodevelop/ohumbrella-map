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
