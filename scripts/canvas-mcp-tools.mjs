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
} from "./canvas-mcp-core.mjs";

export const TOOL_DEFINITIONS = [
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
  {
    name: "canvas_list_upcoming_planner_items",
    title: "List Upcoming Planner Items",
    description: "List planner items that matter to a student, such as upcoming assignments and related submission status.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "Optional observed student user ID. If omitted, the current user is used.",
        },
        start_date: {
          type: "string",
          description: "Optional start date in YYYY-MM-DD or ISO 8601 format. Defaults to today.",
        },
        end_date: {
          type: "string",
          description: "Optional end date in YYYY-MM-DD or ISO 8601 format.",
        },
        days_ahead: {
          type: "integer",
          minimum: 1,
          maximum: 180,
          description: "If end_date is omitted, fetch planner items this many days ahead. Defaults to 14.",
        },
        context_codes: {
          type: "array",
          items: { type: "string" },
          description: "Optional repeated context_codes[] values such as course_42.",
        },
        observed_user_id: {
          type: "string",
          description: "Optional observed_user_id query parameter for observer workflows.",
        },
        filter: {
          type: "array",
          items: { type: "string" },
          description: "Optional repeated planner filter values.",
        },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_upcoming_planner_items arguments");
      ensureAllowedKeys(
        args,
        ["user_id", "start_date", "end_date", "days_ahead", "context_codes", "observed_user_id", "filter", "per_page", "follow_pagination", "max_pages", "extra_query"],
        "canvas_list_upcoming_planner_items",
      );

      const query = {};
      const extraQuery = optionalFlatParamObject(args.extra_query, "extra_query");
      mergeFlatParams(query, extraQuery);

      const daysAhead = optionalInteger(args.days_ahead, "days_ahead", 1, 180) ?? 14;
      const { startDate, endDate } = resolveDateWindow({
        startDate: optionalString(args.start_date, "start_date"),
        endDate: optionalString(args.end_date, "end_date"),
        daysAhead,
      });
      const contextCodes = optionalStringArray(args.context_codes, "context_codes");
      const filterValues =
        optionalEnumArray(args.filter, "filter", ["new_activity", "incomplete_items", "complete_items"]) ?? ["incomplete_items"];
      const perPage = optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE;
      const followPagination = optionalBoolean(args.follow_pagination, "follow_pagination") ?? false;
      const maxPages = optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES;

      appendMultiValue(query, "start_date", startDate);
      appendMultiValue(query, "end_date", endDate);
      appendMultiValue(query, "context_codes[]", contextCodes);
      appendMultiValue(query, "observed_user_id", optionalString(args.observed_user_id, "observed_user_id"));
      appendMultiValue(query, "filter", filterValues);
      appendMultiValue(query, "per_page", perPage);

      const userId = optionalString(args.user_id, "user_id");
      const path = userId
        ? `/api/v1/users/${encodeURIComponent(userId)}/planner/items`
        : "/api/v1/planner/items";

      const envelope = await performCanvasListRequest({
        path,
        query,
        followPagination,
        maxPages,
      });

      return {
        ...envelope,
        summary: summarizePlannerItems(envelope.data),
      };
    },
  },
  {
    name: "canvas_list_calendar_items",
    title: "List Calendar Items",
    description: "List student-visible Canvas calendar items such as assignment due dates or calendar events.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "Optional observed user ID. If omitted, the current user is used.",
        },
        type: {
          type: "string",
          enum: ["event", "assignment", "sub_assignment"],
          description: "Calendar item type. Defaults to assignment for student due-date workflows.",
        },
        start_date: {
          type: "string",
          description: "Optional start date in YYYY-MM-DD or ISO 8601 format. Ignored when all_events or undated is true.",
        },
        end_date: {
          type: "string",
          description: "Optional end date in YYYY-MM-DD or ISO 8601 format. Ignored when all_events or undated is true.",
        },
        days_ahead: {
          type: "integer",
          minimum: 1,
          maximum: 180,
          description: "If end_date is omitted, fetch calendar items this many days ahead. Defaults to 14.",
        },
        undated: {
          type: "boolean",
          description: "If true, return only undated items.",
        },
        all_events: {
          type: "boolean",
          description: "If true, ignore date filters and return all matching items.",
        },
        context_codes: {
          type: "array",
          items: { type: "string" },
          description: "Optional repeated context_codes[] values such as course_42.",
        },
        includes: {
          type: "array",
          items: { type: "string" },
          description: "Optional repeated includes[] values such as web_conference or series_natural_language.",
        },
        excludes: {
          type: "array",
          items: { type: "string" },
          description: "Optional repeated excludes[] values such as description, child_events, or assignment.",
        },
        important_dates: {
          type: "boolean",
          description: "If true, return only important dates.",
        },
        blackout_date: {
          type: "boolean",
          description: "If true, return only blackout dates.",
        },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_calendar_items arguments");
      ensureAllowedKeys(
        args,
        [
          "user_id",
          "type",
          "start_date",
          "end_date",
          "days_ahead",
          "undated",
          "all_events",
          "context_codes",
          "includes",
          "excludes",
          "important_dates",
          "blackout_date",
          "per_page",
          "follow_pagination",
          "max_pages",
          "extra_query",
        ],
        "canvas_list_calendar_items",
      );

      const query = {};
      const extraQuery = optionalFlatParamObject(args.extra_query, "extra_query");
      mergeFlatParams(query, extraQuery);

      const daysAhead = optionalInteger(args.days_ahead, "days_ahead", 1, 180) ?? 14;
      const undated = optionalBoolean(args.undated, "undated");
      const allEvents = optionalBoolean(args.all_events, "all_events");
      const { startDate, endDate } = resolveDateWindow({
        startDate: optionalString(args.start_date, "start_date"),
        endDate: optionalString(args.end_date, "end_date"),
        daysAhead,
      });
      const includes = optionalEnumArray(args.includes, "includes", ["web_conference", "series_natural_language"]);
      const excludes = optionalEnumArray(args.excludes, "excludes", ["description", "child_events", "assignment"]);
      const perPage = optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE;
      const followPagination = optionalBoolean(args.follow_pagination, "follow_pagination") ?? false;
      const maxPages = optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES;

      appendMultiValue(query, "type", optionalEnum(args.type, "type", ["event", "assignment", "sub_assignment"]) ?? "assignment");
      appendMultiValue(query, "undated", undated);
      appendMultiValue(query, "all_events", allEvents);
      if (!undated && !allEvents) {
        appendMultiValue(query, "start_date", startDate);
        appendMultiValue(query, "end_date", endDate);
      }
      appendMultiValue(query, "context_codes[]", optionalStringArray(args.context_codes, "context_codes"));
      appendMultiValue(query, "includes[]", includes);
      appendMultiValue(query, "excludes[]", excludes);
      appendMultiValue(query, "important_dates", optionalBoolean(args.important_dates, "important_dates"));
      appendMultiValue(query, "blackout_date", optionalBoolean(args.blackout_date, "blackout_date"));
      appendMultiValue(query, "per_page", perPage);

      const userId = optionalString(args.user_id, "user_id");
      const path = userId
        ? `/api/v1/users/${encodeURIComponent(userId)}/calendar_events`
        : "/api/v1/calendar_events";

      const envelope = await performCanvasListRequest({
        path,
        query,
        followPagination,
        maxPages,
      });

      return {
        ...envelope,
        summary: {
          ...summarizeCalendarItems(envelope.data),
          items: envelope.data.map(summarizeCalendarItem),
        },
      };
    },
  },
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

export const TOOL_LOOKUP = new Map(TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));

export function serializeTool(tool) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
  };
}
