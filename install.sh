#!/usr/bin/env bash
set -euo pipefail

PLUGIN_NAME="canvas-lms"
REPO_SLUG="hunterschep/canvas-lms-codex-plugin"
REPO_URL="https://github.com/${REPO_SLUG}.git"
DEFAULT_PERSONAL_TARGET="${HOME}/.codex/plugins/${PLUGIN_NAME}"
DEFAULT_PERSONAL_MARKETPLACE="${HOME}/.agents/plugins/marketplace.json"

MODE="personal"
REPO_ROOT=""
FORCE="0"

usage() {
  cat <<'EOF'
Usage:
  ./install.sh
  ./install.sh --repo-root /absolute/path/to/repo
  ./install.sh --force

Options:
  --repo-root PATH   Install into PATH/plugins/canvas-lms and update PATH/.agents/plugins/marketplace.json
  --force            Replace an existing installation at the target path
  --help             Show this help text
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-root)
      [[ $# -ge 2 ]] || { echo "Missing value for --repo-root" >&2; exit 1; }
      MODE="workspace"
      REPO_ROOT="$2"
      shift 2
      ;;
    --force)
      FORCE="1"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "${MODE}" == "workspace" ]]; then
  [[ -n "${REPO_ROOT}" ]] || { echo "Workspace mode requires --repo-root" >&2; exit 1; }
  TARGET_DIR="${REPO_ROOT}/plugins/${PLUGIN_NAME}"
  MARKETPLACE_PATH="${REPO_ROOT}/.agents/plugins/marketplace.json"
  MARKETPLACE_SOURCE_PATH="./plugins/${PLUGIN_NAME}"
  MARKETPLACE_NAME="local-repo-plugins"
  MARKETPLACE_DISPLAY_NAME="Local Repo Plugins"
else
  TARGET_DIR="${DEFAULT_PERSONAL_TARGET}"
  MARKETPLACE_PATH="${DEFAULT_PERSONAL_MARKETPLACE}"
  MARKETPLACE_SOURCE_PATH="./.codex/plugins/${PLUGIN_NAME}"
  MARKETPLACE_NAME="community-local-plugins"
  MARKETPLACE_DISPLAY_NAME="Community Local Plugins"
fi

if [[ -e "${TARGET_DIR}" ]]; then
  if [[ "${FORCE}" != "1" ]]; then
    echo "Target already exists: ${TARGET_DIR}" >&2
    echo "Re-run with --force to replace it." >&2
    exit 1
  fi
  rm -rf "${TARGET_DIR}"
fi

mkdir -p "$(dirname "${TARGET_DIR}")"
mkdir -p "$(dirname "${MARKETPLACE_PATH}")"

git clone --depth 1 "${REPO_URL}" "${TARGET_DIR}"

python3 - "${MARKETPLACE_PATH}" "${MARKETPLACE_SOURCE_PATH}" "${MARKETPLACE_NAME}" "${MARKETPLACE_DISPLAY_NAME}" <<'PY'
import json
import os
import sys

marketplace_path, source_path, marketplace_name, marketplace_display_name = sys.argv[1:5]

if os.path.exists(marketplace_path):
    with open(marketplace_path, "r", encoding="utf-8") as f:
        data = json.load(f)
else:
    data = {
        "name": marketplace_name,
        "interface": {
            "displayName": marketplace_display_name,
        },
        "plugins": [],
    }

if not isinstance(data, dict):
    raise SystemExit("Marketplace file must contain a JSON object.")

data.setdefault("name", marketplace_name)
data.setdefault("interface", {})
if not isinstance(data["interface"], dict):
    raise SystemExit("Marketplace interface must be a JSON object.")
data["interface"].setdefault("displayName", marketplace_display_name)
plugins = data.setdefault("plugins", [])
if not isinstance(plugins, list):
    raise SystemExit("Marketplace plugins must be a JSON array.")

entry = {
    "name": "canvas-lms",
    "source": {
        "source": "local",
        "path": source_path,
    },
    "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL",
    },
    "category": "Productivity",
}

for index, plugin in enumerate(plugins):
    if isinstance(plugin, dict) and plugin.get("name") == "canvas-lms":
        plugins[index] = entry
        break
else:
    plugins.append(entry)

with open(marketplace_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY

cat <<EOF
Installed ${PLUGIN_NAME} to:
  ${TARGET_DIR}

Updated marketplace:
  ${MARKETPLACE_PATH}

Next steps:
  1. Export CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN
  2. Restart Codex
  3. Open /plugins and install "Canvas LMS" from the updated marketplace
EOF
