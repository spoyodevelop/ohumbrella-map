import * as Sentry from "@sentry/node";

let initialized = false;

export function initMonitoring(): void {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  Sentry.init({ dsn, tracesSampleRate: 0 });
}

export function reportServerError(error: unknown, source: string): void {
  if (!process.env.SENTRY_DSN?.trim()) return;
  Sentry.captureException(error, { tags: { source } });
}

export function reportServerWarning(message: string, source: string, details: Record<string, string | number>): void {
  if (!process.env.SENTRY_DSN?.trim()) return;
  Sentry.captureMessage(message, { level: "warning", tags: { source }, extra: details });
}

export async function flushMonitoring(): Promise<void> {
  if (!process.env.SENTRY_DSN?.trim()) return;
  await Sentry.flush(2000);
}
