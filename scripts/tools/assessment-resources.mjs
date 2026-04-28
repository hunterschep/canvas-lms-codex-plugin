import {
  COMMON_GET_PROPERTIES,
  COMMON_LIST_PROPERTIES,
  DEFAULT_MAX_PAGES,
  DEFAULT_PER_PAGE,
  MAX_PAGES,
  MAX_PER_PAGE,
  addIncludeQuery,
  appendMultiValue,
  buildEnvelope,
  ensureAllowedKeys,
  ensureObject,
  mergeFlatParams,
  normalizeString,
  optionalBoolean,
  optionalEnum,
  optionalEnumArray,
  optionalFlatParamObject,
  optionalInteger,
  optionalStringArray,
  performCanvasListRequest,
  performCanvasRequest,
  readCommonGetArgs,
  summarizeAssignmentGroups,
  summarizeOutcomeResults,
  summarizeRubrics,
} from "../canvas-mcp-core.mjs";

const ASSIGNMENT_GROUP_INCLUDES = [
  "assignments",
  "discussion_topic",
  "all_dates",
  "assignment_visibility",
  "overrides",
  "submission",
  "observed_users",
  "can_edit",
  "score_statistics",
  "peer_review",
];
const RUBRIC_INCLUDES = [
  "assessments",
  "graded_assessments",
  "peer_assessments",
  "associations",
  "assignment_associations",
  "course_associations",
  "account_associations",
];
const OUTCOME_INCLUDES = ["outcomes", "alignments", "outcomes.alignments", "outcome_groups", "outcome_links", "outcome_paths", "users"];

export const ASSESSMENT_RESOURCE_TOOLS = [
  {
    name: "canvas_list_assignment_groups",
    title: "List Assignment Groups",
    description: "List assignment groups in a course, optionally including assignment detail.",
    inputSchema: {
      type: "object",
      required: ["course_id"],
      properties: {
        course_id: { type: "string", description: "Canvas course ID or SIS identifier." },
        assignment_ids: { type: "array", items: { type: "string" } },
        exclude_assignment_submission_types: { type: "array", items: { type: "string", enum: ["online_quiz", "discussion_topic", "wiki_page", "external_tool"] } },
        override_assignment_dates: { type: "boolean" },
        grading_period_id: { type: "integer" },
        scope_assignments_to_student: { type: "boolean" },
        include: { type: "array", items: { type: "string", enum: ASSIGNMENT_GROUP_INCLUDES } },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_assignment_groups arguments");
      ensureAllowedKeys(args, ["course_id", "assignment_ids", "exclude_assignment_submission_types", "override_assignment_dates", "grading_period_id", "scope_assignments_to_student", "include", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_assignment_groups");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      addIncludeQuery(query, optionalEnumArray(args.include, "include", ASSIGNMENT_GROUP_INCLUDES));
      appendMultiValue(query, "assignment_ids[]", optionalStringArray(args.assignment_ids, "assignment_ids"));
      appendMultiValue(query, "exclude_assignment_submission_types[]", optionalEnumArray(args.exclude_assignment_submission_types, "exclude_assignment_submission_types", ["online_quiz", "discussion_topic", "wiki_page", "external_tool"]));
      appendMultiValue(query, "override_assignment_dates", optionalBoolean(args.override_assignment_dates, "override_assignment_dates") ?? true);
      appendMultiValue(query, "grading_period_id", optionalInteger(args.grading_period_id, "grading_period_id", 1, Number.MAX_SAFE_INTEGER));
      appendMultiValue(query, "scope_assignments_to_student", optionalBoolean(args.scope_assignments_to_student, "scope_assignments_to_student"));
      appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
      const envelope = await performCanvasListRequest({
        path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/assignment_groups`,
        query,
        followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
        maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
      });
      return { ...envelope, summary: summarizeAssignmentGroups(envelope.data) };
    },
  },
  {
    name: "canvas_get_assignment_group",
    title: "Get Assignment Group",
    description: "Read one assignment group in a course.",
    inputSchema: {
      type: "object",
      required: ["course_id", "assignment_group_id"],
      properties: {
        course_id: { type: "string", description: "Canvas course ID or SIS identifier." },
        assignment_group_id: { type: "string", description: "Canvas assignment group ID." },
        override_assignment_dates: { type: "boolean" },
        grading_period_id: { type: "integer" },
        include: { type: "array", items: { type: "string", enum: ASSIGNMENT_GROUP_INCLUDES } },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_assignment_group arguments");
      const { include, extraQuery } = readCommonGetArgs(args, ["course_id", "assignment_group_id", "override_assignment_dates", "grading_period_id"], "canvas_get_assignment_group");
      const query = {};
      mergeFlatParams(query, extraQuery);
      addIncludeQuery(query, optionalEnumArray(include, "include", ASSIGNMENT_GROUP_INCLUDES));
      appendMultiValue(query, "override_assignment_dates", optionalBoolean(args.override_assignment_dates, "override_assignment_dates") ?? true);
      appendMultiValue(query, "grading_period_id", optionalInteger(args.grading_period_id, "grading_period_id", 1, Number.MAX_SAFE_INTEGER));
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/assignment_groups/${encodeURIComponent(normalizeString(args.assignment_group_id, "assignment_group_id"))}`,
        query,
      }));
    },
  },
  {
    name: "canvas_list_course_rubrics",
    title: "List Course Rubrics",
    description: "List active rubrics in a course.",
    inputSchema: {
      type: "object",
      required: ["course_id"],
      properties: {
        course_id: { type: "string", description: "Canvas course ID or SIS identifier." },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_course_rubrics arguments");
      ensureAllowedKeys(args, ["course_id", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_course_rubrics");
      const query = optionalFlatParamObject(args.extra_query, "extra_query") ?? {};
      appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
      const envelope = await performCanvasListRequest({
        path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/rubrics`,
        query,
        followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
        maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
      });
      return { ...envelope, summary: summarizeRubrics(envelope.data) };
    },
  },
  {
    name: "canvas_get_course_rubric",
    title: "Get Course Rubric",
    description: "Read one rubric in a course, optionally including assessments or associations.",
    inputSchema: {
      type: "object",
      required: ["course_id", "rubric_id"],
      properties: {
        course_id: { type: "string", description: "Canvas course ID or SIS identifier." },
        rubric_id: { type: "string", description: "Canvas rubric ID." },
        include: { type: "array", items: { type: "string", enum: RUBRIC_INCLUDES } },
        style: { type: "string", enum: ["full", "comments_only"] },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_course_rubric arguments");
      ensureAllowedKeys(args, ["course_id", "rubric_id", "include", "style", "extra_query"], "canvas_get_course_rubric");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      addIncludeQuery(query, optionalEnumArray(args.include, "include", RUBRIC_INCLUDES));
      appendMultiValue(query, "style", optionalEnum(args.style, "style", ["full", "comments_only"]));
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/rubrics/${encodeURIComponent(normalizeString(args.rubric_id, "rubric_id"))}`,
        query,
      }));
    },
  },
  {
    name: "canvas_list_outcome_results",
    title: "List Outcome Results",
    description: "Read course outcome results, optionally filtered by users or outcomes.",
    inputSchema: {
      type: "object",
      required: ["course_id"],
      properties: {
        course_id: { type: "string", description: "Canvas course ID or SIS identifier." },
        user_ids: { type: "array", items: { type: "string" } },
        outcome_ids: { type: "array", items: { type: "string" } },
        include: { type: "array", items: { type: "string", enum: OUTCOME_INCLUDES } },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_outcome_results arguments");
      ensureAllowedKeys(args, ["course_id", "user_ids", "outcome_ids", "include", "extra_query"], "canvas_list_outcome_results");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "user_ids[]", optionalStringArray(args.user_ids, "user_ids"));
      appendMultiValue(query, "outcome_ids[]", optionalStringArray(args.outcome_ids, "outcome_ids"));
      addIncludeQuery(query, optionalEnumArray(args.include, "include", OUTCOME_INCLUDES));
      const result = await performCanvasRequest({
        method: "GET",
        path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/outcome_results`,
        query,
      });
      return { ...buildEnvelope(result), summary: summarizeOutcomeResults(result.data) };
    },
  },
];
