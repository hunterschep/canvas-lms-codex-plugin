export const COMMON_GET_PROPERTIES = {
  include: {
    type: "array",
    items: { type: "string" },
    description: "Canvas include values. These become repeated include[] query parameters.",
  },
  extra_query: {
    type: "object",
    description: "Additional Canvas query parameters using exact API keys such as include[] or search_term.",
    additionalProperties: true,
  },
};

export const COMMON_LIST_PROPERTIES = {
  include: COMMON_GET_PROPERTIES.include,
  per_page: {
    type: "integer",
    minimum: 1,
    maximum: 100,
    description: "Canvas per_page value. Defaults to 25.",
  },
  follow_pagination: {
    type: "boolean",
    description: "Fetch additional pages from Link headers until max_pages is reached.",
  },
  max_pages: {
    type: "integer",
    minimum: 1,
    maximum: 20,
    description: "Maximum number of pages to fetch when follow_pagination is true.",
  },
  extra_query: COMMON_GET_PROPERTIES.extra_query,
};
