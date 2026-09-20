import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      babel({
        presets: [reactCompilerPreset()],
      }),
    ],
    build: {
      target: "baseline-widely-available",
    },
    server: {
      proxy: {
        "/api/gc": {
          target: "https://naveropenapi.apigw.ntruss.com",
          changeOrigin: true,
          rewrite: (path) =>
            path.replace(/^\/api\/gc/, "/map-reversegeocode/v2/gc"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader(
                "X-NCP-APIGW-API-KEY-ID",
                env.VITE_NAVER_CLIENT_ID ?? "",
              );
              proxyReq.setHeader(
                "X-NCP-APIGW-API-KEY",
                env.NAVER_CLIENT_SECRET ?? "",
              );
            });
          },
        },
        "/api/weather": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
  };
});
