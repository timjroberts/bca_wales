import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    settings: {
      next: { rootDir: "apps/web" }
    }
  },
  {
    files: ['apps/blog/**/*.mjs'],
    rules: { '@next/next/no-location-assign-relative-destination': 'off' }
  },
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/dist/**",
    "**/.wrangler/**",
    "prototypes/**"
  ])
]);
