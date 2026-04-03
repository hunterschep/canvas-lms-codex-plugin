#!/usr/bin/env bash
set -euo pipefail

PLUGIN_NAME="canvas-lms"
REPO_SLUG="hunterschep/canvas-lms-codex-plugin"
REPO_URL="https://github.com/${REPO_SLUG}.git"
DEFAULT_PERSONAL_TARGET="${HOME}/.codex/plugins/${PLUGIN_NAME}"
DEFAULT_PERSONAL_MARKETPLACE="${HOME}/.agents/plugins/marketplace.json"
CODEX_CONFIG_PATH="${HOME}/.codex/config.toml"

MODE="personal"
REPO_ROOT=""
FORCE="0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
  MARKETPLACE_NAME="canvas-local-plugins"
  MARKETPLACE_DISPLAY_NAME="Canvas Local Plugins"
else
  TARGET_DIR="${DEFAULT_PERSONAL_TARGET}"
  MARKETPLACE_PATH="${DEFAULT_PERSONAL_MARKETPLACE}"
  MARKETPLACE_SOURCE_PATH="./.codex/plugins/${PLUGIN_NAME}"
  MARKETPLACE_NAME="community-local-plugins"
  MARKETPLACE_DISPLAY_NAME="Community Local Plugins"
fi

USE_EXISTING_TARGET="0"
if [[ "${SCRIPT_DIR}" == "${TARGET_DIR}" ]]; then
  USE_EXISTING_TARGET="1"
fi

if [[ -e "${TARGET_DIR}" ]]; then
  if [[ "${USE_EXISTING_TARGET}" == "1" ]]; then
    echo "Using existing plugin files at ${TARGET_DIR}"
  elif [[ "${FORCE}" != "1" ]]; then
    echo "Target already exists: ${TARGET_DIR}" >&2
    echo "Re-run with --force to replace it." >&2
    exit 1
  fi
  if [[ "${USE_EXISTING_TARGET}" != "1" ]]; then
    rm -rf "${TARGET_DIR}"
  fi
fi

mkdir -p "$(dirname "${TARGET_DIR}")"
mkdir -p "$(dirname "${MARKETPLACE_PATH}")"

if [[ "${USE_EXISTING_TARGET}" != "1" ]]; then
  git clone --depth 1 "${REPO_URL}" "${TARGET_DIR}"
fi

NODE_BIN="$(command -v node || true)"
if [[ -z "${NODE_BIN}" ]]; then
  echo "Could not find node on PATH. Install Node.js before running install.sh." >&2
  exit 1
fi

if [[ -d "${HOME}/.codex/plugins/cache" ]]; then
  find "${HOME}/.codex/plugins/cache" -mindepth 2 -maxdepth 2 -type d -name "${PLUGIN_NAME}" -exec rm -rf {} +
fi

python3 - "${TARGET_DIR}" "${NODE_BIN}" <<'PY'
import json
import pathlib
import sys

target_dir = pathlib.Path(sys.argv[1]).expanduser().resolve()
node_bin = pathlib.Path(sys.argv[2]).expanduser().resolve()
mcp_path = target_dir / ".mcp.json"
server_path = (target_dir / "scripts" / "canvas-mcp-server.mjs").resolve()

data = json.loads(mcp_path.read_text(encoding="utf-8"))
canvas = data.get("mcpServers", {}).get("canvas")
if not isinstance(canvas, dict):
    raise SystemExit('Missing ".mcp.json" mcpServers.canvas definition')

canvas["command"] = str(node_bin)
canvas["args"] = [str(server_path)]
canvas.pop("cwd", None)

mcp_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
PY

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

python3 - "${CODEX_CONFIG_PATH}" <<'PY'
import pathlib
import re
import sys

config_path = pathlib.Path(sys.argv[1]).expanduser()

start_marker = "# BEGIN canvas-lms managed MCP server"
end_marker = "# END canvas-lms managed MCP server"
plugin_section_pattern = re.compile(r'(?ms)^\[plugins\."canvas-lms@[^"]+"\]\n(?:.+\n)*?(?=^\[|\Z)')
marker_pattern = re.compile(rf"(?ms)^[ \t]*{re.escape(start_marker)}\n.*?^[ \t]*{re.escape(end_marker)}\n?")

if not config_path.exists():
    raise SystemExit(0)

text = config_path.read_text(encoding="utf-8")
updated = marker_pattern.sub("", plugin_section_pattern.sub("", text)).rstrip()

if updated == text.rstrip():
    raise SystemExit(0)

config_path.write_text(updated + ("\n" if updated else ""), encoding="utf-8")
PY

cat <<EOF
Installed ${PLUGIN_NAME} to:
  ${TARGET_DIR}

Updated marketplace:
  ${MARKETPLACE_PATH}

Next steps:
  1. Export CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN
  2. Restart Codex
  3. Open /plugins and reinstall "Canvas LMS" from the updated marketplace
  4. Start a new thread and ask Codex to use Canvas
EOF
