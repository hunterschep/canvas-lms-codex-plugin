# Canvas LMS for Codex

[![GitHub stars](https://img.shields.io/github/stars/hunterschep/canvas-lms-codex-plugin?style=social)](https://github.com/hunterschep/canvas-lms-codex-plugin/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Codex Plugin](https://img.shields.io/badge/Codex-Plugin-black)](https://developers.openai.com/codex/plugins)
[![Canvas LMS](https://img.shields.io/badge/Canvas-LMS-red)](https://www.instructure.com/canvas)
[![Status](https://img.shields.io/badge/status-community--built-orange)](https://github.com/hunterschep/canvas-lms-codex-plugin)

Student-first Canvas LMS workflows for Codex, packaged as a local plugin with a bundled MCP server.

This plugin helps Codex read and summarize the parts of Canvas students actually use: courses, grades, planner items, calendar items, pages, assignments, quizzes, modules, submissions, and announcements.

## Community Disclaimer

This is a community-built plugin created by an independent user.

- It is not an official Instructure product.
- It is not affiliated with, endorsed by, or maintained by Instructure.
- `Canvas` and `Canvas LMS` are trademarks of Instructure.

## What This Plugin Can Do

- show current courses with grade context
- summarize upcoming work from Planner and Calendar
- read and summarize course front pages and pages
- inspect assignments, quizzes, submissions, and graded work
- summarize modules and student progress data
- pull recent announcements across courses
- fall back to unsupported student-relevant Canvas REST endpoints under `/api/v1/...` and `/api/quiz/v1/...`

## Install

Choose one install mode.

### Personal install

Installs the plugin for your user account and makes it available across projects.

```bash
curl -fsSL https://raw.githubusercontent.com/hunterschep/canvas-lms-codex-plugin/main/install.sh | bash
```

This copies the plugin to `~/.codex/plugins/canvas-lms` and updates `~/.agents/plugins/marketplace.json`.

### Repo install

Installs the plugin only for one workspace.

From the repo root:

```bash
curl -fsSL https://raw.githubusercontent.com/hunterschep/canvas-lms-codex-plugin/main/install.sh | bash -s -- --repo-root "$PWD"
```

From the plugin directory inside a repo:

```bash
cd /absolute/path/to/your/repo/plugins/canvas-lms
./install.sh --repo-root /absolute/path/to/your/repo --force
```

This copies the plugin to `/absolute/path/to/your/repo/plugins/canvas-lms` and updates `/absolute/path/to/your/repo/.agents/plugins/marketplace.json`.

If you want repo-only behavior, do not also run the personal install.

The installer keeps the repo marketplace name stable as `canvas-local-plugins`, rewrites the installed plugin `.mcp.json` to use an absolute path to `scripts/canvas-mcp-server.mjs`, clears stale cached `canvas-lms` bundles, and removes stale `canvas-lms@...` enablement blocks from `~/.codex/config.toml`. It does not register `canvas` as a global `[mcp_servers.canvas]` entry.

If you are upgrading from an older version of this plugin, rerun the installer once. It removes the legacy `canvas-lms managed MCP server` block from `~/.codex/config.toml`.

If you are switching from personal install to repo-only install, remove the old personal copy:

```bash
rm -rf ~/.codex/plugins/canvas-lms
```

Then remove the `canvas-lms` entry from `~/.agents/plugins/marketplace.json`, or delete that marketplace file if it only contained this plugin.

## Install Scope

Repo marketplace scope and installed-plugin scope are different in Codex:

- A repo marketplace controls where the plugin appears for discovery and install.
- After you install it in `/plugins`, Codex caches the installed bundle under `~/.codex/plugins/cache/...`.
- Plugin enablement is stored in `~/.codex/config.toml`.

That means a plugin installed from a repo marketplace can still be enabled in other projects until you disable or uninstall it from `/plugins`.

## Canvas Setup

Before starting Codex, export your Canvas environment variables in the shell that launches it:

```bash
export CANVAS_BASE_URL="https://your-school.instructure.com"
export CANVAS_ACCESS_TOKEN="your_canvas_access_token"
```

Optional configuration:

```bash
export CANVAS_TIMEOUT_MS="30000"
export CANVAS_USER_AGENT="canvas-lms-codex-plugin/0.2.2"
export CANVAS_ACCEPT_STRING_IDS="1"
```

Notes:

- `CANVAS_BASE_URL` must use HTTPS unless you are testing against localhost.
- `CANVAS_ACCEPT_STRING_IDS` defaults to enabled so large Canvas IDs do not lose precision in JavaScript.
- `CANVAS_ACCESS_TOKEN` should be scoped to the minimum permissions your Canvas setup allows.

## Start Codex

After installing or updating:

1. Restart Codex completely.
2. Open `/plugins`.
3. Install or enable `Canvas LMS` from the marketplace you updated.
4. Start a new thread.

## Use It In Codex

Example prompts:

- `Show my current Canvas courses and grades.`
- `Summarize my upcoming assignments and quizzes this week.`
- `Read the front page and modules for course 123 and summarize them.`
- `Show which assignments in course 123 are graded, missing, or still unsubmitted.`
- `Summarize the latest announcements across my active classes.`

## Tool Surface

The plugin exposes 20 Canvas tools through MCP:

- Identity:
  `canvas_get_current_user_profile`
- Courses and grades:
  `canvas_list_student_courses`, `canvas_get_student_course`, `canvas_get_course_grade_summary`
- Planner and calendar:
  `canvas_list_upcoming_planner_items`, `canvas_list_calendar_items`
- Pages and modules:
  `canvas_list_course_pages`, `canvas_get_page`, `canvas_get_front_page`, `canvas_list_course_modules`
- Assignments and quizzes:
  `canvas_list_course_assignments`, `canvas_get_assignment`, `canvas_list_course_quizzes`, `canvas_get_quiz`, `canvas_get_new_quiz`
- Submissions and grading:
  `canvas_list_student_submissions`, `canvas_list_graded_assignments`, `canvas_get_submission`
- Announcements:
  `canvas_list_announcements`
- Fallback:
  `canvas_request`

The fallback is intentionally restricted. It only allows same-origin Canvas REST paths under `/api/v1/...` and `/api/quiz/v1/...`, and writes still require `allow_mutation: true`.

## Development

This repository is the plugin root:

- `.codex-plugin/plugin.json` contains the Codex plugin manifest
- `.mcp.json` wires the local MCP server
- `skills/canvas-lms/SKILL.md` contains Canvas-specific operating guidance
- `scripts/canvas-mcp-server.mjs` is the stdio MCP entrypoint
- `scripts/canvas-mcp-core.mjs` contains shared validation, HTTP, pagination, and summary helpers
- `scripts/canvas-mcp-tools.mjs` contains the tool registry and handlers
- `scripts/validate-plugin.mjs` validates the package shape and MCP handshake
- `install.sh` installs the plugin and updates the appropriate marketplace file

Validate the plugin:

```bash
node ./scripts/validate-plugin.mjs
```

## Troubleshooting

If Codex shows an MCP startup timeout for `canvas` during install or first use:

- uninstall the plugin from `/plugins`
- restart Codex
- reinstall the plugin with the install mode you actually want
- start a new thread after reinstalling
- confirm your shell exported `CANVAS_BASE_URL` and `CANVAS_ACCESS_TOKEN` before launching Codex
- remove any stale home-local `canvas-lms` marketplace entry if `/plugins` still shows duplicates
- if the plugin is installed but you do not want it active in other projects, disable or uninstall it from `/plugins`

If you previously installed a repo copy that used the marketplace name `local-repo-plugins`, rerun the latest installer once before reinstalling from `/plugins`. That migration clears the old plugin identity so Codex stops trying to mount the stale bundle.

This plugin relies on the standard bundled `.mcp.json` flow described in the Codex plugin docs. It does not install a global `canvas` MCP server in `~/.codex/config.toml`.

Current Codex builds may launch bundled MCP commands from the session working directory instead of the installed plugin root. The installer therefore rewrites the installed plugin's `.mcp.json` to use an absolute entrypoint path so the bundled server starts reliably without a global `mcp_servers.canvas` override.

## Security Notes

- This plugin sends your Canvas bearer token only to the configured Canvas origin.
- The raw request fallback is restricted to Canvas REST paths under `/api/v1/...` and `/api/quiz/v1/...`.
- The plugin is built for student-focused Canvas workflows, not broad admin automation.
- Review the code and permission scopes before using it with institutional data.

## Current Limits

- no specialized file upload workflow yet
- no dedicated New Quizzes list workflow yet
- no dedicated discussion-topic reader yet
- real-tenant behavior still depends on your institution's scopes, permissions, and feature flags

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
