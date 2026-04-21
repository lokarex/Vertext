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
