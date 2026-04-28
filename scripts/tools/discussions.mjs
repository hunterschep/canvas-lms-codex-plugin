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
  performCanvasListRequest,
  performCanvasRequest,
  summarizeDiscussionTopic,
  summarizeDiscussionTopics,
} from "../canvas-mcp-core.mjs";
import { CONTEXT_ID_PROPERTIES, courseOrGroupDiscussionBase } from "./path-builders.mjs";

const DISCUSSION_INCLUDES = ["all_dates", "sections", "sections_user_count", "overrides"];

export const DISCUSSION_TOOLS = [
  {
    name: "canvas_list_discussion_topics",
    title: "List Discussion Topics",
    description: "List discussion topics for a course or group.",
    inputSchema: {
      type: "object",
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        order_by: { type: "string", enum: ["position", "recent_activity", "title"] },
        scope: { type: "string", enum: ["locked", "unlocked", "pinned", "unpinned"] },
        only_announcements: { type: "boolean" },
        filter_by: { type: "string", enum: ["all", "unread"] },
        search_term: { type: "string", description: "Partial discussion title to match." },
        exclude_context_module_locked_topics: { type: "boolean" },
        include: { type: "array", items: { type: "string", enum: DISCUSSION_INCLUDES } },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_discussion_topics arguments");
      ensureAllowedKeys(args, ["course_id", "group_id", "order_by", "scope", "only_announcements", "filter_by", "search_term", "exclude_context_module_locked_topics", "include", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_discussion_topics");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      addIncludeQuery(query, optionalEnumArray(args.include, "include", DISCUSSION_INCLUDES));
      appendMultiValue(query, "order_by", optionalEnum(args.order_by, "order_by", ["position", "recent_activity", "title"]) ?? "position");
      appendMultiValue(query, "scope", optionalEnum(args.scope, "scope", ["locked", "unlocked", "pinned", "unpinned"]));
      appendMultiValue(query, "only_announcements", optionalBoolean(args.only_announcements, "only_announcements"));
      appendMultiValue(query, "filter_by", optionalEnum(args.filter_by, "filter_by", ["all", "unread"]));
      appendMultiValue(query, "search_term", optionalString(args.search_term, "search_term"));
      appendMultiValue(query, "exclude_context_module_locked_topics", optionalBoolean(args.exclude_context_module_locked_topics, "exclude_context_module_locked_topics"));
      appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
      const envelope = await performCanvasListRequest({
        path: courseOrGroupDiscussionBase(args, "canvas_list_discussion_topics"),
        query,
        followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
        maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
      });
      return { ...envelope, summary: summarizeDiscussionTopics(envelope.data) };
    },
  },
  {
    name: "canvas_get_discussion_topic",
    title: "Get Discussion Topic",
    description: "Read one discussion topic for a course or group.",
    inputSchema: {
      type: "object",
      required: ["topic_id"],
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        topic_id: { type: "string", description: "Canvas discussion topic ID." },
        include: { type: "array", items: { type: "string", enum: DISCUSSION_INCLUDES } },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_discussion_topic arguments");
      ensureAllowedKeys(args, ["course_id", "group_id", "topic_id", "include", "extra_query"], "canvas_get_discussion_topic");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      addIncludeQuery(query, optionalEnumArray(args.include, "include", DISCUSSION_INCLUDES));
      const result = await performCanvasRequest({
        method: "GET",
        path: `${courseOrGroupDiscussionBase(args, "canvas_get_discussion_topic")}/${encodeURIComponent(normalizeString(args.topic_id, "topic_id"))}`,
        query,
      });
      return { ...buildEnvelope(result), summary: summarizeDiscussionTopic(result.data) };
    },
  },
  {
    name: "canvas_get_discussion_topic_view",
    title: "Get Discussion Topic View",
    description: "Read the full cached discussion structure, including entries, authors, and message bodies.",
    inputSchema: {
      type: "object",
      required: ["topic_id"],
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        topic_id: { type: "string", description: "Canvas discussion topic ID." },
        include_new_entries: { type: "boolean", description: "Include newer flat entries not yet reflected in the cached threaded view." },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_discussion_topic_view arguments");
      ensureAllowedKeys(args, ["course_id", "group_id", "topic_id", "include_new_entries", "extra_query"], "canvas_get_discussion_topic_view");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "include_new_entries", optionalBoolean(args.include_new_entries, "include_new_entries"));
      const result = await performCanvasRequest({
        method: "GET",
        path: `${courseOrGroupDiscussionBase(args, "canvas_get_discussion_topic_view")}/${encodeURIComponent(normalizeString(args.topic_id, "topic_id"))}/view`,
        query,
      });
      return {
        ...buildEnvelope(result),
        summary: {
          participantCount: Array.isArray(result.data?.participants) ? result.data.participants.length : null,
          unreadEntryCount: Array.isArray(result.data?.unread_entries) ? result.data.unread_entries.length : null,
          forcedEntryCount: Array.isArray(result.data?.forced_entries) ? result.data.forced_entries.length : null,
          rootEntryCount: Array.isArray(result.data?.view) ? result.data.view.length : null,
          newEntryCount: Array.isArray(result.data?.new_entries) ? result.data.new_entries.length : null,
        },
      };
    },
  },
  {
    name: "canvas_list_discussion_entries",
    title: "List Discussion Entries",
    description: "List top-level entries in a discussion topic.",
    inputSchema: {
      type: "object",
      required: ["topic_id"],
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        topic_id: { type: "string", description: "Canvas discussion topic ID." },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_discussion_entries arguments");
      ensureAllowedKeys(args, ["course_id", "group_id", "topic_id", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_discussion_entries");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
      return performCanvasListRequest({
        path: `${courseOrGroupDiscussionBase(args, "canvas_list_discussion_entries")}/${encodeURIComponent(normalizeString(args.topic_id, "topic_id"))}/entries`,
        query,
        followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
        maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
      });
    },
  },
  {
    name: "canvas_list_discussion_entry_replies",
    title: "List Discussion Entry Replies",
    description: "List replies to one discussion entry.",
    inputSchema: {
      type: "object",
      required: ["topic_id", "entry_id"],
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        topic_id: { type: "string", description: "Canvas discussion topic ID." },
        entry_id: { type: "string", description: "Canvas discussion entry ID." },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_discussion_entry_replies arguments");
      ensureAllowedKeys(args, ["course_id", "group_id", "topic_id", "entry_id", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_discussion_entry_replies");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
      return performCanvasListRequest({
        path: `${courseOrGroupDiscussionBase(args, "canvas_list_discussion_entry_replies")}/${encodeURIComponent(normalizeString(args.topic_id, "topic_id"))}/entries/${encodeURIComponent(normalizeString(args.entry_id, "entry_id"))}/replies`,
        query,
        followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
        maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
      });
    },
  },
];
