import {
  COMMON_GET_PROPERTIES,
  COMMON_LIST_PROPERTIES,
  DEFAULT_MAX_PAGES,
  DEFAULT_PER_PAGE,
  JsonRpcError,
  MAX_PAGES,
  MAX_PER_PAGE,
  SUPPORTED_METHODS,
  ToolExecutionError,
  addIncludeQuery,
  appendMultiValue,
  appendStudentSubmissionsQuery,
  buildEnvelope,
  ensureAllowedKeys,
  ensureObject,
  mergeFlatParams,
  mergeIncludes,
  normalizeString,
  optionalBoolean,
  optionalEnum,
  optionalEnumArray,
  optionalFlatParamObject,
  optionalInteger,
  optionalString,
  optionalStringArray,
  performCanvasListRequest,
  performCanvasRequest,
  readCommonGetArgs,
  readCommonListArgs,
  resolveDateWindow,
  summarizeAnnouncement,
  summarizeAnnouncements,
  summarizeAssignments,
  summarizeCalendarItem,
  summarizeCalendarItems,
  summarizeGradeEnrollment,
  summarizeModules,
  summarizeNewQuiz,
  summarizePage,
  summarizePages,
  summarizePlannerItems,
  summarizeQuiz,
  summarizeQuizzes,
  summarizeStudentCourse,
  summarizeSubmissions,
} from "../canvas-mcp-core.mjs";

export const CONTENT_ASSIGNMENT_TOOLS = [
  {
    name: "canvas_list_course_pages",
    title: "List Course Pages",
    description: "List pages in a Canvas course so Codex can inspect and summarize student-facing course content.",
    inputSchema: {
      type: "object",
      required: ["course_id"],
      properties: {
        course_id: {
          type: "string",
          description: "Canvas course ID or SIS identifier.",
        },
        sort: {
          type: "string",
          enum: ["title", "created_at", "updated_at"],
          description: "Page sort field. Defaults to updated_at.",
        },
        order: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Sort order. Defaults to desc.",
        },
        search_term: {
          type: "string",
          description: "Optional partial page title match.",
        },
        published: {
          type: "boolean",
          description: "If true, only published pages. If false, exclude published pages.",
        },
        include: {
          type: "array",
          items: { type: "string" },
          description: "Optional include[] values. Use body to include page bodies in the list response.",
        },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_course_pages arguments");
      const common = readCommonListArgs(
        args,
        ["course_id", "sort", "order", "search_term", "published"],
        "canvas_list_course_pages",
      );
      const courseId = normalizeString(args.course_id, "course_id");
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      addIncludeQuery(query, mergeIncludes([], common.include));
      appendMultiValue(query, "sort", optionalEnum(args.sort, "sort", ["title", "created_at", "updated_at"]) ?? "updated_at");
      appendMultiValue(query, "order", optionalEnum(args.order, "order", ["asc", "desc"]) ?? "desc");
      appendMultiValue(query, "search_term", optionalString(args.search_term, "search_term"));
      appendMultiValue(query, "published", optionalBoolean(args.published, "published"));
      appendMultiValue(query, "per_page", common.perPage);

      const envelope = await performCanvasListRequest({
        path: `/api/v1/courses/${encodeURIComponent(courseId)}/pages`,
        query,
        followPagination: common.followPagination,
        maxPages: common.maxPages,
      });

      return {
        ...envelope,
        summary: {
          ...summarizePages(envelope.data),
          pages: envelope.data.map(summarizePage),
        },
      };
    },
  },
  {
    name: "canvas_get_page",
    title: "Get Page",
    description: "Read a specific Canvas course page, including its body, so Codex can summarize it.",
    inputSchema: {
      type: "object",
      required: ["course_id", "url_or_id"],
      properties: {
        course_id: {
          type: "string",
          description: "Canvas course ID or SIS identifier.",
        },
        url_or_id: {
          type: "string",
          description: "Canvas page URL slug, page_id:<id>, or ambiguous page identifier.",
        },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_page arguments");
      ensureAllowedKeys(args, ["course_id", "url_or_id", "extra_query"], "canvas_get_page");
      const courseId = normalizeString(args.course_id, "course_id");
      const pageId = normalizeString(args.url_or_id, "url_or_id");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      const result = await performCanvasRequest({
        method: "GET",
        path: `/api/v1/courses/${encodeURIComponent(courseId)}/pages/${encodeURIComponent(pageId)}`,
        query,
      });
      return {
        ...buildEnvelope(result),
        summary: summarizePage(result.data),
      };
    },
  },
  {
    name: "canvas_get_front_page",
    title: "Get Front Page",
    description: "Read the front page of a Canvas course so Codex can summarize the course landing content.",
    inputSchema: {
      type: "object",
      required: ["course_id"],
      properties: {
        course_id: {
          type: "string",
          description: "Canvas course ID or SIS identifier.",
        },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_front_page arguments");
      ensureAllowedKeys(args, ["course_id", "extra_query"], "canvas_get_front_page");
      const courseId = normalizeString(args.course_id, "course_id");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      const result = await performCanvasRequest({
        method: "GET",
        path: `/api/v1/courses/${encodeURIComponent(courseId)}/front_page`,
        query,
      });
      return {
        ...buildEnvelope(result),
        summary: summarizePage(result.data),
      };
    },
  },
  {
    name: "canvas_list_course_assignments",
    title: "List Course Assignments",
    description: "List assignments in a course with student submission context, due dates, and bucket filters.",
    inputSchema: {
      type: "object",
      required: ["course_id"],
      properties: {
        course_id: {
          type: "string",
          description: "Canvas course ID or SIS identifier.",
        },
        search_term: {
          type: "string",
          description: "Optional Canvas search_term filter.",
        },
        bucket: {
          type: "string",
          enum: ["past", "overdue", "undated", "ungraded", "unsubmitted", "upcoming", "future"],
          description: "Optional student-facing assignment bucket filter.",
        },
        assignment_ids: {
          type: "array",
          items: { type: "string" },
          description: "Optional repeated assignment_ids[] values.",
        },
        order_by: {
          type: "string",
          enum: ["position", "name", "due_at"],
          description: "Optional assignment order. Defaults to due_at for student workflows.",
        },
        ...COMMON_LIST_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_course_assignments arguments");
      const common = readCommonListArgs(
        args,
        ["course_id", "search_term", "bucket", "assignment_ids", "order_by"],
        "canvas_list_course_assignments",
      );
      const courseId = normalizeString(args.course_id, "course_id");
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      addIncludeQuery(query, mergeIncludes(["submission", "all_dates"], common.include));
      appendMultiValue(query, "search_term", optionalString(args.search_term, "search_term"));
      appendMultiValue(query, "bucket", optionalEnum(args.bucket, "bucket", ["past", "overdue", "undated", "ungraded", "unsubmitted", "upcoming", "future"]));
      appendMultiValue(query, "assignment_ids[]", optionalStringArray(args.assignment_ids, "assignment_ids"));
      appendMultiValue(query, "order_by", optionalEnum(args.order_by, "order_by", ["position", "name", "due_at"]) ?? "due_at");
      appendMultiValue(query, "override_assignment_dates", true);
      appendMultiValue(query, "per_page", common.perPage);
      const envelope = await performCanvasListRequest({
        path: `/api/v1/courses/${encodeURIComponent(courseId)}/assignments`,
        query,
        followPagination: common.followPagination,
        maxPages: common.maxPages,
      });
      return {
        ...envelope,
        summary: summarizeAssignments(envelope.data),
      };
    },
  },
];
