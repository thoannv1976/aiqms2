import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma client sinh tự động.
    "src/generated/**",
    // Script dev (sinh tài liệu, seed demo, chụp ảnh) — không thuộc mã ứng dụng.
    "scripts/**",
  ]),
  {
    // Frontend: pattern fetch-trong-effect là cố ý và an toàn (có cờ huỷ/loading).
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
]);

export default eslintConfig;
