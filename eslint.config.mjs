import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Editors resync local form state from props and restore UI prefs from
    // localStorage inside effects on purpose. Keep these visible as warnings.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Tailwind 3 config is CommonJS.
    files: ["tailwind.config.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
