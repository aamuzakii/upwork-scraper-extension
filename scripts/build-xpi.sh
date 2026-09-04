#!/usr/bin/env sh

# Build an unsigned Firefox XPI from the compiled extension files.
# An XPI is a ZIP archive whose manifest.json must be at its root.
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
build_dir="$project_dir/dist"
artifacts_dir="$project_dir/web-ext-artifacts"
artifact="$artifacts_dir/upwork-spider-0.1.xpi"

cd "$project_dir"
yarn build

if [ ! -f "$build_dir/manifest.json" ]; then
  echo "Build failed: dist/manifest.json was not created." >&2
  exit 1
fi

mkdir -p "$artifacts_dir"
rm -f "$artifact"

# Package the *contents* of dist, so manifest.json is at the XPI root.
(
  cd "$build_dir"
  zip -q -r "$artifact" . -x '*.DS_Store'
)

if ! unzip -Z1 "$artifact" | grep -qx 'manifest.json'; then
  echo "Packaging failed: manifest.json is not at the XPI root." >&2
  exit 1
fi

unzip -t "$artifact" >/dev/null
printf 'Created and verified: %s\n' "$artifact"
