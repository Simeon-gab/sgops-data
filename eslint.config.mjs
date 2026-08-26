import coreWebVitals from "eslint-config-next/core-web-vitals";

// Flat config, required by ESLint 9. `next lint` was removed in Next 16, so
// this is driven by `eslint` directly through `npm run lint`.

const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "**/*.tsbuildinfo"],
  },

  ...coreWebVitals,

  {
    rules: {
      // console.log is a debugging leftover; the other two are deliberate.
      "no-console": ["warn", { allow: ["error", "warn"] }],

      // Next 16 ships the React Compiler era hook rules, which treat the
      // ordinary "fetch on mount, then setState" pattern as an error. This
      // codebase uses it in every data hook and panel. The rule has a real
      // point about cascading renders, but acting on it means restructuring
      // data fetching across the app, so it stays visible as a warning rather
      // than either failing the build or being switched off and forgotten.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },

  {
    // Tests print their own progress and reach for loose shapes when standing
    // in for database rows.
    files: ["tests/**/*.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default config;
