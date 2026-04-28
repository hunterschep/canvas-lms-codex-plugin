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
  performCanvasListRequest,
  performCanvasRequest,
  readCommonGetArgs,
  readCommonListArgs,
  summarizeGroup,
  summarizeGroups,
  summarizeSection,
  summarizeSections,
  summarizeUsers,
} from "../canvas-mcp-core.mjs";
import { CONTEXT_ID_PROPERTIES, readContext } from "./path-builders.mjs";

export const GROUP_SECTION_TOOLS = [
  {
    name: "canvas_list_current_user_groups",
    title: "List Current User Groups",
    description: "List active groups for the current Canvas user.",
    inputSchema: {
      type: "object",
      properties: {
        context_type: { type: "string", enum: ["Account", "Course"], description: "Optional context type filter." },
        ...COMMON_LIST_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_current_user_groups arguments");
      const common = readCommonListArgs(args, ["context_type"], "canvas_list_current_user_groups");
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      addIncludeQuery(query, common.include);
      appendMultiValue(query, "context_type", optionalEnum(args.context_type, "context_type", ["Account", "Course"]));
      appendMultiValue(query, "per_page", common.perPage);
      const envelope = await performCanvasListRequest({
        path: "/api/v1/users/self/groups",
        query,
        followPagination: common.followPagination,
        maxPages: common.maxPages,
      });
      return { ...envelope, summary: summarizeGroups(envelope.data) };
    },
  },
  {
    name: "canvas_list_course_groups",
    title: "List Course Groups",
    description: "List groups in a course.",
    inputSchema: {
      type: "object",
      required: ["course_id"],
      properties: {
        course_id: { type: "string", description: "Canvas course ID or SIS identifier." },
        ...COMMON_LIST_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_course_groups arguments");
      const common = readCommonListArgs(args, ["course_id"], "canvas_list_course_groups");
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      addIncludeQuery(query, common.include);
      appendMultiValue(query, "per_page", common.perPage);
      const envelope = await performCanvasListRequest({
        path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/groups`,
        query,
        followPagination: common.followPagination,
        maxPages: common.maxPages,
      });
      return { ...envelope, summary: summarizeGroups(envelope.data) };
    },
  },
  {
    name: "canvas_get_group",
    title: "Get Group",
    description: "Read one Canvas group with optional permissions/users data.",
    inputSchema: {
      type: "object",
      required: ["group_id"],
      properties: {
        group_id: { type: "string", description: "Canvas group ID." },
        ...COMMON_GET_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_group arguments");
      const { include, extraQuery } = readCommonGetArgs(args, ["group_id"], "canvas_get_group");
      const query = {};
      mergeFlatParams(query, extraQuery);
      addIncludeQuery(query, mergeIncludes(["permissions"], include));
      const result = await performCanvasRequest({
        method: "GET",
        path: `/api/v1/groups/${encodeURIComponent(normalizeString(args.group_id, "group_id"))}`,
        query,
      });
      return { ...buildEnvelope(result), summary: summarizeGroup(result.data) };
    },
  },
  {
    name: "canvas_list_group_users",
    title: "List Group Users",
    description: "List users in a Canvas group.",
    inputSchema: {
      type: "object",
      required: ["group_id"],
      properties: {
        group_id: { type: "string", description: "Canvas group ID." },
        search_term: { type: "string", description: "Optional user search term." },
        include: COMMON_LIST_PROPERTIES.include,
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_group_users arguments");
      ensureAllowedKeys(args, ["group_id", "search_term", "include", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_group_users");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      addIncludeQuery(query, optionalEnumArray(args.include, "include", ["avatar_url"]));
      appendMultiValue(query, "search_term", optionalString(args.search_term, "search_term"));
      appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
      const envelope = await performCanvasListRequest({
        path: `/api/v1/groups/${encodeURIComponent(normalizeString(args.group_id, "group_id"))}/users`,
        query,
        followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
        maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
      });
      return { ...envelope, summary: summarizeUsers(envelope.data) };
    },
  },
  {
    name: "canvas_list_course_sections",
    title: "List Course Sections",
    description: "List sections in a Canvas course.",
    inputSchema: {
      type: "object",
      required: ["course_id"],
      properties: {
        course_id: { type: "string", description: "Canvas course ID or SIS identifier." },
        search_term: { type: "string", description: "Optional section search term." },
        ...COMMON_LIST_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_course_sections arguments");
      const common = readCommonListArgs(args, ["course_id", "search_term"], "canvas_list_course_sections");
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      addIncludeQuery(query, mergeIncludes(["total_students"], common.include));
      appendMultiValue(query, "search_term", optionalString(args.search_term, "search_term"));
      appendMultiValue(query, "per_page", common.perPage);
      const envelope = await performCanvasListRequest({
        path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/sections`,
        query,
        followPagination: common.followPagination,
        maxPages: common.maxPages,
      });
      return { ...envelope, summary: summarizeSections(envelope.data) };
    },
  },
  {
    name: "canvas_get_section",
    title: "Get Section",
    description: "Read one Canvas section.",
    inputSchema: {
      type: "object",
      required: ["section_id"],
      properties: {
        section_id: { type: "string", description: "Canvas section ID." },
        ...COMMON_GET_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_section arguments");
      const { include, extraQuery } = readCommonGetArgs(args, ["section_id"], "canvas_get_section");
      const query = {};
      mergeFlatParams(query, extraQuery);
      addIncludeQuery(query, mergeIncludes(["total_students"], include));
      const result = await performCanvasRequest({
        method: "GET",
        path: `/api/v1/sections/${encodeURIComponent(normalizeString(args.section_id, "section_id"))}`,
        query,
      });
      return { ...buildEnvelope(result), summary: summarizeSection(result.data) };
    },
  },
  {
    name: "canvas_list_section_users",
    title: "List Section Users",
    description: "List users enrolled in a section.",
    inputSchema: {
      type: "object",
      required: ["section_id"],
      properties: {
        section_id: { type: "string", description: "Canvas section ID." },
        ...COMMON_LIST_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_section_users arguments");
      const common = readCommonListArgs(args, ["section_id"], "canvas_list_section_users");
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      addIncludeQuery(query, mergeIncludes(["enrollments", "avatar_url"], common.include));
      appendMultiValue(query, "per_page", common.perPage);
      const envelope = await performCanvasListRequest({
        path: `/api/v1/sections/${encodeURIComponent(normalizeString(args.section_id, "section_id"))}/users`,
        query,
        followPagination: common.followPagination,
        maxPages: common.maxPages,
      });
      return { ...envelope, summary: summarizeUsers(envelope.data) };
    },
  },
  {
    name: "canvas_list_context_tabs",
    title: "List Context Tabs",
    description: "List navigation tabs for a course, group, or user context.",
    inputSchema: {
      type: "object",
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        user_id: CONTEXT_ID_PROPERTIES.user_id,
        include: COMMON_LIST_PROPERTIES.include,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_context_tabs arguments");
      ensureAllowedKeys(args, ["course_id", "group_id", "user_id", "include", "extra_query"], "canvas_list_context_tabs");
      const context = readContext(args, "canvas_list_context_tabs");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      addIncludeQuery(query, optionalEnumArray(args.include, "include", ["external"]));
      return performCanvasListRequest({
        path: `${context.basePath}/tabs`,
        query,
        followPagination: false,
        maxPages: 1,
      });
    },
  },
];
