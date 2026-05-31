module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    // `any` is intentional in Prisma JSON fields (scoreSnapshot, etc.) — disable globally
    "@typescript-eslint/no-explicit-any": "off",
    // Unused vars: allow underscore-prefixed names
    "@typescript-eslint/no-unused-vars": ["warn", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
    }],
    // Require-style imports: off (used for lazy S3 loading)
    "@typescript-eslint/no-require-imports": "off",
  },
  ignorePatterns: ["dist", "node_modules"],
};
