/**
 * Confluence Content API
 *
 * Search, read, and manage Confluence pages, blog posts, and other content.
 */

/**
 * Content search using CQL (Confluence Query Language)
 *
 * @example
 * const results = await confluence.content.search('text ~ "authentication"');
 *
 * @example
 * const results = await confluence.content.search(
 *   'text ~ "api" AND space = DEV',
 *   { expand: 'body.storage,version', limit: 10 }
 * );
 *
 * Common CQL operators:
 * - text ~ "keyword" - Full-text search
 * - title ~ "keyword" - Search titles only
 * - space = KEY - Filter by space
 * - type = page - Filter by content type (page, blogpost, comment)
 * - created >= "2024-01-01" - Date filters
 * - label = "api" - Filter by label
 * - parent = 12345678 - Child pages of a parent
 *
 * Combine with: AND, OR, NOT
 */
declare function search(
  cql: string,
  options?: {
    limit?: number;    // Max results (default: 25)
    start?: number;    // Pagination offset (default: 0)
    expand?: string;   // Properties to expand (e.g., 'body.storage,version')
  }
): Promise<{
  results: Array<{
    id: string;
    type: string;
    status: string;
    title: string;
    space?: { key: string; name: string };
    version?: {
      number: number;
      when: string;
      by: { displayName: string; email?: string };
    };
    body?: {
      storage?: { value: string };
      view?: { value: string };
    };
    _links: { webui: string; self: string };
  }>;
  start: number;
  limit: number;
  size: number;
}>;

/**
 * Get a specific page by ID
 *
 * Default expand: body.storage,version,space,ancestors
 *
 * @example
 * const page = await confluence.content.get('123456');
 * console.log(page.title);
 * console.log(page.body.storage.value); // HTML content
 */
declare function get(
  id: string,
  options?: { expand?: string }
): Promise<{
  id: string;
  type: string;
  title: string;
  space?: { key: string; name: string };
  ancestors?: Array<{ id: string; title: string }>;
  body?: {
    storage?: { value: string };
    view?: { value: string };
  };
  version?: {
    number: number;
    when: string;
    by: { displayName: string };
  };
  _links: { webui: string };
}>;

/**
 * List pages in a space
 *
 * @example
 * const pages = await confluence.content.getBySpace('DEV', { limit: 50 });
 */
declare function getBySpace(
  spaceKey: string,
  options?: {
    type?: 'page' | 'blogpost';
    limit?: number;
    start?: number;
    expand?: string;
  }
): Promise<{
  results: Array<{
    id: string;
    type: string;
    title: string;
    version?: { number: number };
    _links: { webui: string };
  }>;
  start: number;
  limit: number;
  size: number;
}>;

/**
 * Get direct child pages of a page
 *
 * @example
 * const children = await confluence.content.getChildren('123456');
 * for (const child of children.results) console.log(child.title);
 */
declare function getChildren(
  id: string,
  options?: { limit?: number; start?: number; expand?: string }
): Promise<{
  results: Array<{ id: string; title: string; version?: { number: number } }>;
  start: number;
  limit: number;
  size: number;
}>;

/**
 * Get all descendant pages (children, grandchildren, etc.)
 */
declare function getDescendants(
  id: string,
  options?: { limit?: number; start?: number; expand?: string }
): Promise<{
  results: Array<{ id: string; title: string; version?: { number: number } }>;
  start: number;
  limit: number;
  size: number;
}>;

/**
 * Get comments on a page
 *
 * @example
 * const comments = await confluence.content.getComments('123456');
 * for (const c of comments.results) {
 *   console.log(`${c.version.by.displayName}: ${c.body.storage.value}`);
 * }
 */
declare function getComments(
  id: string,
  options?: { limit?: number; start?: number; expand?: string }
): Promise<{
  results: Array<{
    id: string;
    title: string;
    body?: { storage?: { value: string } };
    version?: { by: { displayName: string }; when: string };
  }>;
  start: number;
  limit: number;
  size: number;
}>;

/**
 * Preview a page creation without writing
 *
 * @example
 * await confluence.content.preview({
 *   type: 'page', title: 'Test', space: { key: 'DEV' },
 *   body: { storage: { value: '<p>Hello</p>', representation: 'storage' } }
 * });
 */
declare function preview(data: ContentCreateInput): Promise<ContentCreateInput>;

/**
 * Create a new page
 *
 * @example
 * const page = await confluence.content.create({
 *   type: 'page',
 *   title: 'New Page',
 *   space: { key: 'DEV' },
 *   body: { storage: { value: '<p>Content</p>', representation: 'storage' } }
 * });
 */
declare function create(data: ContentCreateInput): Promise<{ id: string; _links: { webui: string } }>;

/**
 * Update an existing page (must increment version number)
 *
 * @example
 * const current = await confluence.content.get('123456');
 * await confluence.content.update('123456', {
 *   type: 'page', title: current.title,
 *   version: { number: current.version.number + 1 },
 *   body: { storage: { value: '<p>Updated</p>', representation: 'storage' } }
 * });
 */
declare function update(id: string, data: ContentUpdateInput): Promise<void>;

/** Delete a page */
declare function deletePage(id: string): Promise<void>;

interface ContentCreateInput {
  type: 'page' | 'blogpost';
  title: string;
  space: { key: string };
  body: { storage: { value: string; representation: 'storage' } };
  ancestors?: Array<{ id: string }>;
  status?: 'current' | 'draft';
}

interface ContentUpdateInput {
  type: 'page' | 'blogpost';
  title: string;
  version: { number: number; message?: string };
  body?: { storage: { value: string; representation: 'storage' } };
  status?: 'current' | 'draft';
}

export const content: {
  search: typeof search;
  get: typeof get;
  getBySpace: typeof getBySpace;
  getChildren: typeof getChildren;
  getDescendants: typeof getDescendants;
  getComments: typeof getComments;
  preview: typeof preview;
  create: typeof create;
  update: typeof update;
  delete: typeof deletePage;
};
