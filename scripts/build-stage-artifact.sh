#!/usr/bin/env bash
set -euo pipefail

ARTIFACTS_DIR="${1:-out/artifacts}"
OUTPUT_DIR="${2:-out/pear-stage}"
PACKAGE_JSON_PATH="${PACKAGE_JSON_PATH:-package.json}"
CHANNEL="${CHANNEL:?CHANNEL is required}"
BUILD_VERSION="${BUILD_VERSION:-}"

case "$CHANNEL" in
  nightly|internal|production)
    PRODUCT_NAME="Pear"
    ;;
  *)
    echo "Unsupported CHANNEL: $CHANNEL" >&2
    exit 1
    ;;
esac

TMP_DIR="$(mktemp -d)"
NORMALIZED_DIR="$TMP_DIR/normalized"
PACKAGE_OUT="$TMP_DIR/package.json"

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

mkdir -p \
  "$NORMALIZED_DIR/darwin-arm64" \
  "$NORMALIZED_DIR/darwin-x64" \
  "$NORMALIZED_DIR/linux-arm64" \
  "$NORMALIZED_DIR/linux-x64" \
  "$NORMALIZED_DIR/win32-x64"

rm -rf "$OUTPUT_DIR"

find_one () {
  local name="$1"
  find "$ARTIFACTS_DIR" -type f -name "$name" | sort | head -n 1
}

DARWIN_ARM64_ZIP="$(find_one "${PRODUCT_NAME}-darwin-arm64.zip")"
DARWIN_X64_ZIP="$(find_one "${PRODUCT_NAME}-darwin-x64.zip")"
LINUX_ARM64_APPIMAGE="$(find_one "${PRODUCT_NAME}-linux-arm64.AppImage")"
LINUX_X64_APPIMAGE="$(find_one "${PRODUCT_NAME}-linux-x64.AppImage")"
WINDOWS_MSIX="$(find_one "${PRODUCT_NAME}-win32-x64.msix")"

require () {
  local var="$1"
  local hint="$2"
  if [ -z "${!var}" ]; then
    echo "Missing $hint in $ARTIFACTS_DIR (var=$var)" >&2
    exit 1
  fi
}

require DARWIN_ARM64_ZIP     "darwin-arm64 ${PRODUCT_NAME}.zip"
require DARWIN_X64_ZIP       "darwin-x64 ${PRODUCT_NAME}.zip"
require LINUX_ARM64_APPIMAGE "linux-arm64 ${PRODUCT_NAME}.AppImage"
require LINUX_X64_APPIMAGE   "linux-x64 ${PRODUCT_NAME}.AppImage"
require WINDOWS_MSIX         "win32-x64 ${PRODUCT_NAME}.msix"

cp "$LINUX_ARM64_APPIMAGE" "$NORMALIZED_DIR/linux-arm64/$PRODUCT_NAME.AppImage"
cp "$LINUX_X64_APPIMAGE"   "$NORMALIZED_DIR/linux-x64/$PRODUCT_NAME.AppImage"
cp "$WINDOWS_MSIX"         "$NORMALIZED_DIR/win32-x64/$PRODUCT_NAME.msix"
chmod +x "$NORMALIZED_DIR/linux-arm64/$PRODUCT_NAME.AppImage"
chmod +x "$NORMALIZED_DIR/linux-x64/$PRODUCT_NAME.AppImage"

extract_app () {
  local zip="$1"
  local dest="$2"
  if command -v ditto >/dev/null 2>&1; then
    ditto -x -k "$zip" "$dest"
  else
    unzip -q -o "$zip" -d "$dest"
  fi
  if [ ! -d "$dest/$PRODUCT_NAME.app" ]; then
    echo "Expected $dest/$PRODUCT_NAME.app after extracting $zip" >&2
    exit 1
  fi
}

extract_app "$DARWIN_ARM64_ZIP" "$NORMALIZED_DIR/darwin-arm64"
extract_app "$DARWIN_X64_ZIP"   "$NORMALIZED_DIR/darwin-x64"

cp "$PACKAGE_JSON_PATH" "$PACKAGE_OUT"
npm pkg set --prefix "$TMP_DIR" "productName=$PRODUCT_NAME" >/dev/null
if [ -n "$BUILD_VERSION" ]; then
  npm pkg set --prefix "$TMP_DIR" "version=$BUILD_VERSION" >/dev/null
fi

npx --yes "pear-build@latest" \
  --package "$PACKAGE_OUT" \
  --target "$OUTPUT_DIR" \
  --darwin-arm64-app "$NORMALIZED_DIR/darwin-arm64/$PRODUCT_NAME.app" \
  --darwin-x64-app   "$NORMALIZED_DIR/darwin-x64/$PRODUCT_NAME.app" \
  --linux-arm64-app  "$NORMALIZED_DIR/linux-arm64/$PRODUCT_NAME.AppImage" \
  --linux-x64-app    "$NORMALIZED_DIR/linux-x64/$PRODUCT_NAME.AppImage" \
  --win32-x64-app    "$NORMALIZED_DIR/win32-x64/$PRODUCT_NAME.msix"

echo "wrote stage tree to $OUTPUT_DIR"
