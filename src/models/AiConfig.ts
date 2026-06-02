export type AiProviderType = 'openai' | 'anthropic' | 'deepseek' | 'ollama';

export interface FileChangeSummary {
    path: string;
    status: string;
    additions: number;
    deletions: number;
}

export interface CommitSuggestion {
    message: string;
    filesChanged: FileChangeSummary[];
}
