#!/usr/bin/env node

const fs = require("fs");
const { execSync } = require("child_process");

// Read local release credentials without adding a dotenv dependency.
if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in process.env) continue;
    const value = match[2].replace(/^(?:['"])(.*)(?:['"])$/, "$1");
    process.env[match[1]] = value;
  }
}

if (!process.env.AMO_API_KEY || !process.env.AMO_API_SECRET) {
  console.error("Missing AMO_API_KEY or AMO_API_SECRET in .env or environment.");
  process.exit(1);
}

const manifestPath = "manifest.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

// Increment the final numeric component (Firefox accepts two to four parts).
const parts = manifest.version.split(".").map(Number);
if (parts.length < 2 || parts.length > 4 || parts.some((part) => !Number.isInteger(part))) {
  throw new Error(`Invalid extension version: ${manifest.version}`);
}
parts[parts.length - 1] += 1;
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
