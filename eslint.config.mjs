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
    // The Python pipeline's virtualenv ships bundled JavaScript (matplotlib's
    // web backend) that is not ours to lint and fails these rules. Added now
    // rather than after it breaks a build.
    ".venv/**",
    ".fastf1-cache/**",
  ]),
]);

export default eslintConfig;
