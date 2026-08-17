import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = import.meta.dirname;
const output = resolve(root, "dist");
const rumah123Script = resolve(root, "content/rumah123.js");

function copyExtensionFiles() {
  return {
    name: "copy-extension-files",
    writeBundle() {
      mkdirSync(resolve(output, "content"), { recursive: true });

      const manifest = JSON.parse(
        readFileSync(resolve(root, "manifest.json"), "utf8"),
      );
      const rumah123Entry = manifest.content_scripts.find((entry) =>
        entry.js?.includes("dist/content/rumah123.js"),
      );
      if (rumah123Entry) {
        rumah123Entry.js = ["content/rumah123.js"];
      }
      writeFileSync(
        resolve(output, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
      cpSync(resolve(root, "green.png"), resolve(output, "green.png"));
      cpSync(resolve(root, "alo.png"), resolve(output, "alo.png"));
      cpSync(resolve(root, "service-worker.js"), resolve(output, "service-worker.js"));
      cpSync(resolve(root, "content"), resolve(output, "content"), {
        recursive: true,
        filter: (source) => source !== rumah123Script,
      });
    },
  };
}

export default defineConfig({
  plugins: [copyExtensionFiles()],
  build: {
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    lib: {
      entry: rumah123Script,
      formats: ["iife"],
      name: "Rumah123ContentScript",
      fileName: () => "content/rumah123",
    },
    rollupOptions: {
      output: {
        entryFileNames: "content/rumah123.js",
      },
    },
  },
});
