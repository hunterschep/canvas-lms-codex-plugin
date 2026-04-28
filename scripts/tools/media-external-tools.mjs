import {
  COMMON_GET_PROPERTIES,
  COMMON_LIST_PROPERTIES,
  DEFAULT_MAX_PAGES,
  DEFAULT_PER_PAGE,
  JsonRpcError,
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
  summarizeExternalTools,
  summarizeSimpleNamedItems,
} from "../canvas-mcp-core.mjs";
import { CONTEXT_ID_PROPERTIES, readContext } from "./path-builders.mjs";

const MEDIA_SORTS = ["title", "created_at"];
const MEDIA_EXCLUDES = ["sources", "tracks"];
const MEDIA_TRACK_INCLUDES = ["content", "webvtt_content", "updated_at", "created_at"];

function appendPaging(query, args) {
  appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
  return {
    followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
    maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
  };
}

function optionalContext(args, toolName, allowedKeys) {
  const keys = allowedKeys.filter((key) => args[key] !== undefined);
  if (keys.length > 1) {
    throw new JsonRpcError(-32602, `${toolName} accepts at most one of: ${allowedKeys.join(", ")}`);
  }
  return keys.length === 0 ? null : readContext(args, toolName, keys);
}

function listPathWithContext(args, toolName, allowedKeys, suffix, defaultPath = null) {
  const context = optionalContext(args, toolName, allowedKeys);
  if (!context && !defaultPath) {
    throw new JsonRpcError(-32602, `${toolName} requires exactly one of: ${allowedKeys.join(", ")}`);
  }
  return context ? `${context.basePath}/${suffix}` : defaultPath;
}

async function listSimple({ args, path, query = {}, summary }) {
  const paging = appendPaging(query, args);
  const envelope = await performCanvasListRequest({ path, query, ...paging });
  return summary ? { ...envelope, summary: summary(envelope.data) } : envelope;
}

async function listMedia(rawArgs, toolName, collection) {
  const args = ensureObject(rawArgs ?? {}, `${toolName} arguments`);
  ensureAllowedKeys(args, ["course_id", "group_id", "sort", "order", "exclude", "per_page", "follow_pagination", "max_pages", "extra_query"], toolName);
  const query = {};
  mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
  appendMultiValue(query, "sort", optionalEnum(args.sort, "sort", MEDIA_SORTS));
  appendMultiValue(query, "order", optionalEnum(args.order, "order", ["asc", "desc"]));
  appendMultiValue(query, "exclude[]", optionalEnumArray(args.exclude, "exclude", MEDIA_EXCLUDES));
  return listSimple({
    args,
    path: listPathWithContext(args, toolName, ["course_id", "group_id"], collection, `/api/v1/${collection}`),
    query,
    summary: (items) => summarizeSimpleNamedItems(items, ["id", "media_id", "attachment_id"]),
  });
}

export const MEDIA_EXTERNAL_TOOLS = [
  {
    name: "canvas_list_context_media_objects",
    title: "List Context Media Objects",
    description: "List media objects globally or for a Canvas course or group.",
    inputSchema: {
      type: "object",
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        sort: { type: "string", enum: MEDIA_SORTS },
        order: { type: "string", enum: ["asc", "desc"] },
        exclude: { type: "array", items: { type: "string", enum: MEDIA_EXCLUDES } },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      return listMedia(rawArgs, "canvas_list_context_media_objects", "media_objects");
    },
  },
  {
    name: "canvas_list_context_media_attachments",
    title: "List Context Media Attachments",
    description: "List media attachments globally or for a Canvas course or group.",
    inputSchema: {
      type: "object",
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        sort: { type: "string", enum: MEDIA_SORTS },
        order: { type: "string", enum: ["asc", "desc"] },
        exclude: { type: "array", items: { type: "string", enum: MEDIA_EXCLUDES } },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      return listMedia(rawArgs, "canvas_list_context_media_attachments", "media_attachments");
    },
  },
  {
    name: "canvas_list_media_tracks",
    title: "List Media Tracks",
    description: "List caption/subtitle tracks for a media object or media attachment.",
    inputSchema: {
      type: "object",
      properties: {
        media_object_id: { type: "string", description: "Canvas media object ID. Provide this or attachment_id." },
        attachment_id: { type: "string", description: "Canvas media attachment ID. Provide this or media_object_id." },
        include: { type: "array", items: { type: "string", enum: MEDIA_TRACK_INCLUDES } },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_media_tracks arguments");
      ensureAllowedKeys(args, ["media_object_id", "attachment_id", "include", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_media_tracks");
      const ids = ["media_object_id", "attachment_id"].filter((key) => args[key] !== undefined);
      if (ids.length !== 1) {
        throw new JsonRpcError(-32602, "canvas_list_media_tracks requires exactly one of: media_object_id, attachment_id");
      }
      const base = ids[0] === "media_object_id" ? "media_objects" : "media_attachments";
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      addIncludeQuery(query, optionalEnumArray(args.include, "include", MEDIA_TRACK_INCLUDES));
      return listSimple({
        args,
        path: `/api/v1/${base}/${encodeURIComponent(normalizeString(args[ids[0]], ids[0]))}/media_tracks`,
        query,
      });
    },
  },
  {
    name: "canvas_list_external_tools",
    title: "List External Tools",
    description: "List LTI/external tools for a Canvas course, account, or group.",
    inputSchema: {
      type: "object",
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        account_id: CONTEXT_ID_PROPERTIES.account_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        search_term: { type: "string" },
        selectable: { type: "boolean" },
        include_parents: { type: "boolean" },
        placement: { type: "string" },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_external_tools arguments");
      ensureAllowedKeys(args, ["course_id", "account_id", "group_id", "search_term", "selectable", "include_parents", "placement", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_external_tools");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "search_term", optionalString(args.search_term, "search_term"));
      appendMultiValue(query, "selectable", optionalBoolean(args.selectable, "selectable"));
      appendMultiValue(query, "include_parents", optionalBoolean(args.include_parents, "include_parents"));
      appendMultiValue(query, "placement", optionalString(args.placement, "placement"));
      return listSimple({
        args,
        path: listPathWithContext(args, "canvas_list_external_tools", ["course_id", "account_id", "group_id"], "external_tools"),
        query,
        summary: summarizeExternalTools,
      });
    },
  },
  {
    name: "canvas_get_external_tool",
    title: "Get External Tool",
    description: "Read one external tool in a Canvas course or account.",
    inputSchema: {
      type: "object",
      required: ["external_tool_id"],
      properties: {
        external_tool_id: { type: "string", description: "Canvas external tool ID." },
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        account_id: CONTEXT_ID_PROPERTIES.account_id,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_external_tool arguments");
      ensureAllowedKeys(args, ["external_tool_id", "course_id", "account_id", "extra_query"], "canvas_get_external_tool");
      const basePath = readContext(args, "canvas_get_external_tool", ["course_id", "account_id"]).basePath;
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: `${basePath}/external_tools/${encodeURIComponent(normalizeString(args.external_tool_id, "external_tool_id"))}`,
        query: optionalFlatParamObject(args.extra_query, "extra_query"),
      }));
    },
  },
  {
    name: "canvas_get_external_tool_sessionless_launch",
    title: "Get External Tool Sessionless Launch",
    description: "Resolve a sessionless launch URL for a course or account external tool.",
    inputSchema: {
      type: "object",
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        account_id: CONTEXT_ID_PROPERTIES.account_id,
        id: { type: "string", description: "External tool ID." },
        url: { type: "string", description: "LTI launch URL." },
        assignment_id: { type: "string" },
        module_item_id: { type: "string" },
        launch_type: { type: "string" },
        resource_link_lookup_uuid: { type: "string" },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_external_tool_sessionless_launch arguments");
      ensureAllowedKeys(args, ["course_id", "account_id", "id", "url", "assignment_id", "module_item_id", "launch_type", "resource_link_lookup_uuid", "extra_query"], "canvas_get_external_tool_sessionless_launch");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "id", optionalString(args.id, "id"));
      appendMultiValue(query, "url", optionalString(args.url, "url"));
      appendMultiValue(query, "assignment_id", optionalString(args.assignment_id, "assignment_id"));
      appendMultiValue(query, "module_item_id", optionalString(args.module_item_id, "module_item_id"));
      appendMultiValue(query, "launch_type", optionalString(args.launch_type, "launch_type"));
      appendMultiValue(query, "resource_link_lookup_uuid", optionalString(args.resource_link_lookup_uuid, "resource_link_lookup_uuid"));
      const basePath = readContext(args, "canvas_get_external_tool_sessionless_launch", ["course_id", "account_id"]).basePath;
      return buildEnvelope(await performCanvasRequest({ method: "GET", path: `${basePath}/external_tools/sessionless_launch`, query }));
    },
  },
  {
    name: "canvas_list_visible_course_nav_tools",
    title: "List Visible Course Navigation Tools",
    description: "List visible course navigation external tools for a course.",
    inputSchema: {
      type: "object",
      required: ["course_id"],
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_visible_course_nav_tools arguments");
      ensureAllowedKeys(args, ["course_id", "extra_query"], "canvas_list_visible_course_nav_tools");
      const result = await performCanvasRequest({
        method: "GET",
        path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/external_tools/visible_course_nav_tools`,
        query: optionalFlatParamObject(args.extra_query, "extra_query"),
      });
      return { ...buildEnvelope(result), summary: Array.isArray(result.data) ? summarizeExternalTools(result.data) : undefined };
    },
  },
];
