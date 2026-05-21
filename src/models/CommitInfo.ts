/**
 * @file Git commit information model.
 * @interface CommitInfo
 */

/**
 * Represents a single Git commit as returned by the Tauri backend.
 */
export interface CommitInfo {
    /** Abbreviated object identifier (short SHA). */
    oid: string;
    /** Full-length object identifier (full SHA). */
    fullOid: string;
    /** Commit message. */
    message: string;
    /** Author name. */
    author: string;
    /** Unix timestamp of the commit (seconds). */
    time: number;
    /** Branch names that include this commit. */
    branches: string[];
    /** Tag names pointing to this commit. */
    tags: string[];
    /** Whether this commit is the current HEAD. */
    isHead: boolean;
}
