---
name: canvas-lms
description: Use bundled Canvas MCP tools to inspect student-facing Canvas data like courses, grades, pages, calendars, assignments, quizzes, announcements, modules, and submissions.
---

Use this skill whenever the user needs to interact with Canvas LMS data or the Canvas LMS API.

## Tool selection

- Prefer the student-focused `canvas_*` MCP tool first.
- Use `canvas_request` only when the needed endpoint is not covered by a specialized tool.
- Only use `canvas_request` with mutating methods when the user explicitly wants to change Canvas data.
- Keep `canvas_request` on same-origin Canvas REST paths under `/api/v1/...` or `/api/quiz/v1/...`.

## Student-first tool map

- Use `canvas_list_student_courses` for course list plus current grade context.
- Use `canvas_get_student_course` for one course's student view.
- Use `canvas_get_course_grade_summary` when the user specifically wants a course-grade summary or grading-period numbers.
- Use `canvas_list_upcoming_planner_items` for upcoming work across courses.
- Use `canvas_list_calendar_items` for calendar-style due dates and events.
- Use `canvas_list_course_pages`, `canvas_get_page`, and `canvas_get_front_page` for reading course content pages.
- Use `canvas_list_course_assignments` for course assignment lists, especially with `bucket` values like `upcoming`, `overdue`, `ungraded`, and `unsubmitted`.
- Use `canvas_list_course_quizzes` and `canvas_get_quiz` for classic quizzes.
- Use `canvas_get_new_quiz` when the course uses New Quizzes and you know the assignment ID.
- Use `canvas_list_student_submissions` for submission-state analysis such as missing work, unsubmitted work, and recent feedback.
- Use `canvas_list_graded_assignments` for recently graded work, scores, and feedback review.
- Use `canvas_list_course_modules` for module structure and progress.
- Use `canvas_list_announcements` for recent course announcements across one or more course contexts.
- Use `canvas_get_submission` when the user needs detailed grading, comments, rubric, or read-state data for one assignment.

## Canvas rules that matter

- Canvas is context-first. Most endpoints live under courses, users, accounts, groups, or sections.
- Treat Canvas IDs as strings. This plugin requests string IDs from Canvas to avoid JavaScript precision loss on 64-bit integers.
- Pagination comes from `pageInfo.next` and the other `Link` relations returned by the API. Do not invent page URLs.
- `include[]` is common. Use `include` on specialized tools or exact `extra_query` keys like `include[]` when you need richer payloads.
- Some Canvas families use plural keys like `includes[]` and `excludes[]`; the specialized calendar tool handles those directly.
- The raw fallback is intentionally narrower than the whole Canvas origin. It only permits `/api/v1/...` and `/api/quiz/v1/...` paths so the access token is not sent to arbitrary same-origin pages or unrelated APIs.
- Permission failures are often scope or context failures, not just missing endpoints. The real check is developer-key scope plus the token's user permissions in that Canvas context.
- Classic Quizzes and New Quizzes are different APIs. Classic Quizzes live under `/api/v1/.../quizzes`. New Quizzes live under `/api/quiz/v1/...`.
- LTI services live under `/api/lti/...` and behave differently from the main REST API surface.

## Practical workflow

1. If the token identity matters, start with `canvas_get_current_user_profile`.
2. For grades and course overview, use `canvas_list_student_courses` and `canvas_get_course_grade_summary`.
3. For upcoming work, use `canvas_list_upcoming_planner_items` and `canvas_list_calendar_items`.
4. For course content, use `canvas_get_front_page`, `canvas_list_course_pages`, and `canvas_list_course_modules`.
5. For assessment, use `canvas_list_course_assignments`, `canvas_list_course_quizzes`, `canvas_get_quiz`, `canvas_get_new_quiz`, `canvas_list_graded_assignments`, and `canvas_list_student_submissions`.
6. For communication, use `canvas_list_announcements`.
7. When you need an unsupported endpoint, call `canvas_request` with the exact Canvas path.
8. If a list is paginated, continue from the returned `pageInfo.next` URL or rerun the specialized list tool with pagination enabled.

## Write operations

- Canvas write endpoints often expect flat, bracketed form keys such as `assignment[name]`, `module_item[position]`, or `comment[text_comment]`.
- When using `canvas_request` for writes, prefer narrow, explicit requests and restate the exact object being changed.
- File uploads are not yet specialized in this plugin because Canvas uses a multi-step upload flow.
