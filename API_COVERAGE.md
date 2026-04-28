# Canvas API Coverage

This plugin was expanded against the local markdown docs under:

`docs/services/canvas/resources/`

The docs corpus currently contains 135 Canvas resource pages. The plugin does not try to generate a one-tool-per-endpoint admin client. Instead it provides specialized read tools for common student and course workflows, then keeps `canvas_request` as the explicit fallback for less common endpoints and writes.

## Specialized Coverage

- Courses and grades: `courses`, `enrollments`
- User workflow: `users`
- Planner and calendar: `planner`, `calendar_events`
- Pages and modules: `pages`, `modules`
- Assignments and submissions: `assignments`, `assignment_groups`, `submissions`
- Quizzes: `quizzes`, `new_quizzes`
- Quiz submissions and peer review: `quiz_submissions`, `peer_reviews`
- Discussions: `discussion_topics`
- Files and folders: `files`
- Groups and sections: `groups`, `sections`
- Navigation: `tabs`
- Rubrics and outcomes: `rubrics`, `outcome_results`
- Announcements: `announcements`
- Communication and search: `conversations`, `search`, `smart_search`
- User shortcuts: `bookmarks`, `favorites`
- Collaboration and scheduling: `collaborations`, `conferences`, `appointment_groups`
- Media and LTI discovery: `media_objects`, `external_tools`
- Analytics and operations: `analytics`, `learning_object_dates`, `blackout_dates`, `content_exports`, `content_migrations`, `progress`

## Fallback Policy

Use `canvas_request` for endpoints that are not yet specialized. It is intentionally constrained to same-origin Canvas REST paths under `/api/v1/...` and `/api/quiz/v1/...`. Mutating methods require `allow_mutation: true`.

## Expansion Rule

Add a specialized tool when an endpoint is common enough to benefit from a clear schema, parameter validation, pagination behavior, or a student-friendly summary. Keep rare, admin-heavy, or institution-specific endpoints behind `canvas_request` until a concrete workflow needs first-class support.
