const typescript = require("@rollup/plugin-typescript");

/** @type {import('rollup').RollupOptions} */
const config = {
  input: "src/short.ts",
  output: {
    file: "dist/script-short.js",
    format: "iife",
  },
  plugins: [typescript()],
};

module.exports = config;
