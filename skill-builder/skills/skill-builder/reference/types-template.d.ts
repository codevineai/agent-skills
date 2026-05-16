/**
 * TypeScript Interface Template for API Skills
 *
 * These types document your API for the agent. Key principles:
 *
 * 1. Define all response types with their fields
 * 2. Define option/input types for methods that accept parameters
 * 3. Define the API interface with JSDoc including @example blocks
 * 4. Use clear, descriptive names
 */

// ============================================================================
// RESPONSE TYPES - What the API returns
// ============================================================================

interface Resource {
  id: string;
  name: string;
  status: 'active' | 'archived' | 'pending';
  created_at: string;  // ISO 8601 date
  updated_at: string;
  metadata?: Record<string, any>;
}

interface User {
  id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'member' | 'viewer';
  active: boolean;
}

// ============================================================================
// REQUEST/OPTION TYPES - What methods accept
// ============================================================================

interface ResourceListOptions {
  /** Maximum results to return (default: 50) */
  limit?: number;
  /** Offset for pagination (default: 0) */
  offset?: number;
  /** Filter by status */
  status?: 'active' | 'archived' | 'pending';
}

interface ResourceCreateInput {
  /** Resource name (required) */
  name: string;
  /** Initial status (default: 'pending') */
  status?: 'active' | 'archived' | 'pending';
  /** Optional metadata */
  metadata?: Record<string, any>;
}

interface ResourceUpdateInput {
  /** New name */
  name?: string;
  /** New status */
  status?: 'active' | 'archived' | 'pending';
  /** Updated metadata (merged with existing) */
  metadata?: Record<string, any>;
}

// ============================================================================
// RESULT TYPES - For paginated responses
// ============================================================================

interface ResourceListResult {
  items: Resource[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// ============================================================================
// API INTERFACE - Document all methods with examples
// ============================================================================

interface ResourcesAPI {
  /**
   * List all resources with optional filtering
   *
   * @example
   * // List first 10 active resources
   * const result = await api.resources.list({ limit: 10, status: 'active' });
   * for (const r of result.items) {
   *   console.log(`${r.id}: ${r.name}`);
   * }
   *
   * @example
   * // Paginate through all resources
   * let offset = 0;
   * let hasMore = true;
   * while (hasMore) {
   *   const result = await api.resources.list({ limit: 100, offset });
   *   for (const r of result.items) console.log(r.name);
   *   hasMore = result.has_more;
   *   offset += result.items.length;
   * }
   */
  list(options?: ResourceListOptions): Promise<ResourceListResult>;

  /**
   * Get a single resource by ID
   *
   * @example
   * const resource = await api.resources.get('res_abc123');
   * console.log(resource.name, resource.status);
   */
  get(id: string): Promise<Resource>;

  /**
   * Create a new resource
   *
   * @example
   * const resource = await api.resources.create({
   *   name: 'My Resource',
   *   status: 'active',
   *   metadata: { priority: 'high' }
   * });
   * console.log('Created:', resource.id);
   */
  create(data: ResourceCreateInput): Promise<Resource>;

  /**
   * Update an existing resource
   *
   * @example
   * await api.resources.update('res_abc123', {
   *   name: 'Updated Name',
   *   status: 'archived'
   * });
   */
  update(id: string, data: ResourceUpdateInput): Promise<Resource>;

  /**
   * Delete a resource
   *
   * @example
   * await api.resources.delete('res_abc123');
   * console.log('Deleted');
   */
  delete(id: string): Promise<void>;
}

interface UsersAPI {
  /**
   * List all users
   *
   * @example
   * const users = await api.users.list();
   * const admins = users.filter(u => u.role === 'admin');
   */
  list(): Promise<User[]>;

  /**
   * Get a user by ID
   *
   * @example
   * const user = await api.users.get('usr_xyz789');
   * console.log(user.display_name);
   */
  get(id: string): Promise<User>;
}

// ============================================================================
// TOP-LEVEL API OBJECT
// ============================================================================

interface API {
  resources: ResourcesAPI;
  users: UsersAPI;
}
