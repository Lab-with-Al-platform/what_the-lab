import next from "@next/eslint-plugin-next";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y";
import imports from "eslint-plugin-import";
import typescript from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";

// 기존 next/core-web-vitals + next/typescript 규칙을 native flat config로 표현합니다.
// FlatCompat의 legacy require 패치가 ESLint 9에서 실패하는 문제를 피합니다.
const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@next/next": next,
      react,
      "react-hooks": hooks,
      "jsx-a11y": a11y,
      import: imports,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.recommended.rules,
      ...hooks.configs.recommended.rules,
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unknown-property": "off",
      "react/jsx-no-target-blank": "off",
      "import/no-anonymous-default-export": "warn",
      "jsx-a11y/alt-text": ["warn", { elements: ["img"], img: ["Image"] }],
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-proptypes": "warn",
      "jsx-a11y/aria-unsupported-elements": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/role-supports-aria-props": "warn",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "@typescript-eslint": typescript },
    rules: {
      ...typescript.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
    },
  },
];

export default eslintConfig;
