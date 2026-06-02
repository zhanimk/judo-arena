import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["src/**/*.ts", "api/src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      // `any` is intentional in Prisma JSON fields (scoreSnapshot, etc.)
      "@typescript-eslint/no-explicit-any": "off",
      // Allow underscore-prefixed unused vars/args
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      // Require-style imports allowed for lazy loading
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
