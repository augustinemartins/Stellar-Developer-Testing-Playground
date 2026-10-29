import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "apps/web/public/monaco/**",
      "apps/web/next-env.d.ts",
      "contracts/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
    },
  },
  // Next.js, React, hooks and accessibility rules for the web app only.
  ...nextVitals.map((c) => ({
    ...c,
    files: ["apps/web/**/*.{ts,tsx,js,mjs}"],
    settings: { ...c.settings, next: { rootDir: "apps/web/" } },
  })),
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["**/test/**", "**/*.test.{ts,tsx}", "tests/**", "e2e/**"],
    languageOptions: { globals: { ...globals.vitest } },
  },
);
