import { createI18n } from "vue-i18n";
import zhCN from './locales/zh-CN.ts';
import en from './locales/en.ts'
import { useSettingsStore } from "@/stores/settings";

let i18nInstance: ReturnType<typeof createI18n> | null = null;

export function initializeI18n() {
    if (!i18nInstance) {
        const settingsStore = useSettingsStore();

        i18nInstance = createI18n({
            messages: {
                'zh-CN': zhCN,
                'en': en,
            },
            legacy: false,
            globalInjection: true,
            locale: settingsStore.language as string || 'en',
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
