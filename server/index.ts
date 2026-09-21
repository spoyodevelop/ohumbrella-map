import { app } from "./api.ts";
import { initDb } from "./db.ts";
import { startWorker } from "./worker.ts";
import { loadServerEnv, requireKmaServiceKey } from "./env.ts";
import { flushMonitoring, reportServerError } from "./monitoring.ts";

loadServerEnv();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

(async () => {
  try {
    requireKmaServiceKey();
    await initDb();
    app.listen(PORT, () => {
      startWorker();
      console.log(`=============================================`);
      console.log(
        `🚀 [통합 서버] API 서버 + 워커 통합 구동 완료! http://localhost:${PORT}`,
      );
      console.log(`=============================================`);
    });
  } catch (err) {
    console.error("❌ [통합 서버 시작 실패]", err);
    reportServerError(err, "server.startup");
    await flushMonitoring();
    process.exit(1);
  }
})();
