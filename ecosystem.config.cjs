module.exports = {
  apps: [
    {
      name: "ohumbrella-server",
      script: "server/index.ts",
      interpreter: "./node_modules/.bin/tsx",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },

      // 🕒 [로그 핵심 설정]
      time: true, // 모든 로그 앞에 타임스탬프 자동 부착
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/server-error.log", // 에러 로그(stderr) 분리 저장
      out_file: "./logs/server-out.log",     // 일반 로그(stdout) 분리 저장
      merge_logs: true,                     // 클러스터/재시작 시 로그 병합
    },
  ],
};
