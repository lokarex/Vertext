export interface CommitInfo {
    oid: string;
    fullOid: string;
    message: string;
    author: string;
    time: number;
    branches: string[];
    tags: string[];
    isHead: boolean;
}
