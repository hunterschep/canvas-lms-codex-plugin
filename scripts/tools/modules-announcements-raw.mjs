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

export const MODULE_ANNOUNCEMENT_RAW_TOOLS = [
  {
    name: "canvas_list_course_modules",
    title: "List Course Modules",
    description: "List course modules with inline items and completion details that matter to students.",
    inputSchema: {
      type: "object",
      required: ["course_id"],
      properties: {
        course_id: {
          type: "string",
          description: "Canvas course ID or SIS identifier.",
        },
        student_id: {
          type: "string",
          description: "Optional student_id for completion information. If omitted, the current student context is used.",
        },
        search_term: {
          type: "string",
          description: "Optional Canvas search_term filter.",
        },
        ...COMMON_LIST_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_course_modules arguments");
      const common = readCommonListArgs(args, ["course_id", "student_id", "search_term"], "canvas_list_course_modules");
      const courseId = normalizeString(args.course_id, "course_id");
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      addIncludeQuery(query, mergeIncludes(["items", "content_details"], common.include));
      appendMultiValue(query, "search_term", optionalString(args.search_term, "search_term"));
      appendMultiValue(query, "student_id", optionalString(args.student_id, "student_id"));
      appendMultiValue(query, "per_page", common.perPage);
      const envelope = await performCanvasListRequest({
        path: `/api/v1/courses/${encodeURIComponent(courseId)}/modules`,
        query,
        followPagination: common.followPagination,
        maxPages: common.maxPages,
      });
      return {
        ...envelope,
        summary: summarizeModules(envelope.data),
      };
    },
  },
  {
    name: "canvas_list_announcements",
    title: "List Announcements",
    description: "List Canvas announcements for one or more courses so Codex can summarize recent course communications.",
    inputSchema: {
      type: "object",
      properties: {
        course_ids: {
          type: "array",
          items: { type: "string" },
          description: "Optional course IDs to convert into context_codes[] automatically.",
        },
        context_codes: {
          type: "array",
          items: { type: "string" },
          description: "Optional explicit context_codes[] values such as course_42.",
        },
        start_date: {
          type: "string",
          description: "Optional start date in YYYY-MM-DD or ISO 8601 format. Defaults to 14 days ago.",
        },
        end_date: {
          type: "string",
          description: "Optional end date in YYYY-MM-DD or ISO 8601 format. Defaults to 28 days after start_date.",
        },
        latest_only: {
          type: "boolean",
          description: "If true, return only the latest announcement per context.",
        },
        active_only: {
          type: "boolean",
          description: "If true, return only active published announcements where supported.",
        },
        include: {
          type: "array",
          items: { type: "string" },
          description: "Optional include values such as sections or sections_user_count.",
        },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_announcements arguments");
      ensureAllowedKeys(
        args,
        ["course_ids", "context_codes", "start_date", "end_date", "latest_only", "active_only", "include", "per_page", "follow_pagination", "max_pages", "extra_query"],
        "canvas_list_announcements",
      );

      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      const courseIds = optionalStringArray(args.course_ids, "course_ids") ?? [];
      const contextCodes = optionalStringArray(args.context_codes, "context_codes") ?? [];
      const mergedContextCodes = [...new Set([...courseIds.map((courseId) => `course_${courseId}`), ...contextCodes])];
      if (mergedContextCodes.length === 0) {
        throw new JsonRpcError(-32602, "canvas_list_announcements requires course_ids or context_codes");
      }

      const startDate = optionalString(args.start_date, "start_date") ??
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const requestedEndDate = optionalString(args.end_date, "end_date");
      let endDate = requestedEndDate;
      if (endDate === undefined) {
        const parsedStartDate = Date.parse(startDate);
        if (!Number.isFinite(parsedStartDate)) {
          throw new JsonRpcError(
            -32602,
            "start_date must be YYYY-MM-DD or ISO 8601 when end_date is omitted",
          );
        }
        endDate = new Date(parsedStartDate + 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      }

      appendMultiValue(query, "context_codes[]", mergedContextCodes);
      appendMultiValue(query, "start_date", startDate);
      appendMultiValue(query, "end_date", endDate);
      appendMultiValue(query, "latest_only", optionalBoolean(args.latest_only, "latest_only"));
      appendMultiValue(query, "active_only", optionalBoolean(args.active_only, "active_only"));
      appendMultiValue(query, "include", optionalEnumArray(args.include, "include", ["sections", "sections_user_count"]));
      appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);

      const envelope = await performCanvasListRequest({
        path: "/api/v1/announcements",
        query,
        followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
        maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
      });

      return {
        ...envelope,
        summary: {
          ...summarizeAnnouncements(envelope.data),
          announcements: envelope.data.map(summarizeAnnouncement),
        },
      };
    },
  },
  {
    name: "canvas_request",
    title: "Canvas API Request",
    description: "Call an unsupported Canvas REST API endpoint on the configured Canvas host. This fallback is limited to student-relevant /api/v1 and /api/quiz/v1 paths.",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: {
          type: "string",
          description: "Root-relative Canvas REST path such as /api/v1/courses or /api/quiz/v1/courses/:course_id/quizzes/:assignment_id, or a same-origin absolute pageInfo.next URL under those prefixes.",
        },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          description: "HTTP method. Defaults to GET.",
        },
        query: {
          type: "object",
          description: "Flat query parameter object. Use exact Canvas keys such as include[] or state[].",
          additionalProperties: true,
        },
        body: {
          description: "Optional JSON or form body. For form-style Canvas writes, use flat keys such as assignment[name].",
        },
        body_format: {
          type: "string",
          enum: ["auto", "json", "form"],
          description: 'How to encode the request body. Defaults to "auto".',
        },
        allow_mutation: {
          type: "boolean",
          description: "Must be true for POST, PUT, PATCH, or DELETE requests.",
        },
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_request arguments");
      ensureAllowedKeys(args, ["path", "method", "query", "body", "body_format", "allow_mutation"], "canvas_request");

      const path = normalizeString(args.path, "path");
      const method = optionalEnum(args.method, "method", [...SUPPORTED_METHODS]) ?? "GET";
      const query = optionalFlatParamObject(args.query, "query");
      const bodyFormat = optionalEnum(args.body_format, "body_format", ["auto", "json", "form"]) ?? "auto";
      const allowMutation = optionalBoolean(args.allow_mutation, "allow_mutation") ?? false;

      if (method !== "GET" && !allowMutation) {
        throw new JsonRpcError(
          -32602,
          "Mutating Canvas requests require allow_mutation: true",
        );
      }

      const result = await performCanvasRequest({
        method,
        path,
        query,
        body: args.body,
        bodyFormat,
      });

      return buildEnvelope(result);
    },
  },
];
