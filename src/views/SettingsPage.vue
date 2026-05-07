<script lang="ts" setup>
import { useSettingsStore, Theme } from '@/stores/settings';
import { NSelect, SelectOption, NInputNumber, NCard, NDivider, NScrollbar } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';

const { t } = useI18n();

const settingsStore = useSettingsStore();

const themeOptions = computed(() => [
    {
        value: 'darkTheme',
        label: t('theme.label.dark'),
    },
    {
        value: 'lightTheme',
        label: t('theme.label.light'),
    },
]);

function handleThemeChange(value: string, _options: SelectOption) {
    settingsStore.setTheme(value as Theme);
}

function handleFontSizeChange(value: number | null) {
    if (value !== null) {
        settingsStore.setFontSize(value)
    }
}

const languageOptions = computed(() => [
    {
        value: 'en',
        label: t('language.label.en'),
    },
    {
        value: 'zh-CN',
        label: t('language.label.zh_CN'),
    },
]);

function handleLanguageChange(value: "en" | "zh-CN", _options: SelectOption) {
    settingsStore.setLanguage(value);
}

function handleAutoSaveIntervalChange(value: number | null) {
    if (value !== null) {
        settingsStore.setAutoSaveInterval(value)
    }
}
</script>

<template>
    <n-scrollbar>
      <n-card class="settings-card">
        <label class="settings-title">{{ $t('settings.title') }}</label>
        
        <div>
            <label class="settings-section-title">{{ $t('settings.label.appearance') }}</label>

            <div class="settings-item">
                <label class="settings-item-title">{{ $t('settings.label.theme') }}</label>
                <n-select v-model:value="settingsStore.theme" :options="themeOptions" @update-value="handleThemeChange"/>
            </div>

            <n-divider/>

            <div class="settings-item">
                <label class="settings-item-title">{{ $t('settings.label.fontSize') }}</label>
                <n-input-number v-model:value="settingsStore.fontSize" size="small" @update:value="handleFontSizeChange" :min="12" :max="36"/>
            </div>

            <n-divider/>

            <div class="settings-item">
                <label class="settings-item-title">{{ $t('settings.label.language') }}</label>
                <n-select v-model:value="settingsStore.language" :options="languageOptions" @update-value="handleLanguageChange"/>
            </div>

            <n-divider/>

            <label class="settings-section-title">{{ $t('settings.label.editor') }}</label>

            <div class="settings-item">
                <label class="settings-item-title">{{ $t('settings.label.autoSaveInterval') }}</label>
                <n-input-number v-model:value="settingsStore.autoSaveInterval" size="small" @update:value="handleAutoSaveIntervalChange" :min="1" :max="120"/>
            </div>

        </div>

      </n-card>
    </n-scrollbar>
</template>

<style scoped>
.settings-card {
    padding: 20px 10px;
    margin: 5% 7%;
    width: 86%;
}

.settings-title {
    font-size: 1.5em;
    font-weight: bold;
    display: block;
    margin-bottom: 20px;
}

.settings-section-title {
    font-size: 1.2em;
    font-weight: 600;
    display: block;
    margin-bottom: 16px;
}

.settings-item {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
}

.settings-item-title {
    font-size: 1em;
}

.settings-item :deep(.n-select) {
    width: 150px;
    justify-self: end;
}

.settings-item :deep(.n-input-number) {
    width: 150px;
    justify-self: end;
}
</style>