import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Pins the timezone so Intl-based formatting (utils.ts's formatDate) and
    // local-time date math (validations/reservation.ts's getTodayLocalDateStr)
    // are deterministic regardless of the machine running the suite.
    env: { TZ: "UTC" },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/test/**", "src/lib/types/**"],
    },
  },
});
