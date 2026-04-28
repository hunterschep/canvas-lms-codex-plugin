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
  optionalString,
  optionalStringArray,
  performCanvasListRequest,
  performCanvasRequest,
  readCommonListArgs,
  summarizeConversations,
  summarizeGroups,
  summarizeRecipients,
} from "../canvas-mcp-core.mjs";

const CONVERSATION_SCOPES = ["unread", "starred", "archived", "sent"];
const CONVERSATION_FILTER_MODES = ["and", "or", "default or"];
const CONVERSATION_INCLUDES = ["participant_avatars", "uuid"];
const RECIPIENT_TYPES = ["user", "context"];
const RECIPIENT_TYPE_VALUES = ["context", "course", "section", "group", "user"];
const SMART_SEARCH_INCLUDES = ["status", "modules"];

function appendPaging(query, args, name) {
  appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
  return {
    followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
    maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
  };
}

function appendRecipientSearchQuery(query, args) {
  appendMultiValue(query, "search", optionalString(args.search, "search"));
  appendMultiValue(query, "context", optionalString(args.context, "context"));
  appendMultiValue(query, "exclude[]", optionalStringArray(args.exclude, "exclude"));
  appendMultiValue(query, "type", optionalEnum(args.type, "type", RECIPIENT_TYPES));
  appendMultiValue(query, "types[]", optionalEnumArray(args.types, "types", RECIPIENT_TYPE_VALUES));
  appendMultiValue(query, "user_id", optionalString(args.user_id, "user_id"));
  appendMultiValue(query, "from_conversation_id", optionalString(args.from_conversation_id, "from_conversation_id"));
  appendMultiValue(query, "permissions[]", optionalStringArray(args.permissions, "permissions"));
}

async function listRecipients(path, args, toolName) {
  ensureAllowedKeys(args, ["search", "context", "exclude", "type", "types", "user_id", "from_conversation_id", "permissions", "per_page", "follow_pagination", "max_pages", "extra_query"], toolName);
  const query = {};
  mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
  appendRecipientSearchQuery(query, args);
  const paging = appendPaging(query, args, toolName);
  const envelope = await performCanvasListRequest({ path, query, ...paging });
  return { ...envelope, summary: summarizeRecipients(envelope.data) };
}

export const COMMUNICATION_SEARCH_TOOLS = [
  {
    name: "canvas_list_conversations",
    title: "List Conversations",
    description: "List the current user's Canvas inbox conversations with filters for unread, starred, archived, sent, or context.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: CONVERSATION_SCOPES },
        filter: { type: "array", items: { type: "string" }, description: "Conversation filters such as course_123, group_456, user_789, or uuid:<uuid>." },
        filter_mode: { type: "string", enum: CONVERSATION_FILTER_MODES },
        interleave_submissions: { type: "boolean" },
        include_all_conversation_ids: { type: "boolean" },
        include: { type: "array", items: { type: "string", enum: CONVERSATION_INCLUDES } },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_conversations arguments");
      ensureAllowedKeys(args, ["scope", "filter", "filter_mode", "interleave_submissions", "include_all_conversation_ids", "include", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_conversations");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "scope", optionalEnum(args.scope, "scope", CONVERSATION_SCOPES));
      appendMultiValue(query, "filter[]", optionalStringArray(args.filter, "filter"));
      appendMultiValue(query, "filter_mode", optionalEnum(args.filter_mode, "filter_mode", CONVERSATION_FILTER_MODES));
      appendMultiValue(query, "interleave_submissions", optionalBoolean(args.interleave_submissions, "interleave_submissions"));
      appendMultiValue(query, "include_all_conversation_ids", optionalBoolean(args.include_all_conversation_ids, "include_all_conversation_ids"));
      addIncludeQuery(query, optionalEnumArray(args.include, "include", CONVERSATION_INCLUDES));
      const paging = appendPaging(query, args, "canvas_list_conversations");
      if (args.include_all_conversation_ids === true) {
        const result = await performCanvasRequest({ method: "GET", path: "/api/v1/conversations", query });
        return { ...buildEnvelope(result), summary: summarizeConversations(result.data) };
      }
      const envelope = await performCanvasListRequest({ path: "/api/v1/conversations", query, ...paging });
      return { ...envelope, summary: summarizeConversations(envelope.data) };
    },
  },
  {
    name: "canvas_get_conversation",
    title: "Get Conversation",
    description: "Read a single Canvas conversation, including messages and participants.",
    inputSchema: {
      type: "object",
      required: ["conversation_id"],
      properties: {
        conversation_id: { type: "string", description: "Canvas conversation ID." },
        scope: { type: "string", enum: ["unread", "starred", "archived"] },
        filter: { type: "array", items: { type: "string" } },
        filter_mode: { type: "string", enum: CONVERSATION_FILTER_MODES },
        interleave_submissions: { type: "boolean" },
        auto_mark_as_read: { type: "boolean" },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_conversation arguments");
      ensureAllowedKeys(args, ["conversation_id", "scope", "filter", "filter_mode", "interleave_submissions", "auto_mark_as_read", "extra_query"], "canvas_get_conversation");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "scope", optionalEnum(args.scope, "scope", ["unread", "starred", "archived"]));
      appendMultiValue(query, "filter[]", optionalStringArray(args.filter, "filter"));
      appendMultiValue(query, "filter_mode", optionalEnum(args.filter_mode, "filter_mode", CONVERSATION_FILTER_MODES));
      appendMultiValue(query, "interleave_submissions", optionalBoolean(args.interleave_submissions, "interleave_submissions"));
      appendMultiValue(query, "auto_mark_as_read", optionalBoolean(args.auto_mark_as_read, "auto_mark_as_read"));
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: `/api/v1/conversations/${encodeURIComponent(normalizeString(args.conversation_id, "conversation_id"))}`,
        query,
      }));
    },
  },
  {
    name: "canvas_get_conversations_unread_count",
    title: "Get Conversations Unread Count",
    description: "Read the current user's unread Canvas conversation count.",
    inputSchema: { type: "object", properties: { extra_query: COMMON_GET_PROPERTIES.extra_query }, additionalProperties: false },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_conversations_unread_count arguments");
      ensureAllowedKeys(args, ["extra_query"], "canvas_get_conversations_unread_count");
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: "/api/v1/conversations/unread_count",
        query: optionalFlatParamObject(args.extra_query, "extra_query"),
      }));
    },
  },
  {
    name: "canvas_find_conversation_recipients",
    title: "Find Conversation Recipients",
    description: "Use the legacy Canvas conversations recipient search endpoint. Prefer canvas_search_recipients for new workflows.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        context: { type: "string" },
        exclude: { type: "array", items: { type: "string" } },
        type: { type: "string", enum: RECIPIENT_TYPES },
        types: { type: "array", items: { type: "string", enum: RECIPIENT_TYPE_VALUES } },
        user_id: { type: "string" },
        from_conversation_id: { type: "string" },
        permissions: { type: "array", items: { type: "string" } },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      return listRecipients("/api/v1/conversations/find_recipients", ensureObject(rawArgs ?? {}, "canvas_find_conversation_recipients arguments"), "canvas_find_conversation_recipients");
    },
  },
  {
    name: "canvas_search_recipients",
    title: "Search Recipients",
    description: "Find valid Canvas message recipients across users, courses, groups, and sections.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        context: { type: "string" },
        exclude: { type: "array", items: { type: "string" } },
        type: { type: "string", enum: RECIPIENT_TYPES },
        types: { type: "array", items: { type: "string", enum: RECIPIENT_TYPE_VALUES } },
        user_id: { type: "string" },
        from_conversation_id: { type: "string" },
        permissions: { type: "array", items: { type: "string" } },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      return listRecipients("/api/v1/search/recipients", ensureObject(rawArgs ?? {}, "canvas_search_recipients arguments"), "canvas_search_recipients");
    },
  },
  {
    name: "canvas_search_all_courses",
    title: "Search All Courses",
    description: "Search the public Canvas course index.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        public_only: { type: "boolean" },
        open_enrollment_only: { type: "boolean" },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_search_all_courses arguments");
      ensureAllowedKeys(args, ["search", "public_only", "open_enrollment_only", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_search_all_courses");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "search", optionalString(args.search, "search"));
      appendMultiValue(query, "public_only", optionalBoolean(args.public_only, "public_only"));
      appendMultiValue(query, "open_enrollment_only", optionalBoolean(args.open_enrollment_only, "open_enrollment_only"));
      const paging = appendPaging(query, args, "canvas_search_all_courses");
      return performCanvasListRequest({ path: "/api/v1/search/all_courses", query, ...paging });
    },
  },
  {
    name: "canvas_search_course_content",
    title: "Search Course Content",
    description: "Run Canvas Smart Search against pages, assignments, announcements, and discussion topics in a course.",
    inputSchema: {
      type: "object",
      required: ["course_id", "query"],
      properties: {
        course_id: { type: "string", description: "Canvas course ID or SIS identifier." },
        query: { type: "string", description: "Semantic search query." },
        filter: { type: "array", items: { type: "string" }, description: "Object types such as pages, assignments, announcements, or discussion_topics." },
        include: { type: "array", items: { type: "string", enum: SMART_SEARCH_INCLUDES } },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_search_course_content arguments");
      ensureAllowedKeys(args, ["course_id", "query", "filter", "include", "extra_query"], "canvas_search_course_content");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "q", normalizeString(args.query, "query"));
      appendMultiValue(query, "filter[]", optionalStringArray(args.filter, "filter"));
      addIncludeQuery(query, optionalEnumArray(args.include, "include", SMART_SEARCH_INCLUDES));
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/smartsearch`,
        query,
      }));
    },
  },
  {
    name: "canvas_list_bookmarks",
    title: "List Bookmarks",
    description: "List the current user's Canvas bookmarks.",
    inputSchema: { type: "object", properties: { ...COMMON_LIST_PROPERTIES }, additionalProperties: false },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_bookmarks arguments");
      const common = readCommonListArgs(args, [], "canvas_list_bookmarks");
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      appendMultiValue(query, "per_page", common.perPage);
      return performCanvasListRequest({ path: "/api/v1/users/self/bookmarks", query, followPagination: common.followPagination, maxPages: common.maxPages });
    },
  },
  {
    name: "canvas_get_bookmark",
    title: "Get Bookmark",
    description: "Read one Canvas bookmark for the current user.",
    inputSchema: {
      type: "object",
      required: ["bookmark_id"],
      properties: { bookmark_id: { type: "string", description: "Canvas bookmark ID." }, extra_query: COMMON_GET_PROPERTIES.extra_query },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_bookmark arguments");
      ensureAllowedKeys(args, ["bookmark_id", "extra_query"], "canvas_get_bookmark");
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: `/api/v1/users/self/bookmarks/${encodeURIComponent(normalizeString(args.bookmark_id, "bookmark_id"))}`,
        query: optionalFlatParamObject(args.extra_query, "extra_query"),
      }));
    },
  },
  {
    name: "canvas_list_favorite_courses",
    title: "List Favorite Courses",
    description: "List the current user's favorite courses or Canvas fallback course selection.",
    inputSchema: {
      type: "object",
      properties: {
        exclude_blueprint_courses: { type: "boolean" },
        ...COMMON_LIST_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_favorite_courses arguments");
      const common = readCommonListArgs(args, ["exclude_blueprint_courses"], "canvas_list_favorite_courses");
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      addIncludeQuery(query, common.include);
      appendMultiValue(query, "exclude_blueprint_courses", optionalBoolean(args.exclude_blueprint_courses, "exclude_blueprint_courses"));
      appendMultiValue(query, "per_page", common.perPage);
      return performCanvasListRequest({ path: "/api/v1/users/self/favorites/courses", query, followPagination: common.followPagination, maxPages: common.maxPages });
    },
  },
  {
    name: "canvas_list_favorite_groups",
    title: "List Favorite Groups",
    description: "List the current user's favorite Canvas groups or fallback group selection.",
    inputSchema: { type: "object", properties: { ...COMMON_LIST_PROPERTIES }, additionalProperties: false },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_favorite_groups arguments");
      const common = readCommonListArgs(args, [], "canvas_list_favorite_groups");
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      addIncludeQuery(query, common.include);
      appendMultiValue(query, "per_page", common.perPage);
      const envelope = await performCanvasListRequest({ path: "/api/v1/users/self/favorites/groups", query, followPagination: common.followPagination, maxPages: common.maxPages });
      return { ...envelope, summary: summarizeGroups(envelope.data) };
    },
  },
];
