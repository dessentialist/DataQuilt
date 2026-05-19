// Minimal ESLint flat config to make linting deterministic across machines
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  js.configs.recommended,
  { ignores: ["server/storage.ts"] },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      // Merge and sanitize global names to avoid accidental whitespace issues
      globals: (() => {
        const merge = Object.assign({}, globals.browser, globals.node);
        const out = {};
        for (const key of Object.keys(merge)) {
          out[key.trim()] = merge[key];
        }
        return out;
      })(),
    },
    plugins: { "@typescript-eslint": tseslint, react: reactPlugin, "react-hooks": reactHooks },
    rules: {
      // TypeScript already checks for undefined vars; avoid false positives on DOM globals
      "no-undef": "off",
      "no-useless-catch": "off",
      // Re-enabled 2026-05 as `warn` (was `off`) so unused code is surfaced without blocking CI.
      // Allow leading underscore to mark intentionally-unused parameters/destructured fields.
      "no-unused-vars": "off", // delegated to the TS-aware rule below
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  prettier,
];
