<script setup lang="ts">
import SettingsPage from "@/views/SettingsPage.vue";
import { darkTheme, lightTheme, NConfigProvider, NGlobalStyle } from 'naive-ui';
import type { GlobalTheme, GlobalThemeOverrides } from 'naive-ui';
import { SettingsManager, Theme } from '@/settings';
import { computed } from 'vue';
import Header from '@/components/Header.vue';
import { RepositoriesManager } from '@/repositories';
import { ViewsManager } from '@/views';
import RepositoryList from '@/views/RepositoryList.vue';
import Editor from '@/views/Editor.vue';

const viewsManager = ViewsManager();
const repositoriesManager = RepositoriesManager();
const settingsManager = SettingsManager();

const themeMap: Record<Exclude<Theme, null>, GlobalTheme> = {
  'lightTheme': lightTheme,
  'darkTheme': darkTheme,
};

const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    fontSize: settingsManager.fontSize + 'px',
  },
}));
</script>

<template>
  <n-config-provider :theme="themeMap[settingsManager.theme ?? 'lightTheme']" :theme-overrides="themeOverrides">
    <n-global-style />
    <main class="container">
      <Header />
      <div v-if="viewsManager.selectedView == 'settingsView'">
        <SettingsPage />
      </div>
      <div v-if="viewsManager.selectedView == 'repositoryList'">
        <RepositoryList />
      </div>
      <div v-if="viewsManager.selectedView == 'editor'">
        <Editor />
      </div>
    </main>
  </n-config-provider>
</template>

<style scoped>
</style>

<style>
</style>