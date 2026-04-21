import { createI18n } from "vue-i18n";
import zhCN from './locals/zh-CN.ts';
import en from './locals/en.ts'
import { SettingsManager } from "@/settings.ts";

let i18nInstance: ReturnType<typeof createI18n> | null = null;

export function initializeI18n() {
    if (!i18nInstance) {
        const settingsManager = SettingsManager();

        i18nInstance = createI18n({
            messages: {
                'zh-CN': zhCN,
                'en': en,
            },
            legacy: false,
            globalInjection: true,
            locale: settingsManager.language as string || 'en',
            fallbackLocale: 'en',
        });
    }

    return i18nInstance;
}

export function i18n() {
    if (!i18nInstance) {
        throw new Error('i18n instance not initialized. Call initializeI18n() first.');
    }
    return i18nInstance;
}

export default initializeI18n;
