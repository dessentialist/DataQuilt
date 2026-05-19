module.exports = {
  env: {
    browser: true,
    es2023: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:import/recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  ignorePatterns: ["dist", "node_modules"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["react", "react-hooks", "@typescript-eslint", "import"],
  rules: {
    "react/react-in-jsx-scope": "off",
    "import/no-unresolved": "off",
    "@typescript-eslint/no-explicit-any": "off",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
