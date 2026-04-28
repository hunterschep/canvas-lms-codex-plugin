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
  optionalStringArray,
  performCanvasListRequest,
  performCanvasRequest,
  readCommonListArgs,
  summarizeFile,
  summarizeFiles,
  summarizeFolder,
  summarizeFolders,
} from "../canvas-mcp-core.mjs";
import { CONTEXT_ID_PROPERTIES, readContext } from "./path-builders.mjs";

function optionalContextBase(args, toolName) {
  const keys = ["course_id", "group_id", "user_id"].filter((key) => args[key] !== undefined);
  if (keys.length > 1) {
    throw new JsonRpcError(-32602, `${toolName} accepts at most one of: course_id, group_id, user_id`);
  }
  return keys.length === 0 ? null : readContext(args, toolName, keys).basePath;
}

export const FILE_FOLDER_TOOLS = [
  {
    name: "canvas_get_files_quota",
    title: "Get Files Quota",
    description: "Read storage quota information for a course, group, or user files context.",
    inputSchema: {
      type: "object",
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        user_id: CONTEXT_ID_PROPERTIES.user_id,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_files_quota arguments");
      ensureAllowedKeys(args, ["course_id", "group_id", "user_id", "extra_query"], "canvas_get_files_quota");
      const context = readContext(args, "canvas_get_files_quota");
      const result = await performCanvasRequest({
        method: "GET",
        path: `${context.basePath}/files/quota`,
        query: optionalFlatParamObject(args.extra_query, "extra_query"),
      });
      return buildEnvelope(result);
    },
  },
  {
    name: "canvas_list_context_files",
    title: "List Context Files",
    description: "List files for a course, group, or user context.",
    inputSchema: {
      type: "object",
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        user_id: CONTEXT_ID_PROPERTIES.user_id,
        search_term: { type: "string", description: "Partial file name to match." },
        content_types: { type: "array", items: { type: "string" }, description: "Optional content_types[] filter." },
        exclude_content_types: { type: "array", items: { type: "string" }, description: "Optional exclude_content_types[] filter." },
        sort: { type: "string", enum: ["name", "size", "created_at", "updated_at", "content_type", "user"] },
        order: { type: "string", enum: ["asc", "desc"] },
        include: COMMON_LIST_PROPERTIES.include,
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_context_files arguments");
      ensureAllowedKeys(args, ["course_id", "group_id", "user_id", "search_term", "content_types", "exclude_content_types", "sort", "order", "include", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_context_files");
      const context = readContext(args, "canvas_list_context_files");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      addIncludeQuery(query, optionalEnumArray(args.include, "include", ["user", "usage_rights"]));
      appendMultiValue(query, "search_term", optionalString(args.search_term, "search_term"));
      appendMultiValue(query, "content_types[]", optionalStringArray(args.content_types, "content_types"));
      appendMultiValue(query, "exclude_content_types[]", optionalStringArray(args.exclude_content_types, "exclude_content_types"));
      appendMultiValue(query, "sort", optionalEnum(args.sort, "sort", ["name", "size", "created_at", "updated_at", "content_type", "user"]));
      appendMultiValue(query, "order", optionalEnum(args.order, "order", ["asc", "desc"]));
      appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
      const envelope = await performCanvasListRequest({
        path: `${context.basePath}/files`,
        query,
        followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
        maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
      });
      return { ...envelope, summary: summarizeFiles(envelope.data) };
    },
  },
  {
    name: "canvas_list_folder_files",
    title: "List Folder Files",
    description: "List files inside a Canvas folder.",
    inputSchema: {
      type: "object",
      required: ["folder_id"],
      properties: {
        folder_id: { type: "string", description: "Canvas folder ID." },
        search_term: { type: "string", description: "Partial file name to match." },
        ...COMMON_LIST_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_folder_files arguments");
      const common = readCommonListArgs(args, ["folder_id", "search_term"], "canvas_list_folder_files");
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      addIncludeQuery(query, common.include);
      appendMultiValue(query, "search_term", optionalString(args.search_term, "search_term"));
      appendMultiValue(query, "per_page", common.perPage);
      const envelope = await performCanvasListRequest({
        path: `/api/v1/folders/${encodeURIComponent(normalizeString(args.folder_id, "folder_id"))}/files`,
        query,
        followPagination: common.followPagination,
        maxPages: common.maxPages,
      });
      return { ...envelope, summary: summarizeFiles(envelope.data) };
    },
  },
  {
    name: "canvas_get_file",
    title: "Get File",
    description: "Read file metadata globally or through a course, group, or user context.",
    inputSchema: {
      type: "object",
      required: ["file_id"],
      properties: {
        file_id: { type: "string", description: "Canvas file ID." },
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        user_id: CONTEXT_ID_PROPERTIES.user_id,
        ...COMMON_GET_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_file arguments");
      ensureAllowedKeys(args, ["file_id", "course_id", "group_id", "user_id", "include", "extra_query"], "canvas_get_file");
      const basePath = optionalContextBase(args, "canvas_get_file") ?? "/api/v1";
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      addIncludeQuery(query, optionalEnumArray(args.include, "include", ["user", "usage_rights"]));
      const result = await performCanvasRequest({
        method: "GET",
        path: `${basePath}/files/${encodeURIComponent(normalizeString(args.file_id, "file_id"))}`,
        query,
      });
      return { ...buildEnvelope(result), summary: summarizeFile(result.data) };
    },
  },
  {
    name: "canvas_get_file_public_url",
    title: "Get File Public URL",
    description: "Read the public inline preview URL for a Canvas file when the caller can access it.",
    inputSchema: {
      type: "object",
      required: ["file_id"],
      properties: {
        file_id: { type: "string", description: "Canvas file ID." },
        submission_id: { type: "string", description: "Optional submission ID for submitted files." },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_file_public_url arguments");
      ensureAllowedKeys(args, ["file_id", "submission_id", "extra_query"], "canvas_get_file_public_url");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "submission_id", optionalString(args.submission_id, "submission_id"));
      const result = await performCanvasRequest({
        method: "GET",
        path: `/api/v1/files/${encodeURIComponent(normalizeString(args.file_id, "file_id"))}/public_url`,
        query,
      });
      return buildEnvelope(result);
    },
  },
  {
    name: "canvas_list_context_folders",
    title: "List Context Folders",
    description: "List folders for a course, group, or user context.",
    inputSchema: {
      type: "object",
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        user_id: CONTEXT_ID_PROPERTIES.user_id,
        ...COMMON_LIST_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_context_folders arguments");
      const common = readCommonListArgs(args, ["course_id", "group_id", "user_id"], "canvas_list_context_folders");
      const context = readContext(args, "canvas_list_context_folders");
      const query = {};
      mergeFlatParams(query, common.extraQuery);
      addIncludeQuery(query, common.include);
      appendMultiValue(query, "per_page", common.perPage);
      const envelope = await performCanvasListRequest({
        path: `${context.basePath}/folders`,
        query,
        followPagination: common.followPagination,
        maxPages: common.maxPages,
      });
      return { ...envelope, summary: summarizeFolders(envelope.data) };
    },
  },
  {
    name: "canvas_get_folder",
    title: "Get Folder",
    description: "Read Canvas folder metadata globally or through a course, group, or user context.",
    inputSchema: {
      type: "object",
      required: ["folder_id"],
      properties: {
        folder_id: { type: "string", description: "Canvas folder ID." },
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        user_id: CONTEXT_ID_PROPERTIES.user_id,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_folder arguments");
      ensureAllowedKeys(args, ["folder_id", "course_id", "group_id", "user_id", "extra_query"], "canvas_get_folder");
      const basePath = optionalContextBase(args, "canvas_get_folder") ?? "/api/v1";
      const result = await performCanvasRequest({
        method: "GET",
        path: `${basePath}/folders/${encodeURIComponent(normalizeString(args.folder_id, "folder_id"))}`,
        query: optionalFlatParamObject(args.extra_query, "extra_query"),
      });
      return { ...buildEnvelope(result), summary: summarizeFolder(result.data) };
    },
  },
];
