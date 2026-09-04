#!/usr/bin/env sh

# Build an unsigned Firefox XPI from the compiled extension files.
# web-ext packages the contents of dist, placing manifest.json at the XPI root.
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

yarn web-ext lint --source-dir "$build_dir"
yarn web-ext build \
  --source-dir "$build_dir" \
  --artifacts-dir "$artifacts_dir" \
  --filename "$(basename "$artifact")" \
  --overwrite-dest

if ! unzip -Z1 "$artifact" | grep -qx 'manifest.json'; then
  echo "Packaging failed: manifest.json is not at the XPI root." >&2
  exit 1
fi

unzip -t "$artifact" >/dev/null
printf 'Created and validated: %s\n' "$artifact"
