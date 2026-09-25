import { createClient, type Client } from "@libsql/client";
import { loadServerEnv, requireTursoAuthToken, requireTursoDatabaseUrl } from "./env.ts";
import { flushMonitoring, initMonitoring, reportServerError } from "./monitoring.ts";

loadServerEnv();

let client: Client;
try {
  const url = requireTursoDatabaseUrl();
  client = createClient({
    url,
    authToken: requireTursoAuthToken(url),
  });
} catch (error) {
  initMonitoring();
  reportServerError(error, "server.startup");
  await flushMonitoring();
  throw error;
}

export const db = client;

const requiredObjects = [
  "weather_observations",
  "weather_forecasts",
  "hourly_weather",
  "current_weather",
  "forecast_verifications",
  "verified_accuracy_stats",
  "trg_verifications_insert",
  "trg_verifications_update",
  "trg_verifications_delete",
];

export async function assertDbReady(): Promise<void> {
  const result = await db.execute("SELECT name FROM sqlite_master WHERE type IN ('table', 'trigger')");
  const present = new Set(result.rows.map((row) => String(row.name)));
  const missing = requiredObjects.filter((name) => !present.has(name));
  if (missing.length > 0) {
    throw new Error(`DB 마이그레이션이 필요합니다: ${missing.join(", ")}`);
  }
}
