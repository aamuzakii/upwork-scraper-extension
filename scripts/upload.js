#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const artifactsDir = path.join(__dirname, "..", "web-ext-artifacts");

let artifacts;
try {
  artifacts = fs
    .readdirSync(artifactsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".xpi"))
    .map((entry) => {
      const filePath = path.join(artifactsDir, entry.name);
      return { filePath, modifiedAt: fs.statSync(filePath).mtimeMs };
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

if (!artifacts || artifacts.length === 0) {
  console.error(`No .xpi artifacts found in ${artifactsDir}. Run the release command first.`);
  process.exit(1);
}

const artifact = artifacts[0].filePath;
console.log(`Uploading ${path.basename(artifact)} to aamzk:/Extension/`);

const result = spawnSync("rclone", ["copy", artifact, "aamzk:/Extension/"], {
  stdio: "inherit",
});

if (result.error) {
  console.error(`Could not start rclone: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
