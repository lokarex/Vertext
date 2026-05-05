export type RepositoryStatus = 'unconfigured' | 'unsynced' | 'synced';

export class Repository {
    name!: string;
    status: RepositoryStatus = 'unconfigured';
    remoteUrl: string | null = null;
    userName: string | null = null;
    password: string | null = null;
}
