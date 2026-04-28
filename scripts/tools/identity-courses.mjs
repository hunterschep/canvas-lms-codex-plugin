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

export const IDENTITY_COURSE_TOOLS = [
  {
    name: "canvas_get_current_user_profile",
    title: "Get Current User Profile",
    description: "Read the current Canvas user's profile using the configured access token.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_current_user_profile arguments");
      ensureAllowedKeys(args, [], "canvas_get_current_user_profile");
      const result = await performCanvasRequest({
        method: "GET",
        path: "/api/v1/users/self/profile",
      });
      return buildEnvelope(result);
    },
  },
  {
    name: "canvas_list_student_courses",
    title: "List Student Courses",
    description: "List the current user's student courses with grade-related course data when Canvas exposes it.",
    inputSchema: {
      type: "object",
      properties: {
        enrollment_state: {
          type: "string",
          enum: ["active", "invited_or_pending", "completed"],
          description: "Optional course enrollment state filter.",
        },
        state: {
          type: "array",
          items: { type: "string" },
          description: "Optional repeated course state[] values.",
        },
        ...COMMON_LIST_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_student_courses arguments");
      const common = readCommonListArgs(args, ["enrollment_state", "state"], "canvas_list_student_courses");
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      addIncludeQuery(
        query,
        mergeIncludes(
          ["total_scores", "current_grading_period_scores", "favorites", "term", "teachers", "concluded"],
          common.include,
        ),
      );
      appendMultiValue(query, "enrollment_type", "student");
      appendMultiValue(query, "enrollment_state", optionalString(args.enrollment_state, "enrollment_state"));
      appendMultiValue(
        query,
        "state[]",
        optionalEnumArray(args.state, "state", ["unpublished", "available", "completed", "deleted"]) ?? ["available", "completed"],
      );
      appendMultiValue(query, "per_page", common.perPage);
      const envelope = await performCanvasListRequest({
        path: "/api/v1/courses",
        query,
        followPagination: common.followPagination,
        maxPages: common.maxPages,
      });
      return {
        ...envelope,
        summary: {
          courseCount: envelope.data.length,
          courses: envelope.data.map(summarizeStudentCourse),
        },
      };
    },
  },
  {
    name: "canvas_get_student_course",
    title: "Get Student Course",
    description: "Read a single course with student-friendly grade and course metadata when available.",
    inputSchema: {
      type: "object",
      required: ["course_id"],
      properties: {
        course_id: {
          type: "string",
          description: "Canvas course ID or SIS identifier such as sis_course_id:ABC123.",
        },
        ...COMMON_GET_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_student_course arguments");
      const { include, extraQuery } = readCommonGetArgs(args, ["course_id"], "canvas_get_student_course");
      const courseId = normalizeString(args.course_id, "course_id");
      const query = {};
      mergeFlatParams(query, extraQuery);
      addIncludeQuery(
        query,
        mergeIncludes(
          ["total_scores", "current_grading_period_scores", "term", "teachers", "sections", "concluded"],
          include,
        ),
      );
      const result = await performCanvasRequest({
        method: "GET",
        path: `/api/v1/courses/${encodeURIComponent(courseId)}`,
        query,
      });
      return {
        ...buildEnvelope(result),
        summary: summarizeStudentCourse(result.data),
      };
    },
  },
  {
    name: "canvas_get_course_grade_summary",
    title: "Get Course Grade Summary",
    description: "Read the current student's enrollment-grade summary for a course, including grading-period data when Canvas exposes it.",
    inputSchema: {
      type: "object",
      required: ["course_id"],
      properties: {
        course_id: {
          type: "string",
          description: "Canvas course ID or SIS identifier.",
        },
        user_id: {
          type: "string",
          description: "Optional user ID. If omitted, the current Canvas user is resolved automatically.",
        },
        grading_period_id: {
          type: "integer",
          description: "Optional grading_period_id filter. If omitted, Canvas returns whole-course grades.",
        },
        state: {
          type: "array",
          items: { type: "string" },
          description: "Optional repeated enrollment state[] values. Defaults to active and completed.",
        },
        ...COMMON_GET_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_course_grade_summary arguments");
      const { include, extraQuery } = readCommonGetArgs(
        args,
        ["course_id", "user_id", "grading_period_id", "state"],
        "canvas_get_course_grade_summary",
      );
      const courseId = normalizeString(args.course_id, "course_id");
      let userId = optionalString(args.user_id, "user_id");
      if (userId === undefined) {
        const profileResult = await performCanvasRequest({
          method: "GET",
          path: "/api/v1/users/self/profile",
        });
        const profileId = profileResult.data?.id;
        if (profileId === undefined || profileId === null || `${profileId}`.trim() === "") {
          throw new ToolExecutionError("Could not determine the current Canvas user ID for grade lookup.");
        }
        userId = String(profileId);
      }

      const query = {};
      mergeFlatParams(query, extraQuery);
      addIncludeQuery(query, mergeIncludes(["current_points"], include));
      appendMultiValue(query, "user_id", userId);
      appendMultiValue(query, "type[]", "StudentEnrollment");
      appendMultiValue(
        query,
        "state[]",
        optionalEnumArray(args.state, "state", [
          "active",
          "invited",
          "creation_pending",
          "deleted",
          "rejected",
          "completed",
          "inactive",
          "current_and_invited",
          "current_and_future",
          "current_future_and_restricted",
          "current_and_concluded",
        ]) ?? ["active", "completed"],
      );
      appendMultiValue(
        query,
        "grading_period_id",
        optionalInteger(args.grading_period_id, "grading_period_id", 1, Number.MAX_SAFE_INTEGER),
      );
      appendMultiValue(query, "per_page", DEFAULT_PER_PAGE);

      const result = await performCanvasRequest({
        method: "GET",
        path: `/api/v1/courses/${encodeURIComponent(courseId)}/enrollments`,
        query,
      });

      if (!Array.isArray(result.data)) {
        throw new ToolExecutionError("Expected the course enrollments endpoint to return an array.", {
          path: result.meta.request.path,
          receivedType: typeof result.data,
        });
      }

      const enrollments = result.data.map(summarizeGradeEnrollment);
      return {
        ...buildEnvelope(result),
        summary: {
          resolvedUserId: userId,
          enrollmentCount: enrollments.length,
          primaryEnrollment: enrollments[0] ?? null,
          enrollments,
        },
      };
    },
  },
];
