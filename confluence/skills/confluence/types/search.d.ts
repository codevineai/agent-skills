/**
 * Confluence Search API
 *
 * Advanced CQL search with excerpt support.
 * Use confluence.search.cql() for better ranking and excerpts.
 * Use confluence.content.search() for simpler queries with content expansion.
 */

/**
 * Search using CQL (Confluence Query Language)
 *
 * @example
 * const results = await confluence.search.cql(
 *   'text ~ "authentication" AND space = DEV',
 *   { excerpt: 'highlight', limit: 10 }
 * );
 *
 * for (const result of results.results) {
 *   console.log(`${result.title} - ${result.url}`);
 *   if (result.excerpt) console.log(`  ${result.excerpt}`);
 * }
 *
 * @example
 * // Recently updated pages
 * const results = await confluence.search.cql(
 *   'space = DEV AND type = page ORDER BY lastModified DESC',
 *   { limit: 20 }
 * );
 *
 * CQL Operators:
 * - text ~ "keyword" - Full-text search
 * - title ~ "keyword" - Search titles
 * - space = KEY or space IN (KEY1, KEY2) - Filter by space
 * - type = page|blogpost|comment|attachment - Filter by type
 * - created >= "2024-01-01" - Date filters
 * - lastModified > now("-7d") - Relative dates
 * - label = "api" - Filter by label
 * - contributor = currentUser() - Filter by contributor
 *
 * ORDER BY: title, created, lastModified, space
 */
declare function cql(
  query: string,
  options?: {
    limit?: number;
    start?: number;
    excerpt?: 'highlight' | 'indexed' | 'none';
  }
): Promise<{
  results: Array<{
    content: {
      id: string;
      type: string;
      title: string;
      space: { key: string; name: string };
    };
    title: string;
    url: string;
    excerpt?: string;
    lastModified: string;
  }>;
  start: number;
  limit: number;
  size: number;
  totalSize: number;
}>;

export const search: {
  cql: typeof cql;
};
