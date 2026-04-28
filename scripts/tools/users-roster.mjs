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
  summarizeUsers,
} from "../canvas-mcp-core.mjs";

export const USER_ROSTER_TOOLS = [
  {
    name: "canvas_get_user_profile",
    title: "Get User Profile",
    description: "Read Canvas profile details for a user. Use user_id self for the current user.",
    inputSchema: {
      type: "object",
      required: ["user_id"],
      properties: {
        user_id: { type: "string", description: "Canvas user ID, SIS identifier, or self." },
        include: {
          type: "array",
          items: { type: "string", enum: ["links"] },
          description: "Optional profile include values. Canvas supports links.",
        },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_user_profile arguments");
      const { include, extraQuery } = readCommonGetArgs(args, ["user_id"], "canvas_get_user_profile");
      const query = {};
      mergeFlatParams(query, extraQuery);
      addIncludeQuery(query, optionalEnumArray(include, "include", ["links"]));
      const result = await performCanvasRequest({
        method: "GET",
        path: `/api/v1/users/${encodeURIComponent(normalizeString(args.user_id, "user_id"))}/profile`,
        query,
      });
      return buildEnvelope(result);
    },
  },
  {
    name: "canvas_list_course_users",
    title: "List Course Users",
    description: "List users in a course, optionally filtered by search term, role, section, state, or exact user IDs.",
    inputSchema: {
      type: "object",
      required: ["course_id"],
      properties: {
        course_id: { type: "string", description: "Canvas course ID or SIS identifier." },
        search_term: { type: "string", description: "Partial name or full ID to match." },
        sort: { type: "string", enum: ["username", "last_login", "email", "sis_id"] },
        enrollment_type: {
          type: "array",
          items: { type: "string", enum: ["teacher", "student", "student_view", "ta", "observer", "designer"] },
        },
        section_ids: { type: "array", items: { type: "string" } },
        user_id: { type: "string", description: "Return the page containing this user when present." },
        user_ids: { type: "array", items: { type: "string" } },
        enrollment_state: {
          type: "array",
          items: { type: "string", enum: ["active", "invited", "rejected", "completed", "inactive"] },
        },
        ...COMMON_LIST_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_course_users arguments");
      const common = readCommonListArgs(
        args,
        ["course_id", "search_term", "sort", "enrollment_type", "section_ids", "user_id", "user_ids", "enrollment_state"],
        "canvas_list_course_users",
      );
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      addIncludeQuery(query, mergeIncludes(["enrollments", "avatar_url"], common.include));
      appendMultiValue(query, "search_term", optionalString(args.search_term, "search_term"));
      appendMultiValue(query, "sort", optionalEnum(args.sort, "sort", ["username", "last_login", "email", "sis_id"]));
      appendMultiValue(query, "enrollment_type[]", optionalEnumArray(args.enrollment_type, "enrollment_type", ["teacher", "student", "student_view", "ta", "observer", "designer"]));
      appendMultiValue(query, "section_ids[]", optionalStringArray(args.section_ids, "section_ids"));
      appendMultiValue(query, "user_id", optionalString(args.user_id, "user_id"));
      appendMultiValue(query, "user_ids[]", optionalStringArray(args.user_ids, "user_ids"));
      appendMultiValue(query, "enrollment_state[]", optionalEnumArray(args.enrollment_state, "enrollment_state", ["active", "invited", "rejected", "completed", "inactive"]));
      appendMultiValue(query, "per_page", common.perPage);
      const envelope = await performCanvasListRequest({
        path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/users`,
        query,
        followPagination: common.followPagination,
        maxPages: common.maxPages,
      });
      return { ...envelope, summary: summarizeUsers(envelope.data) };
    },
  },
  {
    name: "canvas_get_course_user",
    title: "Get Course User",
    description: "Read one user's course-context record with optional enrollments and profile fields.",
    inputSchema: {
      type: "object",
      required: ["course_id", "user_id"],
      properties: {
        course_id: { type: "string", description: "Canvas course ID or SIS identifier." },
        user_id: { type: "string", description: "Canvas user ID, SIS identifier, or self." },
        ...COMMON_GET_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_course_user arguments");
      const { include, extraQuery } = readCommonGetArgs(args, ["course_id", "user_id"], "canvas_get_course_user");
      const query = {};
      mergeFlatParams(query, extraQuery);
      addIncludeQuery(query, mergeIncludes(["enrollments", "avatar_url"], include));
      const result = await performCanvasRequest({
        method: "GET",
        path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/users/${encodeURIComponent(normalizeString(args.user_id, "user_id"))}`,
        query,
      });
      return buildEnvelope(result);
    },
  },
  {
    name: "canvas_list_user_activity_stream",
    title: "List User Activity Stream",
    description: "List the current user's global Canvas activity stream.",
    inputSchema: {
      type: "object",
      properties: {
        only_active_courses: { type: "boolean", description: "If true, only include activity from active courses where supported." },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_user_activity_stream arguments");
      ensureAllowedKeys(args, ["only_active_courses", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_user_activity_stream");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "only_active_courses", optionalBoolean(args.only_active_courses, "only_active_courses"));
      appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
      return performCanvasListRequest({
        path: "/api/v1/users/self/activity_stream",
        query,
        followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
        maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
      });
    },
  },
  {
    name: "canvas_get_user_activity_summary",
    title: "Get User Activity Summary",
    description: "Read summary counts for the current user's Canvas activity stream.",
    inputSchema: {
      type: "object",
      properties: { extra_query: COMMON_GET_PROPERTIES.extra_query },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_user_activity_summary arguments");
      ensureAllowedKeys(args, ["extra_query"], "canvas_get_user_activity_summary");
      const result = await performCanvasRequest({
        method: "GET",
        path: "/api/v1/users/self/activity_stream/summary",
        query: optionalFlatParamObject(args.extra_query, "extra_query"),
      });
      return buildEnvelope(result);
    },
  },
  {
    name: "canvas_list_user_todo_items",
    title: "List User Todo Items",
    description: "List the current user's Canvas TODO items.",
    inputSchema: {
      type: "object",
      properties: {
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_user_todo_items arguments");
      ensureAllowedKeys(args, ["per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_user_todo_items");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
      return performCanvasListRequest({
        path: "/api/v1/users/self/todo",
        query,
        followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
        maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
      });
    },
  },
  {
    name: "canvas_get_user_todo_item_count",
    title: "Get User Todo Item Count",
    description: "Read Canvas TODO counts for the current user.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_user_todo_item_count arguments");
      ensureAllowedKeys(args, [], "canvas_get_user_todo_item_count");
      return buildEnvelope(await performCanvasRequest({ method: "GET", path: "/api/v1/users/self/todo_item_count" }));
    },
  },
  {
    name: "canvas_list_user_missing_submissions",
    title: "List User Missing Submissions",
    description: "List missing submissions for a Canvas user, optionally filtered by course.",
    inputSchema: {
      type: "object",
      required: ["user_id"],
      properties: {
        user_id: { type: "string", description: "Canvas user ID, SIS identifier, or self." },
        course_ids: { type: "array", items: { type: "string" }, description: "Optional repeated course_ids[] filter." },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_user_missing_submissions arguments");
      ensureAllowedKeys(args, ["user_id", "course_ids", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_user_missing_submissions");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "course_ids[]", optionalStringArray(args.course_ids, "course_ids"));
      appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
      return performCanvasListRequest({
        path: `/api/v1/users/${encodeURIComponent(normalizeString(args.user_id, "user_id"))}/missing_submissions`,
        query,
        followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
        maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
      });
    },
  },
  {
    name: "canvas_list_user_page_views",
    title: "List User Page Views",
    description: "List Canvas page views for a user. This can be permission-limited on many Canvas tenants.",
    inputSchema: {
      type: "object",
      required: ["user_id"],
      properties: {
        user_id: { type: "string", description: "Canvas user ID, SIS identifier, or self." },
        start_time: { type: "string", description: "Optional ISO 8601 lower bound." },
        end_time: { type: "string", description: "Optional ISO 8601 upper bound." },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_user_page_views arguments");
      ensureAllowedKeys(args, ["user_id", "start_time", "end_time", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_user_page_views");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "start_time", optionalString(args.start_time, "start_time"));
      appendMultiValue(query, "end_time", optionalString(args.end_time, "end_time"));
      appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
      return performCanvasListRequest({
        path: `/api/v1/users/${encodeURIComponent(normalizeString(args.user_id, "user_id"))}/page_views`,
        query,
        followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
        maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
      });
    },
  },
];
