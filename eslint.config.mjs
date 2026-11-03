import nextVitals from "eslint-config-next/core-web-vitals"

const config = [
  ...nextVitals,
  { ignores: [".next/**", "node_modules/**", "previews/**"] },
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      eqeqeq: ["error", "smart"],
      "no-eval": "error",
      "no-implied-eval": "error",
    },
  },
]

export default config
