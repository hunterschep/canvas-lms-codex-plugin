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

export const SUBMISSION_TOOLS = [
  {
    name: "canvas_list_student_submissions",
    title: "List Student Submissions",
    description: "List the current student's submissions in a course, with filters for graded and unsubmitted work.",
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
          description: "Optional observed student ID. If omitted, Canvas returns submissions for the current user.",
        },
        assignment_ids: {
          type: "array",
          items: { type: "string" },
          description: "Optional repeated assignment_ids[] values.",
        },
        submitted_since: {
          type: "string",
          description: "Optional ISO 8601 submitted_since filter.",
        },
        graded_since: {
          type: "string",
          description: "Optional ISO 8601 graded_since filter.",
        },
        grading_period_id: {
          type: "integer",
          description: "Optional grading_period_id filter.",
        },
        workflow_state: {
          type: "string",
          enum: ["submitted", "unsubmitted", "graded", "pending_review"],
          description: "Optional submission workflow_state filter.",
        },
        enrollment_state: {
          type: "string",
          enum: ["active", "concluded"],
          description: "Optional enrollment_state filter.",
        },
        order: {
          type: "string",
          enum: ["id", "graded_at"],
          description: "Order submissions. Defaults to graded_at.",
        },
        order_direction: {
          type: "string",
          enum: ["ascending", "descending"],
          description: "Order direction. Defaults to descending.",
        },
        ...COMMON_LIST_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_student_submissions arguments");
      const common = readCommonListArgs(
        args,
        ["course_id", "student_id", "assignment_ids", "submitted_since", "graded_since", "grading_period_id", "workflow_state", "enrollment_state", "order", "order_direction"],
        "canvas_list_student_submissions",
      );
      const courseId = normalizeString(args.course_id, "course_id");
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      appendStudentSubmissionsQuery(query, {
        include: mergeIncludes(["assignment", "course", "submission_comments"], common.include),
        studentId: args.student_id === undefined ? undefined : normalizeString(args.student_id, "student_id"),
        assignmentIds: optionalStringArray(args.assignment_ids, "assignment_ids"),
        submittedSince: optionalString(args.submitted_since, "submitted_since"),
        gradedSince: optionalString(args.graded_since, "graded_since"),
        gradingPeriodId: optionalInteger(args.grading_period_id, "grading_period_id", 1, Number.MAX_SAFE_INTEGER),
        workflowState: optionalEnum(args.workflow_state, "workflow_state", ["submitted", "unsubmitted", "graded", "pending_review"]),
        enrollmentState: optionalEnum(args.enrollment_state, "enrollment_state", ["active", "concluded"]),
        order: optionalEnum(args.order, "order", ["id", "graded_at"]) ?? "graded_at",
        orderDirection: optionalEnum(args.order_direction, "order_direction", ["ascending", "descending"]) ?? "descending",
        perPage: common.perPage,
      });
      const envelope = await performCanvasListRequest({
        path: `/api/v1/courses/${encodeURIComponent(courseId)}/students/submissions`,
        query,
        followPagination: common.followPagination,
        maxPages: common.maxPages,
      });
      return {
        ...envelope,
        summary: summarizeSubmissions(envelope.data),
      };
    },
  },
  {
    name: "canvas_list_graded_assignments",
    title: "List Graded Assignments",
    description: "List graded assignment submissions in a course, ordered for student review of scores and feedback.",
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
          description: "Optional observed student ID. If omitted, Canvas returns graded work for the current user.",
        },
        assignment_ids: {
          type: "array",
          items: { type: "string" },
          description: "Optional repeated assignment_ids[] values.",
        },
        graded_since: {
          type: "string",
          description: "Optional ISO 8601 graded_since filter.",
        },
        grading_period_id: {
          type: "integer",
          description: "Optional grading_period_id filter.",
        },
        enrollment_state: {
          type: "string",
          enum: ["active", "concluded"],
          description: "Optional enrollment_state filter.",
        },
        order: {
          type: "string",
          enum: ["id", "graded_at"],
          description: "Order graded submissions. Defaults to graded_at.",
        },
        order_direction: {
          type: "string",
          enum: ["ascending", "descending"],
          description: "Order direction. Defaults to descending.",
        },
        ...COMMON_LIST_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_graded_assignments arguments");
      const common = readCommonListArgs(
        args,
        ["course_id", "student_id", "assignment_ids", "graded_since", "grading_period_id", "enrollment_state", "order", "order_direction"],
        "canvas_list_graded_assignments",
      );
      const courseId = normalizeString(args.course_id, "course_id");
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      appendStudentSubmissionsQuery(query, {
        include: mergeIncludes(["assignment", "course", "submission_comments"], common.include),
        studentId: args.student_id === undefined ? undefined : normalizeString(args.student_id, "student_id"),
        assignmentIds: optionalStringArray(args.assignment_ids, "assignment_ids"),
        submittedSince: undefined,
        gradedSince: optionalString(args.graded_since, "graded_since"),
        gradingPeriodId: optionalInteger(args.grading_period_id, "grading_period_id", 1, Number.MAX_SAFE_INTEGER),
        workflowState: "graded",
        enrollmentState: optionalEnum(args.enrollment_state, "enrollment_state", ["active", "concluded"]),
        order: optionalEnum(args.order, "order", ["id", "graded_at"]) ?? "graded_at",
        orderDirection: optionalEnum(args.order_direction, "order_direction", ["ascending", "descending"]) ?? "descending",
        perPage: common.perPage,
      });
      const envelope = await performCanvasListRequest({
        path: `/api/v1/courses/${encodeURIComponent(courseId)}/students/submissions`,
        query,
        followPagination: common.followPagination,
        maxPages: common.maxPages,
      });
      return {
        ...envelope,
        summary: summarizeSubmissions(envelope.data),
      };
    },
  },
  {
    name: "canvas_get_submission",
    title: "Get Submission",
    description: "Read a single submission for a student assignment, including comments and rubric/read state when requested.",
    inputSchema: {
      type: "object",
      required: ["course_id", "assignment_id", "user_id"],
      properties: {
        course_id: {
          type: "string",
          description: "Canvas course ID or SIS identifier.",
        },
        assignment_id: {
          type: "string",
          description: "Canvas assignment ID.",
        },
        user_id: {
          type: "string",
          description: "Canvas user ID, SIS identifier, or self where supported.",
        },
        ...COMMON_GET_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_submission arguments");
      const { include, extraQuery } = readCommonGetArgs(
        args,
        ["course_id", "assignment_id", "user_id"],
        "canvas_get_submission",
      );
      const courseId = normalizeString(args.course_id, "course_id");
      const assignmentId = normalizeString(args.assignment_id, "assignment_id");
      const userId = normalizeString(args.user_id, "user_id");
      const query = {};
      mergeFlatParams(query, extraQuery);
      addIncludeQuery(
        query,
        mergeIncludes(["submission_comments", "course", "read_status", "rubric_assessment"], include),
      );
      const result = await performCanvasRequest({
        method: "GET",
        path: `/api/v1/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(userId)}`,
        query,
      });
      return {
        ...buildEnvelope(result),
        summary: summarizeSubmissions([result.data]),
      };
    },
  },
];
