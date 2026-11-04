import { createRouter, createWebHistory } from "vue-router";
import TransactionsView from "./views/TransactionsView.vue";
import DashboardView from "./views/DashboardView.vue";
import SettingsView from "./views/SettingsView.vue";
import AboutView from "./views/AboutView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: TransactionsView },
    { path: "/dashboard", name: "dashboard", component: DashboardView, meta: { pageScroll: true } },
    { path: "/configuracoes", component: SettingsView },
    { path: "/sobre", component: AboutView },
  ],
});
