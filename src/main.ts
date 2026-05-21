/**
 * @file Vertext application entry point.
 * Bootstraps the Vue 3 application with Pinia state management,
 * vue-i18n internationalization, and mounts to the `#app` DOM element.
 *
 * @see {@link https://vuejs.org/guide/essentials/application.html}
 * @see {@link https://pinia.vuejs.org/}
 * @see {@link https://vue-i18n.intlify.dev/}
 */
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import initializeI18n from './i18n'

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);

const i18n = initializeI18n();
app.use(i18n);

app.mount("#app");
