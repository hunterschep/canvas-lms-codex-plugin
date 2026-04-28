# Canvas LMS for Codex

[![GitHub stars](https://img.shields.io/github/stars/hunterschep/canvas-lms-codex-plugin?style=social)](https://github.com/hunterschep/canvas-lms-codex-plugin/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Codex Plugin](https://img.shields.io/badge/Codex-Plugin-black)](https://developers.openai.com/codex/plugins)
[![Canvas LMS](https://img.shields.io/badge/Canvas-LMS-red)](https://www.instructure.com/canvas)
[![Status](https://img.shields.io/badge/status-community--built-orange)](https://github.com/hunterschep/canvas-lms-codex-plugin)

Student-first Canvas LMS workflows for Codex, packaged as a local plugin with a bundled MCP server.

This plugin helps Codex read and summarize the parts of Canvas students and course teams actually use: courses, grades, planner items, calendar items, users, groups, sections, pages, files, folders, discussions, conversations, search, assignments, quizzes, peer reviews, rubrics, outcomes, modules, submissions, appointments, collaborations, conferences, media, analytics, content exports, migrations, and announcements.

The plugin is presented in Codex as an interactive productivity plugin with bundled Canvas MCP tools.

## Community Disclaimer

This is a community-built plugin created by an independent user.

- It is not an official Instructure product.
- It is not affiliated with, endorsed by, or maintained by Instructure.
- `Canvas` and `Canvas LMS` are trademarks of Instructure.

## What This Plugin Can Do

- show current courses with grade context
- summarize upcoming work from Planner and Calendar
- read and summarize course front pages and pages
- inspect course users, groups, sections, tabs, files, folders, and discussions
- inspect assignments, quizzes, quiz submissions, peer reviews, submissions, and graded work
- inspect assignment groups, rubrics, and outcome results
- search Canvas recipients, public courses, and course content
- inspect conversations, bookmarks, favorites, appointment groups, collaborations, conferences, media, and external tools
- inspect course analytics, learning-object dates, blackout dates, content exports, content migrations, and async progress
- summarize modules and student progress data
- pull recent announcements across courses
- fall back to unsupported student-relevant Canvas REST endpoints under `/api/v1/...` and `/api/quiz/v1/...`

## Install

Choose one install mode.

The published installer supports both `curl | bash` and direct `./install.sh` usage.

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

This places or reuses the plugin at `/absolute/path/to/your/repo/plugins/canvas-lms` and updates `/absolute/path/to/your/repo/.agents/plugins/marketplace.json`.

If you want repo-only behavior, do not also run the personal install.

The committed source `.mcp.json` stays portable in git. Workspace installs keep plugin-root-relative MCP paths, while personal installs rewrite the home-local plugin copy to use absolute paths for both the Node binary and `scripts/canvas-mcp-server.mjs`. The installer keeps the repo marketplace name stable as `canvas-local-plugins`, clears stale cached `canvas-lms` bundles, and removes stale `canvas-lms@...` enablement blocks from `~/.codex/config.toml`. It does not register `canvas` as a global `[mcp_servers.canvas]` entry.

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
export CANVAS_USER_AGENT="canvas-lms-codex-plugin/0.4.0"
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

The plugin exposes 103 Canvas tools through MCP:

- Identity, courses, and grades:
  `canvas_get_current_user_profile`, `canvas_list_student_courses`, `canvas_get_student_course`, `canvas_get_course_grade_summary`
- Users and workflow:
  `canvas_get_user_profile`, `canvas_list_course_users`, `canvas_get_course_user`, `canvas_list_user_activity_stream`, `canvas_get_user_activity_summary`, `canvas_list_user_todo_items`, `canvas_get_user_todo_item_count`, `canvas_list_user_missing_submissions`, `canvas_list_user_page_views`
- Planner and calendar:
  `canvas_list_upcoming_planner_items`, `canvas_list_calendar_items`
- Pages, modules, and announcements:
  `canvas_list_course_pages`, `canvas_get_page`, `canvas_get_front_page`, `canvas_list_course_modules`, `canvas_list_announcements`
- Assignments, assignment groups, rubrics, and outcomes:
  `canvas_list_course_assignments`, `canvas_get_assignment`, `canvas_list_assignment_groups`, `canvas_get_assignment_group`, `canvas_list_course_rubrics`, `canvas_get_course_rubric`, `canvas_list_outcome_results`
- Quizzes, quiz submissions, peer reviews, and grading:
  `canvas_list_course_quizzes`, `canvas_get_quiz`, `canvas_get_new_quiz`, `canvas_list_quiz_submissions`, `canvas_get_current_quiz_submission`, `canvas_get_quiz_submission`, `canvas_get_quiz_submission_time`, `canvas_list_peer_reviews`, `canvas_list_submission_peer_reviews`, `canvas_list_student_submissions`, `canvas_list_graded_assignments`, `canvas_get_submission`
- Groups, sections, and tabs:
  `canvas_list_current_user_groups`, `canvas_list_course_groups`, `canvas_get_group`, `canvas_list_group_users`, `canvas_list_course_sections`, `canvas_get_section`, `canvas_list_section_users`, `canvas_list_context_tabs`
- Files, folders, discussions:
  `canvas_get_files_quota`, `canvas_list_context_files`, `canvas_list_folder_files`, `canvas_get_file`, `canvas_get_file_public_url`, `canvas_list_context_folders`, `canvas_get_folder`, `canvas_list_discussion_topics`, `canvas_get_discussion_topic`, `canvas_get_discussion_topic_view`, `canvas_list_discussion_entries`, `canvas_list_discussion_entry_replies`
- Conversations, search, bookmarks, and favorites:
  `canvas_list_conversations`, `canvas_get_conversation`, `canvas_get_conversations_unread_count`, `canvas_find_conversation_recipients`, `canvas_search_recipients`, `canvas_search_all_courses`, `canvas_search_course_content`, `canvas_list_bookmarks`, `canvas_get_bookmark`, `canvas_list_favorite_courses`, `canvas_list_favorite_groups`
- Collaboration, scheduling, media, and external tools:
  `canvas_list_collaborations`, `canvas_list_collaboration_members`, `canvas_list_potential_collaborators`, `canvas_list_conferences`, `canvas_list_appointment_groups`, `canvas_get_appointment_group`, `canvas_list_appointment_group_users`, `canvas_list_appointment_group_groups`, `canvas_get_next_appointment`, `canvas_list_context_media_objects`, `canvas_list_context_media_attachments`, `canvas_list_media_tracks`, `canvas_list_external_tools`, `canvas_get_external_tool`, `canvas_get_external_tool_sessionless_launch`, `canvas_list_visible_course_nav_tools`
- Analytics, operations, exports, and migrations:
  `canvas_get_progress`, `canvas_get_course_analytics_activity`, `canvas_get_course_analytics_assignments`, `canvas_list_course_analytics_student_summaries`, `canvas_get_course_analytics_student_activity`, `canvas_get_course_analytics_student_assignments`, `canvas_get_course_analytics_student_communication`, `canvas_get_learning_object_date_details`, `canvas_list_blackout_dates`, `canvas_get_blackout_date`, `canvas_list_content_exports`, `canvas_get_content_export`, `canvas_list_content_migrations`, `canvas_get_content_migration`, `canvas_list_content_migration_issues`, `canvas_get_content_migration_issue`
- Fallback:
  `canvas_request`

The fallback is intentionally restricted. It only allows same-origin Canvas REST paths under `/api/v1/...` and `/api/quiz/v1/...`, and writes still require `allow_mutation: true`.

## Development

This repository is the plugin root:

- `.codex-plugin/plugin.json` contains the Codex plugin manifest
- `API_COVERAGE.md` records the Canvas docs coverage strategy
- `.mcp.json` wires the local MCP server
- `skills/canvas-lms/SKILL.md` contains Canvas-specific operating guidance
- `scripts/canvas-mcp-server.mjs` is the stdio MCP entrypoint
- `scripts/canvas-mcp-core.mjs` re-exports the core helper modules
- `scripts/core/` contains shared validation, HTTP, pagination, and summary helpers
- `scripts/tools/` contains Canvas API family tool handlers
- `scripts/canvas-mcp-tools.mjs` assembles the tool registry
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

Personal installs rewrite the home-local `.mcp.json` to absolute `node` and MCP entrypoint paths. Workspace installs intentionally keep `.mcp.json` plugin-root-relative so the repo copy remains portable and reviewable.

The bundled MCP server accepts:

- `Content-Length` framed MCP messages with CRLF separators
- `Content-Length` framed MCP messages with LF separators
- raw JSON and newline-delimited JSON-RPC

It also mirrors the client's transport style on replies. That matters because current Codex local-plugin startup may send raw JSON `initialize` requests instead of a framed MCP envelope.

## Why It Broke

Two issues were interacting:

- startup path resolution: personal local plugin installs could fail if Codex launched the bundled MCP server without the expected working directory or shell `PATH`
- transport mismatch: the original server only understood framed MCP input and always replied with framed output, while Codex's local plugin startup path sent raw JSON `initialize`

## Why It Works Now

- the installer renders absolute `node` and server paths into the personal home-local plugin copy
- the server accepts both framed and raw startup messages
- the server replies in the same transport style the client used
- the validator exercises all supported startup styles so the regression is caught before release

## Security Notes

- This plugin sends your Canvas bearer token only to the configured Canvas origin.
- The raw request fallback is restricted to Canvas REST paths under `/api/v1/...` and `/api/quiz/v1/...`.
- The plugin is built for student-focused Canvas workflows, not broad admin automation.
- Review the code and permission scopes before using it with institutional data.

## Current Limits

- no specialized file upload workflow yet
- no dedicated New Quizzes list workflow yet
- no first-class write workflow beyond the explicit `canvas_request` fallback
- real-tenant behavior still depends on your institution's scopes, permissions, and feature flags

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
