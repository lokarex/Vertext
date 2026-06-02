/**
 * @file Application settings Pinia store.
 * Manages theme, font size, language, and auto-save interval.
 * Settings are persisted via the Tauri Store plugin and restored
 * on application launch.
 */
import { Store } from '@tauri-apps/plugin-store';
import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { debug, trace } from '@tauri-apps/plugin-log';
import { i18n } from '@/i18n';
import { createI18n } from 'vue-i18n';
import type { AiProviderType } from '@/models/AiConfig';

/** Available theme values. */
export type Theme = 'lightTheme' | 'darkTheme' | null;
/** Available language codes. */
export type Language = 'en' | 'zh-CN' | null;

/**
 * Pinia store for application-wide settings.
 * Persists user preferences to `settings.json` via Tauri's Store plugin.
 */
export const useSettingsStore = defineStore('settings', () => {
    /** Reference to the Tauri persistent store. */
    let store: Store | null = null;
    /** Cached i18n instance for locale switching. */
    let i18nInstance: ReturnType<typeof createI18n> | null = null;

    /** Current UI theme. */
    const theme = ref<Theme>('darkTheme');
    /** UI font size in pixels. */
    const fontSize = ref<number>(14);
    /** Current display language. */
    const language = ref<Language>('en');
    /** Auto-save interval for the editor, in seconds. */
    const autoSaveInterval = ref<number>(10);
    const aiProvider = ref<AiProviderType | null>(null);
    const aiModel = ref<string>('');
    const aiOllamaEndpoint = ref<string>('http://localhost:11434');

    /** Whether the store has completed its initial load from disk. */
    const isInitialized = ref<boolean>(false);

    /**
     * Loads persisted settings from the Tauri store.
     * Updates the i18n locale to match the loaded language.
     */
    async function initialize() {
        try {
            trace('Initializing settings manager...');

            trace('Loading tauri store...');
            store = await Store.load('settings.json');
            trace('Tauri store loaded successfully.');

            trace('Loading settings...');
            theme.value = await store?.get('theme') as Theme ?? 'darkTheme';
            debug(`Loaded theme: ${theme.value}`);
            fontSize.value = await store?.get('fontSize') as number ?? 14;
            debug(`Loaded font size: ${fontSize.value}`);
            language.value = await store?.get('language') as Language ?? 'en';
            debug(`Loaded language: ${language.value}`);
            autoSaveInterval.value = await store?.get('autoSaveInterval') as number ?? 10;
            debug(`Loaded auto save interval: ${autoSaveInterval.value}`);
            aiProvider.value = await store?.get('aiProvider') as AiProviderType | null ?? null;
            debug(`Loaded ai provider: ${aiProvider.value}`);
            aiModel.value = await store?.get('aiModel') as string ?? '';
            debug(`Loaded ai model: ${aiModel.value}`);
            aiOllamaEndpoint.value = await store?.get('aiOllamaEndpoint') as string ?? 'http://localhost:11434';
            debug(`Loaded ai endpoint: ${aiOllamaEndpoint.value}`);
            isInitialized.value = true;
            trace('Settings loaded successfully.');

            if (!i18nInstance) {
                i18nInstance = i18n();
            }
            (i18nInstance.global.locale as any).value = language.value || 'en';

            trace('Settings manager initialized successfully.');
        }
        catch (err) {
            trace(`Failed to initialize settings manager: ${err}`);
            isInitialized.value = false;
            throw err;
        }
    }

    initialize();

    /**
     * Updates the theme and persists it.
     * @param newTheme - The new theme value.
     */
    async function setTheme(newTheme: Theme) {
        debug(`New theme: ${newTheme}`);
        await store?.set('theme', newTheme);
        await store?.save();
        theme.value = newTheme;
    }

    /**
     * Updates the font size and persists it.
     * @param newFontSize - The new font size in pixels.
     */
    async function setFontSize(newFontSize: number) {
        debug(`New font size: ${newFontSize}`);
        await store?.set('fontSize', newFontSize);
        await store?.save();
        fontSize.value = newFontSize;
    }

    /**
     * Updates the display language, persists it, and updates the i18n locale.
     * @param newLanguage - The new language code.
     */
    async function setLanguage(newLanguage: Language) {
        debug(`New language: ${newLanguage}`);
        await store?.set('language', newLanguage);
        await store?.save();
        language.value = newLanguage;

        if (!i18nInstance) {
            i18nInstance = i18n();
        }

        (i18nInstance.global.locale as any).value = newLanguage || 'en';
    }

    /**
     * Updates the auto-save interval and persists it.
     * @param newInterval - The new interval in seconds.
     */
    async function setAutoSaveInterval(newInterval: number) {
        debug(`New auto save interval: ${newInterval}`);
        await store?.set('autoSaveInterval', newInterval);
        await store?.save();
        autoSaveInterval.value = newInterval;
    }

    const DEFAULT_MODELS: Record<AiProviderType, string> = {
        openai: 'gpt-4.1-mini',
        anthropic: 'claude-haiku-3-5-20241022',
        deepseek: 'deepseek-v4-flash',
        ollama: 'llama3',
    };

    async function setAiProvider(provider: AiProviderType | null) {
        debug(`New ai provider: ${provider}`);
        if (aiProvider.value) {
            try {
                await invoke('delete_password', { service: 'vertext-ai', user: aiProvider.value });
            } catch { /* ignore */ }
        }
        await store?.set('aiProvider', provider);
        await store?.save();
        aiProvider.value = provider;
        if (provider) {
            await setAiModel(DEFAULT_MODELS[provider]);
        } else {
            aiModel.value = '';
            await store?.set('aiModel', '');
            await store?.save();
        }
    }

    async function setAiModel(model: string) {
        debug(`New ai model: ${model}`);
        await store?.set('aiModel', model);
        await store?.save();
        aiModel.value = model;
    }

    async function setAiOllamaEndpoint(endpoint: string) {
        debug(`New ai endpoint: ${endpoint}`);
        await store?.set('aiOllamaEndpoint', endpoint);
        await store?.save();
        aiOllamaEndpoint.value = endpoint;
    }

    async function getAiApiKey(): Promise<string | null> {
        if (!aiProvider.value) return null;
        try {
            return await invoke('get_password', { service: 'vertext-ai', user: aiProvider.value });
        } catch {
            return null;
        }
    }

    async function setAiApiKey(key: string) {
        if (!aiProvider.value) return;
        await invoke('set_password', { service: 'vertext-ai', user: aiProvider.value, password: key });
    }

    async function deleteAiApiKey() {
        if (!aiProvider.value) return;
        try {
            await invoke('delete_password', { service: 'vertext-ai', user: aiProvider.value });
        } catch { /* ignore */ }
    }

    const isAiConfigured = computed(() => aiProvider.value !== null);

    return {
        theme,
        fontSize,
        language,
        autoSaveInterval,
        isInitialized,
        setTheme,
        setFontSize,
        setLanguage,
        setAutoSaveInterval,
        aiProvider,
        aiModel,
        aiOllamaEndpoint,
        setAiProvider,
        setAiModel,
        setAiOllamaEndpoint,
        getAiApiKey,
        setAiApiKey,
        deleteAiApiKey,
        isAiConfigured,
    };
});
