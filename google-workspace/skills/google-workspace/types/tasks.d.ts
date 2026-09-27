/**
 * Google Tasks API Types
 *
 * Manage task lists and tasks. Requires the `tasks` scope (granted by setup.js
 * since 1.5.0) and the Google Tasks API enabled in the OAuth client's GCP project.
 *
 * Every tasks.tasks method takes options.tasklistId. It defaults to '@default',
 * the user's primary list.
 */

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface TaskList {
  id: string;
  title: string;
  updated: string;
  selfLink?: string;
}

interface Task {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  /** RFC 3339. The API stores the date only; the time portion is discarded. */
  due?: string;
  /** RFC 3339 completion time. Present only when status is 'completed'. */
  completed?: string;
  /** Parent task ID when this is a subtask */
  parent?: string;
  /** Sort key among siblings */
  position?: string;
  updated: string;
  deleted?: boolean;
  hidden?: boolean;
  webViewLink?: string;
  links?: Array<{ type: string; description: string; link: string }>;
}

/** Fields accepted when creating or updating a task */
interface TaskInput {
  title?: string;
  notes?: string;
  due?: string;
  status?: 'needsAction' | 'completed';
}

// ============================================================================
// OPTION TYPES
// ============================================================================

interface TaskListRef {
  /** Task list ID (default: '@default') */
  tasklistId?: string;
}

interface TaskListOptions extends TaskListRef {
  /** Max tasks per page (default and API max: 100) */
  maxResults?: number;
  pageToken?: string;
  /** Set false to return only open tasks (default: completed tasks are included) */
  showCompleted?: boolean;
  /** Include tasks completed in first-party Google clients and cleared tasks. Needed to see most completed tasks. */
  showHidden?: boolean;
  showDeleted?: boolean;
  /** RFC 3339 bounds on due date */
  dueMin?: string;
  dueMax?: string;
  /** RFC 3339 bounds on completion date */
  completedMin?: string;
  completedMax?: string;
  /** RFC 3339 lower bound on last modification */
  updatedMin?: string;
}

// ============================================================================
// API INTERFACE
// ============================================================================

interface TaskListsAPI {
  /**
   * List the user's task lists.
   *
   * @example
   * const { items } = await tasks.tasklists.list();
   * for (const l of items) console.log(l.id, l.title);
   */
  list(options?: { maxResults?: number; pageToken?: string }): Promise<{ items: TaskList[]; nextPageToken?: string }>;

  /** Get a task list (default: the primary list). */
  get(tasklistId?: string): Promise<TaskList>;

  create(options: { title: string }): Promise<TaskList>;

  /** Rename a list: tasks.tasklists.patch(id, { title }) */
  patch(tasklistId: string, fields: { title?: string }): Promise<TaskList>;

  /** Delete a list and every task in it. */
  delete(tasklistId: string): Promise<null>;
}

interface TasksTasksAPI {
  /**
   * List tasks. `items` is absent when the list is empty.
   *
   * @example
   * // Open tasks in the primary list
   * const { items = [] } = await tasks.tasks.list({ showCompleted: false });
   * for (const t of items) console.log(`${t.due?.slice(0, 10) || 'no date'}  ${t.title}`);
   */
  list(options?: TaskListOptions): Promise<{ items?: Task[]; nextPageToken?: string }>;

  get(taskId: string, options?: TaskListRef): Promise<Task>;

  /**
   * Create a task at the top of the list.
   *
   * @example
   * const t = await tasks.tasks.create({ title: 'Send invoice', notes: 'Acme, September', due: '2026-10-05T00:00:00.000Z' });
   *
   * @example
   * // Subtask
   * await tasks.tasks.create({ title: 'Attach timesheet' }, { parent: t.id });
   */
  create(task: TaskInput, options?: TaskListRef & {
    /** Parent task ID — creates a subtask */
    parent?: string;
    /** Sibling task ID to insert after */
    previous?: string;
  }): Promise<Task>;

  /** Partial update. Provide only the fields to change. */
  patch(taskId: string, fields: TaskInput, options?: TaskListRef): Promise<Task>;

  /** Full replace. Provide the complete task resource, including `id`. */
  update(taskId: string, task: TaskInput & { id: string }, options?: TaskListRef): Promise<Task>;

  delete(taskId: string, options?: TaskListRef): Promise<null>;

  /** Mark a task completed. */
  complete(taskId: string, options?: TaskListRef): Promise<Task>;

  /** Mark a completed task as open again. */
  reopen(taskId: string, options?: TaskListRef): Promise<Task>;

  /**
   * Reorder within a list, re-parent, or move to another list.
   *
   * @example
   * await tasks.tasks.move(taskId, { destinationTasklist: otherListId });
   */
  move(taskId: string, options?: TaskListRef & { parent?: string; previous?: string; destinationTasklist?: string }): Promise<Task>;

  /** Hide every completed task in the list. They remain readable with showHidden. */
  clearCompleted(options?: TaskListRef): Promise<null>;
}

interface TasksAPI {
  tasklists: TaskListsAPI;
  tasks: TasksTasksAPI;
}
