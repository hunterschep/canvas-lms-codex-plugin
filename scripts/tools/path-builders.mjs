import { JsonRpcError, normalizeString } from "../canvas-mcp-core.mjs";

const CONTEXTS = {
  account_id: "accounts",
  course_id: "courses",
  group_id: "groups",
  section_id: "sections",
  user_id: "users",
};

export const CONTEXT_ID_PROPERTIES = {
  account_id: {
    type: "string",
    description: "Canvas account ID or SIS identifier. Provide exactly one context ID when other context IDs are also accepted.",
  },
  course_id: {
    type: "string",
    description: "Canvas course ID. Provide exactly one context ID when group_id or user_id is also accepted.",
  },
  group_id: {
    type: "string",
    description: "Canvas group ID. Provide exactly one context ID when course_id or user_id is also accepted.",
  },
  section_id: {
    type: "string",
    description: "Canvas section ID. Provide exactly one context ID when other context IDs are also accepted.",
  },
  user_id: {
    type: "string",
    description: "Canvas user ID, SIS identifier, or self. Provide exactly one context ID when course_id or group_id is also accepted.",
  },
};

export function readContext(args, toolName, allowedKeys = ["course_id", "group_id", "user_id"]) {
  const matches = allowedKeys.filter((key) => args[key] !== undefined);
  if (matches.length !== 1) {
    throw new JsonRpcError(-32602, `${toolName} requires exactly one of: ${allowedKeys.join(", ")}`);
  }
  const key = matches[0];
  const id = normalizeString(args[key], key);
  return {
    key,
    id,
    collection: CONTEXTS[key],
    basePath: `/api/v1/${CONTEXTS[key]}/${encodeURIComponent(id)}`,
  };
}

export function courseOrGroupDiscussionBase(args, toolName) {
  return `${readContext(args, toolName, ["course_id", "group_id"]).basePath}/discussion_topics`;
}
