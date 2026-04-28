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

export const QUIZ_TOOLS = [
  {
    name: "canvas_get_assignment",
    title: "Get Assignment",
    description: "Read a specific assignment in a Canvas course.",
    inputSchema: {
      type: "object",
      required: ["course_id", "assignment_id"],
      properties: {
        course_id: {
          type: "string",
          description: "Canvas course ID or SIS identifier.",
        },
        assignment_id: {
          type: "string",
          description: "Canvas assignment ID.",
        },
        ...COMMON_GET_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_assignment arguments");
      const { include, extraQuery } = readCommonGetArgs(args, ["course_id", "assignment_id"], "canvas_get_assignment");
      const courseId = normalizeString(args.course_id, "course_id");
      const assignmentId = normalizeString(args.assignment_id, "assignment_id");
      const query = {};
      mergeFlatParams(query, extraQuery);
      addIncludeQuery(query, mergeIncludes(["submission"], include));
      const result = await performCanvasRequest({
        method: "GET",
        path: `/api/v1/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}`,
        query,
      });
      return {
        ...buildEnvelope(result),
        summary: summarizeAssignments([result.data]),
      };
    },
  },
  {
    name: "canvas_list_course_quizzes",
    title: "List Course Quizzes",
    description: "List classic quizzes in a course so Codex can summarize quiz titles, due dates, and availability.",
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
          description: "Optional partial quiz title match.",
        },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_course_quizzes arguments");
      ensureAllowedKeys(
        args,
        ["course_id", "search_term", "per_page", "follow_pagination", "max_pages", "extra_query"],
        "canvas_list_course_quizzes",
      );
      const courseId = normalizeString(args.course_id, "course_id");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "search_term", optionalString(args.search_term, "search_term"));
      appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
      const envelope = await performCanvasListRequest({
        path: `/api/v1/courses/${encodeURIComponent(courseId)}/quizzes`,
        query,
        followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
        maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
      });
      return {
        ...envelope,
        summary: {
          ...summarizeQuizzes(envelope.data),
          quizzes: envelope.data.map(summarizeQuiz),
        },
      };
    },
  },
  {
    name: "canvas_get_quiz",
    title: "Get Quiz",
    description: "Read a specific classic Canvas quiz.",
    inputSchema: {
      type: "object",
      required: ["course_id", "quiz_id"],
      properties: {
        course_id: {
          type: "string",
          description: "Canvas course ID or SIS identifier.",
        },
        quiz_id: {
          type: "string",
          description: "Canvas quiz ID.",
        },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_quiz arguments");
      ensureAllowedKeys(args, ["course_id", "quiz_id", "extra_query"], "canvas_get_quiz");
      const courseId = normalizeString(args.course_id, "course_id");
      const quizId = normalizeString(args.quiz_id, "quiz_id");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      const result = await performCanvasRequest({
        method: "GET",
        path: `/api/v1/courses/${encodeURIComponent(courseId)}/quizzes/${encodeURIComponent(quizId)}`,
        query,
      });
      return {
        ...buildEnvelope(result),
        summary: summarizeQuiz(result.data),
      };
    },
  },
  {
    name: "canvas_get_new_quiz",
    title: "Get New Quiz",
    description: "Read a single New Quiz by course ID and assignment ID when a course uses the separate New Quizzes API.",
    inputSchema: {
      type: "object",
      required: ["course_id", "assignment_id"],
      properties: {
        course_id: {
          type: "string",
          description: "Canvas course ID or SIS identifier.",
        },
        assignment_id: {
          type: "string",
          description: "The assignment ID associated with the New Quiz.",
        },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_new_quiz arguments");
      ensureAllowedKeys(args, ["course_id", "assignment_id", "extra_query"], "canvas_get_new_quiz");
      const courseId = normalizeString(args.course_id, "course_id");
      const assignmentId = normalizeString(args.assignment_id, "assignment_id");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      const result = await performCanvasRequest({
        method: "GET",
        path: `/api/quiz/v1/courses/${encodeURIComponent(courseId)}/quizzes/${encodeURIComponent(assignmentId)}`,
        query,
      });
      return {
        ...buildEnvelope(result),
        summary: summarizeNewQuiz(result.data),
      };
    },
  },
];
