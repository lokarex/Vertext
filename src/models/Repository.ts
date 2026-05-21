/**
 * @file Repository model.
 * @typedef RepositoryStatus
 * @class Repository
 */

/**
 * Possible synchronization statuses for a repository.
 * - `unconfigured` — no remote URL or credentials have been set.
 * - `unsynced` — remote is configured but local changes are not yet pushed.
 * - `synced` — local and remote are in sync.
 */
export type RepositoryStatus = 'unconfigured' | 'unsynced' | 'synced';

/**
 * Represents a Git repository managed by the application.
 */
export class Repository {
    /** Repository name (used as the local directory name). */
    name!: string;
    /** Current sync status. */
    status: RepositoryStatus = 'unconfigured';
    /** Remote origin URL (e.g. `https://github.com/user/repo.git`). */
    remoteUrl: string | null = null;
    /** Authentication username for the remote. */
    userName: string | null = null;
}
