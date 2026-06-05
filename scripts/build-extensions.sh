#!/usr/bin/env bash
#
# 將 repo 內的 Chrome 擴充套件打包成可下載安裝的 zip。
# 產物輸出到 dist/，zip 內含與擴充套件同名的最上層資料夾，
# 使用者解壓後即可在 chrome://extensions 以「載入未封裝項目」選取。
#
# 用法：bash scripts/build-extensions.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"

mkdir -p "$DIST"

# 共用排除清單（開發檔、系統垃圾檔）
COMMON_EXCLUDES=("*.DS_Store" "__MACOSX/*")

# 將指定資料夾打包成 zip。
#   $1 = 擴充套件目錄（相對 repo 根）
#   $2 = 輸出 zip 檔名（不含副檔名）
#   其餘參數 = 額外排除的 glob（相對該資料夾）
pack() {
  local src_dir="$1"; shift
  local out_name="$1"; shift
  local extra_excludes=("$@")

  local parent base
  parent="$(dirname "$ROOT/$src_dir")"
  base="$(basename "$src_dir")"
  local out_zip="$DIST/$out_name.zip"

  rm -f "$out_zip"

  local exclude_args=()
  for pat in "${COMMON_EXCLUDES[@]}"; do
    exclude_args+=("-x" "$base/$pat")
  done
  for pat in ${extra_excludes[@]+"${extra_excludes[@]}"}; do
    exclude_args+=("-x" "$base/$pat")
  done

  ( cd "$parent" && zip -r -X "$out_zip" "$base" "${exclude_args[@]}" >/dev/null )
  echo "✓ $out_name.zip"
}

echo "打包擴充套件到 dist/ ..."

pack "cb-overlay"                  "cb-overlay"      "README.md" "scripts/*" "icons/icon.svg"
pack "chrome-ex-svgloader"         "svg-downloader"  "README.md" "PRIVACY.md" "demo.html" "store-assets/*"
pack "learning-hard/elearn-helper" "elearn-helper"
pack "excel-markdown"              "excel-markdown"  "README.md"

echo "完成。"
