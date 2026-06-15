import { defineStore } from "pinia";
import { ref } from "vue";
import {
  getMe,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  updateUserSettings,
  type AuthUser,
  type UserSettings,
} from "../lib/api";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      user.value = await getMe();
    } catch {
      user.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function login(email: string, password: string) {
    loading.value = true;
    error.value = null;
    try {
      user.value = await apiLogin(email, password);
    } catch (err) {
      user.value = null;
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function register(body: { name?: string; email: string; password: string }) {
    loading.value = true;
    error.value = null;
    try {
      user.value = await apiRegister(body);
    } catch (err) {
      user.value = null;
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    await apiLogout();
    user.value = null;
  }

  async function saveSettings(settings: UserSettings) {
    if (!user.value) return;
    user.value = await updateUserSettings(settings);
  }

  return { user, loading, error, load, login, register, logout, saveSettings };
});
