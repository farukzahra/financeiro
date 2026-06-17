import { createRouter, createWebHistory } from "vue-router";
import TransactionsView from "./views/TransactionsView.vue";
import SettingsView from "./views/SettingsView.vue";
import AboutView from "./views/AboutView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: TransactionsView },
    { path: "/configuracoes", component: SettingsView },
    { path: "/sobre", component: AboutView },
  ],
});
