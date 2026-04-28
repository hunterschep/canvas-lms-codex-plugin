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
  optionalFlatParamObject,
  optionalInteger,
  optionalString,
  optionalStringArray,
  performCanvasListRequest,
  performCanvasRequest,
  summarizeSimpleNamedItems,
} from "../canvas-mcp-core.mjs";
import { CONTEXT_ID_PROPERTIES, readContext } from "./path-builders.mjs";

const STUDENT_SUMMARY_SORTS = [
  "name",
  "name_descending",
  "score",
  "score_descending",
  "participations",
  "participations_descending",
  "page_views",
  "page_views_descending",
];
const DATE_DETAIL_OBJECTS = {
  module: "modules",
  assignment: "assignments",
  quiz: "quizzes",
  discussion_topic: "discussion_topics",
  page: "pages",
  file: "files",
};

function appendPaging(query, args) {
  appendMultiValue(query, "per_page", optionalInteger(args.per_page, "per_page", 1, MAX_PER_PAGE) ?? DEFAULT_PER_PAGE);
  return {
    followPagination: optionalBoolean(args.follow_pagination, "follow_pagination") ?? false,
    maxPages: optionalInteger(args.max_pages, "max_pages", 1, MAX_PAGES) ?? DEFAULT_MAX_PAGES,
  };
}

async function listSimple({ args, path, query = {}, summary }) {
  const paging = appendPaging(query, args);
  const envelope = await performCanvasListRequest({ path, query, ...paging });
  return summary ? { ...envelope, summary: summary(envelope.data) } : envelope;
}

function contextBase(args, toolName, allowedKeys) {
  return readContext(args, toolName, allowedKeys).basePath;
}

function migrationBase(args, toolName) {
  return `${contextBase(args, toolName, ["account_id", "course_id", "group_id", "user_id"])}/content_migrations`;
}

function exportBase(args, toolName) {
  return `${contextBase(args, toolName, ["course_id", "group_id", "user_id"])}/content_exports`;
}

export const ANALYTICS_OPERATION_TOOLS = [
  {
    name: "canvas_get_progress",
    title: "Get Progress",
    description: "Read Canvas async job progress by progress ID.",
    inputSchema: {
      type: "object",
      required: ["progress_id"],
      properties: {
        progress_id: { type: "string", description: "Canvas progress ID." },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_progress arguments");
      ensureAllowedKeys(args, ["progress_id", "extra_query"], "canvas_get_progress");
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: `/api/v1/progress/${encodeURIComponent(normalizeString(args.progress_id, "progress_id"))}`,
        query: optionalFlatParamObject(args.extra_query, "extra_query"),
      }));
    },
  },
  {
    name: "canvas_get_course_analytics_activity",
    title: "Get Course Analytics Activity",
    description: "Read course analytics activity totals grouped by day.",
    inputSchema: courseOnlySchema(),
    async handler(rawArgs) {
      return getCourseAnalytics(rawArgs, "canvas_get_course_analytics_activity", "activity");
    },
  },
  {
    name: "canvas_get_course_analytics_assignments",
    title: "Get Course Analytics Assignments",
    description: "Read course-level assignment analytics and optionally request async processing.",
    inputSchema: {
      type: "object",
      required: ["course_id"],
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        async: { type: "boolean", description: "Ask Canvas to process the analytics request asynchronously." },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_course_analytics_assignments arguments");
      ensureAllowedKeys(args, ["course_id", "async", "extra_query"], "canvas_get_course_analytics_assignments");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "async", optionalBoolean(args.async, "async"));
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/analytics/assignments`,
        query,
      }));
    },
  },
  {
    name: "canvas_list_course_analytics_student_summaries",
    title: "List Course Analytics Student Summaries",
    description: "List per-student course analytics summaries.",
    inputSchema: {
      type: "object",
      required: ["course_id"],
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        sort_column: { type: "string", enum: STUDENT_SUMMARY_SORTS },
        student_id: { type: "string" },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_course_analytics_student_summaries arguments");
      ensureAllowedKeys(args, ["course_id", "sort_column", "student_id", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_course_analytics_student_summaries");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "sort_column", optionalEnum(args.sort_column, "sort_column", STUDENT_SUMMARY_SORTS));
      appendMultiValue(query, "student_id", optionalString(args.student_id, "student_id"));
      return listSimple({
        args,
        path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/analytics/student_summaries`,
        query,
        summary: (items) => summarizeSimpleNamedItems(items, ["id", "user_id"]),
      });
    },
  },
  {
    name: "canvas_get_course_analytics_student_activity",
    title: "Get Course Analytics Student Activity",
    description: "Read a student's course page view and participation analytics.",
    inputSchema: courseStudentSchema(),
    async handler(rawArgs) {
      return getStudentAnalytics(rawArgs, "canvas_get_course_analytics_student_activity", "activity");
    },
  },
  {
    name: "canvas_get_course_analytics_student_assignments",
    title: "Get Course Analytics Student Assignments",
    description: "Read a student's assignment analytics in a course.",
    inputSchema: courseStudentSchema(),
    async handler(rawArgs) {
      return getStudentAnalytics(rawArgs, "canvas_get_course_analytics_student_assignments", "assignments");
    },
  },
  {
    name: "canvas_get_course_analytics_student_communication",
    title: "Get Course Analytics Student Communication",
    description: "Read a student's messaging analytics in a course.",
    inputSchema: courseStudentSchema(),
    async handler(rawArgs) {
      return getStudentAnalytics(rawArgs, "canvas_get_course_analytics_student_communication", "communication");
    },
  },
  {
    name: "canvas_get_learning_object_date_details",
    title: "Get Learning Object Date Details",
    description: "Read due, availability, and override date details for a course module, assignment, quiz, discussion, page, or file.",
    inputSchema: {
      type: "object",
      required: ["course_id", "object_type", "object_id"],
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        object_type: { type: "string", enum: Object.keys(DATE_DETAIL_OBJECTS) },
        object_id: { type: "string", description: "Object identifier, page URL, or page ID." },
        include: COMMON_GET_PROPERTIES.include,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_learning_object_date_details arguments");
      ensureAllowedKeys(args, ["course_id", "object_type", "object_id", "include", "extra_query"], "canvas_get_learning_object_date_details");
      const type = optionalEnum(args.object_type, "object_type", Object.keys(DATE_DETAIL_OBJECTS));
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      addIncludeQuery(query, optionalStringArray(args.include, "include"));
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/${DATE_DETAIL_OBJECTS[type]}/${encodeURIComponent(normalizeString(args.object_id, "object_id"))}/date_details`,
        query,
      }));
    },
  },
  {
    name: "canvas_list_blackout_dates",
    title: "List Blackout Dates",
    description: "List blackout dates for a Canvas course or account.",
    inputSchema: contextListSchema(["course_id", "account_id"]),
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_blackout_dates arguments");
      ensureAllowedKeys(args, ["course_id", "account_id", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_blackout_dates");
      const query = optionalFlatParamObject(args.extra_query, "extra_query") ?? {};
      return listSimple({ args, path: `${contextBase(args, "canvas_list_blackout_dates", ["course_id", "account_id"])}/blackout_dates`, query });
    },
  },
  {
    name: "canvas_get_blackout_date",
    title: "Get Blackout Date",
    description: "Read one blackout date for a Canvas course or account.",
    inputSchema: contextGetSchema(["course_id", "account_id"], "blackout_date_id"),
    async handler(rawArgs) {
      return getContextItem(rawArgs, "canvas_get_blackout_date", ["course_id", "account_id"], "blackout_dates", "blackout_date_id");
    },
  },
  {
    name: "canvas_list_content_exports",
    title: "List Content Exports",
    description: "List Canvas content exports for a course, group, or user.",
    inputSchema: contextListSchema(["course_id", "group_id", "user_id"]),
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_content_exports arguments");
      ensureAllowedKeys(args, ["course_id", "group_id", "user_id", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_content_exports");
      const query = optionalFlatParamObject(args.extra_query, "extra_query") ?? {};
      return listSimple({ args, path: exportBase(args, "canvas_list_content_exports"), query, summary: (items) => summarizeSimpleNamedItems(items, ["id"]) });
    },
  },
  {
    name: "canvas_get_content_export",
    title: "Get Content Export",
    description: "Read one Canvas content export for a course, group, or user.",
    inputSchema: contextGetSchema(["course_id", "group_id", "user_id"], "content_export_id"),
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_content_export arguments");
      ensureAllowedKeys(args, ["course_id", "group_id", "user_id", "content_export_id", "extra_query"], "canvas_get_content_export");
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: `${exportBase(args, "canvas_get_content_export")}/${encodeURIComponent(normalizeString(args.content_export_id, "content_export_id"))}`,
        query: optionalFlatParamObject(args.extra_query, "extra_query"),
      }));
    },
  },
  {
    name: "canvas_list_content_migrations",
    title: "List Content Migrations",
    description: "List Canvas content migrations for an account, course, group, or user.",
    inputSchema: contextListSchema(["account_id", "course_id", "group_id", "user_id"]),
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_content_migrations arguments");
      ensureAllowedKeys(args, ["account_id", "course_id", "group_id", "user_id", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_content_migrations");
      const query = optionalFlatParamObject(args.extra_query, "extra_query") ?? {};
      return listSimple({ args, path: migrationBase(args, "canvas_list_content_migrations"), query, summary: (items) => summarizeSimpleNamedItems(items, ["id"]) });
    },
  },
  {
    name: "canvas_get_content_migration",
    title: "Get Content Migration",
    description: "Read one Canvas content migration.",
    inputSchema: contextGetSchema(["account_id", "course_id", "group_id", "user_id"], "content_migration_id"),
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_content_migration arguments");
      ensureAllowedKeys(args, ["account_id", "course_id", "group_id", "user_id", "content_migration_id", "extra_query"], "canvas_get_content_migration");
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: `${migrationBase(args, "canvas_get_content_migration")}/${encodeURIComponent(normalizeString(args.content_migration_id, "content_migration_id"))}`,
        query: optionalFlatParamObject(args.extra_query, "extra_query"),
      }));
    },
  },
  {
    name: "canvas_list_content_migration_issues",
    title: "List Content Migration Issues",
    description: "List migration issues for a Canvas content migration.",
    inputSchema: contextMigrationIssueSchema(false),
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_content_migration_issues arguments");
      ensureAllowedKeys(args, ["account_id", "course_id", "group_id", "user_id", "content_migration_id", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_content_migration_issues");
      const query = optionalFlatParamObject(args.extra_query, "extra_query") ?? {};
      return listSimple({ args, path: `${migrationBase(args, "canvas_list_content_migration_issues")}/${encodeURIComponent(normalizeString(args.content_migration_id, "content_migration_id"))}/migration_issues`, query });
    },
  },
  {
    name: "canvas_get_content_migration_issue",
    title: "Get Content Migration Issue",
    description: "Read one migration issue for a Canvas content migration.",
    inputSchema: contextMigrationIssueSchema(true),
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_content_migration_issue arguments");
      ensureAllowedKeys(args, ["account_id", "course_id", "group_id", "user_id", "content_migration_id", "migration_issue_id", "extra_query"], "canvas_get_content_migration_issue");
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: `${migrationBase(args, "canvas_get_content_migration_issue")}/${encodeURIComponent(normalizeString(args.content_migration_id, "content_migration_id"))}/migration_issues/${encodeURIComponent(normalizeString(args.migration_issue_id, "migration_issue_id"))}`,
        query: optionalFlatParamObject(args.extra_query, "extra_query"),
      }));
    },
  },
];

function courseOnlySchema() {
  return {
    type: "object",
    required: ["course_id"],
    properties: { course_id: CONTEXT_ID_PROPERTIES.course_id, extra_query: COMMON_GET_PROPERTIES.extra_query },
    additionalProperties: false,
  };
}

function courseStudentSchema() {
  return {
    type: "object",
    required: ["course_id", "student_id"],
    properties: {
      course_id: CONTEXT_ID_PROPERTIES.course_id,
      student_id: { type: "string", description: "Canvas student user ID." },
      extra_query: COMMON_GET_PROPERTIES.extra_query,
    },
    additionalProperties: false,
  };
}

async function getCourseAnalytics(rawArgs, toolName, endpoint) {
  const args = ensureObject(rawArgs ?? {}, `${toolName} arguments`);
  ensureAllowedKeys(args, ["course_id", "extra_query"], toolName);
  return buildEnvelope(await performCanvasRequest({
    method: "GET",
    path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/analytics/${endpoint}`,
    query: optionalFlatParamObject(args.extra_query, "extra_query"),
  }));
}

async function getStudentAnalytics(rawArgs, toolName, endpoint) {
  const args = ensureObject(rawArgs ?? {}, `${toolName} arguments`);
  ensureAllowedKeys(args, ["course_id", "student_id", "extra_query"], toolName);
  return buildEnvelope(await performCanvasRequest({
    method: "GET",
    path: `/api/v1/courses/${encodeURIComponent(normalizeString(args.course_id, "course_id"))}/analytics/users/${encodeURIComponent(normalizeString(args.student_id, "student_id"))}/${endpoint}`,
    query: optionalFlatParamObject(args.extra_query, "extra_query"),
  }));
}

function contextProperties(keys) {
  return Object.fromEntries(keys.map((key) => [key, CONTEXT_ID_PROPERTIES[key]]));
}

function contextListSchema(keys) {
  return {
    type: "object",
    properties: {
      ...contextProperties(keys),
      per_page: COMMON_LIST_PROPERTIES.per_page,
      follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
      max_pages: COMMON_LIST_PROPERTIES.max_pages,
      extra_query: COMMON_GET_PROPERTIES.extra_query,
    },
    additionalProperties: false,
  };
}

function contextGetSchema(keys, idName) {
  return {
    type: "object",
    required: [idName],
    properties: {
      ...contextProperties(keys),
      [idName]: { type: "string" },
      extra_query: COMMON_GET_PROPERTIES.extra_query,
    },
    additionalProperties: false,
  };
}

function contextMigrationIssueSchema(includeIssueId) {
  const schema = contextGetSchema(["account_id", "course_id", "group_id", "user_id"], "content_migration_id");
  if (includeIssueId) {
    schema.required.push("migration_issue_id");
    schema.properties.migration_issue_id = { type: "string" };
  } else {
    schema.properties.per_page = COMMON_LIST_PROPERTIES.per_page;
    schema.properties.follow_pagination = COMMON_LIST_PROPERTIES.follow_pagination;
    schema.properties.max_pages = COMMON_LIST_PROPERTIES.max_pages;
  }
  return schema;
}

async function getContextItem(rawArgs, toolName, keys, collection, idName) {
  const args = ensureObject(rawArgs ?? {}, `${toolName} arguments`);
  ensureAllowedKeys(args, [...keys, idName, "extra_query"], toolName);
  return buildEnvelope(await performCanvasRequest({
    method: "GET",
    path: `${contextBase(args, toolName, keys)}/${collection}/${encodeURIComponent(normalizeString(args[idName], idName))}`,
    query: optionalFlatParamObject(args.extra_query, "extra_query"),
  }));
}
