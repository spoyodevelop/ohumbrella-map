import dotenv from "dotenv";
import { resolve } from "node:path";
import { app } from "./api.ts";
import { initDb } from "./db.ts";
import "./worker.ts";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

(async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`=============================================`);
      console.log(
        `🚀 [통합 서버] API 서버 + 워커 통합 구동 완료! http://localhost:${PORT}`,
      );
      console.log(`=============================================`);
    });
  } catch (err) {
    console.error("❌ [통합 서버 시작 실패] DB 초기화 에러:", err);
    process.exit(1);
  }
})();
