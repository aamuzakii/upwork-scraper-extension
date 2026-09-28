#!/usr/bin/env node

const fs = require("fs");
const { execSync } = require("child_process");

const manifestPath = "manifest.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

// bump patch version
const parts = manifest.version.split(".").map(Number);
parts[2] += 1;
manifest.version = parts.join(".");

fs.writeFileSync(
  manifestPath,
  JSON.stringify(manifest, null, 2) + "\n"
);

console.log(`Version bumped to ${manifest.version}`);

execSync("yarn build", { stdio: "inherit" });

execSync(
  `yarn web-ext sign \
    --source-dir dist \
    --channel=unlisted \
    --api-key="${process.env.AMO_API_KEY}" \
    --api-secret="${process.env.AMO_API_SECRET}"`,
  { stdio: "inherit", shell: true }
);