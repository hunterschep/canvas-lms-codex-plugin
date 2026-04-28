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

export const PLANNING_CALENDAR_TOOLS = [
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
];
