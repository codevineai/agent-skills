/**
 * Sources API Types
 *
 * Types for fetching source code and SCM (source control) information.
 */

export interface SourcesOptions {
  /** Branch name */
  branch?: string;
  /** Pull request ID */
  pullRequest?: string;
}

export interface ScmOptions extends SourcesOptions {
  /** First line (starts at 1) */
  from?: number;
  /** Last line (inclusive) */
  to?: number;
  /** Group by commits if false */
  commitsByLine?: boolean;
}

export interface ScmInfo {
  scm: Array<{
    line: number;
    author: string;
    date: string;
    revision: string;
  }>;
}

/**
 * @example
 * // Get raw source code for a file
 * const fileKey = 'my-project:src/main/java/Foo.java';
 * const source = await api.sources.getRaw(fileKey);
 * console.log(source);
 *
 * @example
 * // Get source code for a file in a PR
 * const source = await api.sources.getRaw(fileKey, {
 *   pullRequest: '123'
 * });
 *
 * // Extract specific lines
 * const lines = source.split('\n');
 * const snippet = lines.slice(100, 110).join('\n');
 *
 * @example
 * // Get SCM information (blame data)
 * const scmInfo = await api.sources.getScm(fileKey, {
 *   from: 1,
 *   to: 100
 * });
 *
 * scmInfo.scm.forEach(line => {
 *   console.log(`Line ${line.line}: ${line.author} on ${line.date}`);
 * });
 */
