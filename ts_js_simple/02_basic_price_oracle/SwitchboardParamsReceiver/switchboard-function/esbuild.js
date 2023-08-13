#!/usr/bin/env node
/* eslint node/no-unpublished-require: 0 */
/* eslint no-unused-vars: 0 */
const { build } = require("esbuild");
const path = require("node:path");
const fs = require("node:fs");
const { execSync } = require("node:child_process");

const commonOptions = {
  bundle: true,
  minify: true,
  platform: "node",
  sourcemap: "inline",
  treeShaking: true,
  sourcesContent: true,
  target: "node18",
  plugins: [],
  legalComments: "none",
};

fs.rmSync(path.join(__dirname, "dist"), {
  force: true,
  recursive: true,
});

// check if ./src/config.js exists
const cfgExists = fs.existsSync(path.join(__dirname, "src/config.js"));

// if so, run it
if (cfgExists) {
  const config = require("./src/config.js");

  // write it to ./src/lib/config.json
  fs.writeFileSync(
    path.join(__dirname, "src/lib/config.json"),
    JSON.stringify(config, null, 2),
    "utf-8"
  );
}

// if ./src/lib/config.json exists
const cfgJsonExists = fs.existsSync(path.join(__dirname, "src/config.json"));

// copy it to ./src/lib/config.json
if (cfgJsonExists) {
  fs.copyFileSync(
    path.join(__dirname, "src/config.json"),
    path.join(__dirname, "src/lib/config.json"),
    fs.constants.COPYFILE_FICLONE_FORCE
  );
}

build({
  ...commonOptions,
  format: "cjs",
  entryPoints: ["./src/lib/index.ts"],
  outfile: "dist/index.js",
})
  .then(({ metafile }) => {
    if (metafile && !isCI) {
      // analyze bundle size at https://esbuild.github.io/analyze/
      fs.writeFileSync(
        "dist/meta.json",
        JSON.stringify(metafile, null, 2),
        "utf-8"
      );
    }
  })
  .then(() => {
    execSync(`./node_modules/typescript/bin/tsc -d`, { encoding: "utf-8" });
  });
