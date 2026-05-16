/**
 * Confluence Spaces API
 *
 * List and retrieve Confluence spaces.
 */

/**
 * List all spaces
 *
 * @example
 * const spaces = await confluence.spaces.list();
 * for (const space of spaces.results) {
 *   console.log(`${space.key}: ${space.name}`);
 * }
 *
 * @example
 * // List only global spaces (not personal)
 * const spaces = await confluence.spaces.list({ type: 'global' });
 */
declare function list(
  options?: {
    type?: 'global' | 'personal';
    limit?: number;
    start?: number;
    expand?: string;
  }
): Promise<{
  results: Array<{
    id: number;
    key: string;
    name: string;
    type: 'global' | 'personal';
    status: string;
    _links: { webui: string };
  }>;
  start: number;
  limit: number;
  size: number;
}>;

/**
 * Get a specific space by key
 *
 * Default expand: description.plain,homepage
 *
 * @example
 * const space = await confluence.spaces.get('DEV');
 * console.log(space.name);
 * console.log(space.description?.plain?.value);
 */
declare function get(
  key: string,
  options?: { expand?: string }
): Promise<{
  id: number;
  key: string;
  name: string;
  type: string;
  status: string;
  description?: {
    plain?: { value: string };
    view?: { value: string };
  };
  homepage?: {
    id: string;
    title: string;
    _links: { webui: string };
  };
  _links: { webui: string };
}>;

export const spaces: {
  list: typeof list;
  get: typeof get;
};
