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
  optionalStringArray,
  performCanvasListRequest,
  performCanvasRequest,
  summarizeAppointmentGroups,
  summarizeGroups,
  summarizeSimpleNamedItems,
  summarizeUsers,
} from "../canvas-mcp-core.mjs";
import { CONTEXT_ID_PROPERTIES, readContext } from "./path-builders.mjs";

const APPOINTMENT_INCLUDES = ["appointments", "child_events", "participant_count", "reserved_times", "all_context_codes"];
const COLLABORATION_MEMBER_INCLUDES = ["collaborator_lti_id", "avatar_image_url"];
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

async function listSimple({ args, toolName, path, query = {}, summary }) {
  const paging = appendPaging(query, args);
  const envelope = await performCanvasListRequest({ path, query, ...paging });
  return summary ? { ...envelope, summary: summary(envelope.data) } : envelope;
}

export const COLLABORATION_SCHEDULING_TOOLS = [
  {
    name: "canvas_list_collaborations",
    title: "List Collaborations",
    description: "List ExternalToolCollaboration records for a Canvas course or group.",
    inputSchema: {
      type: "object",
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        ...COMMON_LIST_PROPERTIES,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_collaborations arguments");
      ensureAllowedKeys(args, ["course_id", "group_id", "include", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_collaborations");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      addIncludeQuery(query, optionalStringArray(args.include, "include"));
      return listSimple({
        args,
        toolName: "canvas_list_collaborations",
        path: listPathWithContext(args, "canvas_list_collaborations", ["course_id", "group_id"], "collaborations"),
        query,
        summary: (items) => summarizeSimpleNamedItems(items, ["id", "collaboration_id"]),
      });
    },
  },
  {
    name: "canvas_list_collaboration_members",
    title: "List Collaboration Members",
    description: "List the members of a Canvas collaboration.",
    inputSchema: {
      type: "object",
      required: ["collaboration_id"],
      properties: {
        collaboration_id: { type: "string", description: "Canvas collaboration ID." },
        include: { type: "array", items: { type: "string", enum: COLLABORATION_MEMBER_INCLUDES } },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_collaboration_members arguments");
      ensureAllowedKeys(args, ["collaboration_id", "include", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_collaboration_members");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      addIncludeQuery(query, optionalEnumArray(args.include, "include", COLLABORATION_MEMBER_INCLUDES));
      return listSimple({
        args,
        toolName: "canvas_list_collaboration_members",
        path: `/api/v1/collaborations/${encodeURIComponent(normalizeString(args.collaboration_id, "collaboration_id"))}/members`,
        query,
        summary: summarizeUsers,
      });
    },
  },
  {
    name: "canvas_list_potential_collaborators",
    title: "List Potential Collaborators",
    description: "List users who can be added to a collaboration in a Canvas course or group.",
    inputSchema: {
      type: "object",
      properties: { course_id: CONTEXT_ID_PROPERTIES.course_id, group_id: CONTEXT_ID_PROPERTIES.group_id, ...COMMON_LIST_PROPERTIES },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_potential_collaborators arguments");
      ensureAllowedKeys(args, ["course_id", "group_id", "include", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_potential_collaborators");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      addIncludeQuery(query, optionalStringArray(args.include, "include"));
      return listSimple({
        args,
        toolName: "canvas_list_potential_collaborators",
        path: listPathWithContext(args, "canvas_list_potential_collaborators", ["course_id", "group_id"], "potential_collaborators"),
        query,
        summary: summarizeUsers,
      });
    },
  },
  {
    name: "canvas_list_conferences",
    title: "List Conferences",
    description: "List conferences for a Canvas course or group.",
    inputSchema: {
      type: "object",
      properties: {
        course_id: CONTEXT_ID_PROPERTIES.course_id,
        group_id: CONTEXT_ID_PROPERTIES.group_id,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_conferences arguments");
      ensureAllowedKeys(args, ["course_id", "group_id", "extra_query"], "canvas_list_conferences");
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: listPathWithContext(args, "canvas_list_conferences", ["course_id", "group_id"], "conferences"),
        query: optionalFlatParamObject(args.extra_query, "extra_query"),
      }));
    },
  },
  {
    name: "canvas_list_appointment_groups",
    title: "List Appointment Groups",
    description: "List appointment groups that the current user can reserve or manage.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["reservable", "manageable"] },
        context_codes: { type: "array", items: { type: "string" } },
        include_past_appointments: { type: "boolean" },
        include: { type: "array", items: { type: "string", enum: APPOINTMENT_INCLUDES } },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_appointment_groups arguments");
      ensureAllowedKeys(args, ["scope", "context_codes", "include_past_appointments", "include", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_appointment_groups");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "scope", optionalEnum(args.scope, "scope", ["reservable", "manageable"]));
      appendMultiValue(query, "context_codes[]", optionalStringArray(args.context_codes, "context_codes"));
      appendMultiValue(query, "include_past_appointments", optionalBoolean(args.include_past_appointments, "include_past_appointments"));
      addIncludeQuery(query, optionalEnumArray(args.include, "include", APPOINTMENT_INCLUDES));
      return listSimple({ args, toolName: "canvas_list_appointment_groups", path: "/api/v1/appointment_groups", query, summary: summarizeAppointmentGroups });
    },
  },
  {
    name: "canvas_get_appointment_group",
    title: "Get Appointment Group",
    description: "Read one Canvas appointment group.",
    inputSchema: {
      type: "object",
      required: ["appointment_group_id"],
      properties: {
        appointment_group_id: { type: "string", description: "Canvas appointment group ID." },
        include: { type: "array", items: { type: "string", enum: APPOINTMENT_INCLUDES } },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_appointment_group arguments");
      ensureAllowedKeys(args, ["appointment_group_id", "include", "extra_query"], "canvas_get_appointment_group");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      addIncludeQuery(query, optionalEnumArray(args.include, "include", APPOINTMENT_INCLUDES));
      return buildEnvelope(await performCanvasRequest({
        method: "GET",
        path: `/api/v1/appointment_groups/${encodeURIComponent(normalizeString(args.appointment_group_id, "appointment_group_id"))}`,
        query,
      }));
    },
  },
  {
    name: "canvas_list_appointment_group_users",
    title: "List Appointment Group Users",
    description: "List user participants for an appointment group.",
    inputSchema: {
      type: "object",
      required: ["appointment_group_id"],
      properties: {
        appointment_group_id: { type: "string" },
        registration_status: { type: "string", enum: ["all", "registered"] },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_appointment_group_users arguments");
      ensureAllowedKeys(args, ["appointment_group_id", "registration_status", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_appointment_group_users");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "registration_status", optionalEnum(args.registration_status, "registration_status", ["all", "registered"]));
      return listSimple({ args, toolName: "canvas_list_appointment_group_users", path: `/api/v1/appointment_groups/${encodeURIComponent(normalizeString(args.appointment_group_id, "appointment_group_id"))}/users`, query, summary: summarizeUsers });
    },
  },
  {
    name: "canvas_list_appointment_group_groups",
    title: "List Appointment Group Groups",
    description: "List student group participants for an appointment group.",
    inputSchema: {
      type: "object",
      required: ["appointment_group_id"],
      properties: {
        appointment_group_id: { type: "string" },
        registration_status: { type: "string", enum: ["all", "registered"] },
        per_page: COMMON_LIST_PROPERTIES.per_page,
        follow_pagination: COMMON_LIST_PROPERTIES.follow_pagination,
        max_pages: COMMON_LIST_PROPERTIES.max_pages,
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_list_appointment_group_groups arguments");
      ensureAllowedKeys(args, ["appointment_group_id", "registration_status", "per_page", "follow_pagination", "max_pages", "extra_query"], "canvas_list_appointment_group_groups");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "registration_status", optionalEnum(args.registration_status, "registration_status", ["all", "registered"]));
      return listSimple({ args, toolName: "canvas_list_appointment_group_groups", path: `/api/v1/appointment_groups/${encodeURIComponent(normalizeString(args.appointment_group_id, "appointment_group_id"))}/groups`, query, summary: summarizeGroups });
    },
  },
  {
    name: "canvas_get_next_appointment",
    title: "Get Next Appointment",
    description: "Read the next reservable appointment across one or more appointment groups.",
    inputSchema: {
      type: "object",
      properties: {
        appointment_group_ids: { type: "array", items: { type: "string" } },
        extra_query: COMMON_GET_PROPERTIES.extra_query,
      },
      additionalProperties: false,
    },
    async handler(rawArgs) {
      const args = ensureObject(rawArgs ?? {}, "canvas_get_next_appointment arguments");
      ensureAllowedKeys(args, ["appointment_group_ids", "extra_query"], "canvas_get_next_appointment");
      const query = {};
      mergeFlatParams(query, optionalFlatParamObject(args.extra_query, "extra_query"));
      appendMultiValue(query, "appointment_group_ids[]", optionalStringArray(args.appointment_group_ids, "appointment_group_ids"));
      return buildEnvelope(await performCanvasRequest({ method: "GET", path: "/api/v1/appointment_groups/next_appointment", query }));
    },
  },
];
