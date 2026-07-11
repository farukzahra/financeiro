<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink, RouterView } from "vue-router";
import AppSnackbar from "./components/AppSnackbar.vue";
import AppConfirmDialog from "./components/AppConfirmDialog.vue";
import { useSnackbar } from "./composables/useSnackbar";
import { useAuthStore } from "./stores/auth";
import { useReferenceStore } from "./stores/reference";

const auth = useAuthStore();
const refs = useReferenceStore();
const snackbar = useSnackbar();

const mode = ref<"login" | "register">("login");
const name = ref("");
const email = ref("");
const password = ref("");
const showPassword = ref(false);

onMounted(async () => {
  await auth.load();
});

async function submitAuth() {
  try {
    if (mode.value === "login") {
      await auth.login(email.value, password.value);
    } else {
      await auth.register({
        name: name.value.trim() || undefined,
        email: email.value,
        password: password.value,
      });
    }
    await refs.load();
  } catch (err) {
    snackbar.add({
      severity: "error",
      summary: mode.value === "login" ? "Erro ao entrar" : "Erro ao cadastrar",
      detail: (err as Error).message,
      life: 4000,
    });
  }
}

async function onLogout() {
  await auth.logout();
  refs.reset();
  password.value = "";
}
</script>

<template>
  <AppSnackbar />
  <AppConfirmDialog />

  <div v-if="auth.loading" class="auth-loading">
    <v-progress-circular indeterminate color="primary" size="48" />
  </div>

  <template v-else-if="auth.user">
    <header class="app-header">
      <div class="app-header-brand">
        <span class="app-header-logo">Fi</span>
        <span class="app-header-title">Financeiro</span>
      </div>
      <nav class="app-header-nav" aria-label="Navegação principal">
        <RouterLink to="/" class="app-nav-link" title="Transações">
          <v-icon icon="mdi-format-list-bulleted" size="small" />
          <span>Transações</span>
        </RouterLink>
        <RouterLink to="/configuracoes" class="app-nav-link" title="Configurações">
          <v-icon icon="mdi-cog" size="small" />
          <span>Configurações</span>
        </RouterLink>
        <RouterLink to="/sobre" class="app-nav-link" title="Sobre">
          <v-icon icon="mdi-information" size="small" />
          <span>Sobre</span>
        </RouterLink>
      </nav>
      <div class="app-user">
        <span v-if="auth.user.role === 'admin'" class="app-role">admin</span>
        <span class="app-user-email">{{ auth.user.email }}</span>
        <v-btn icon="mdi-logout" variant="text" size="small" aria-label="Sair" @click="onLogout" />
      </div>
    </header>
    <main class="app-shell">
      <RouterView />
    </main>
  </template>

  <main v-else class="login-shell">
    <form class="login-panel" @submit.prevent="submitAuth">
      <div class="login-brand">
        <span class="app-header-logo">Fi</span>
        <div class="login-brand-text">
          <span class="app-header-title">Financeiro</span>
          <p class="login-tagline">Extrato, orçamento e categorias num só lugar.</p>
        </div>
      </div>

      <div class="auth-tabs">
        <button
          type="button"
          :class="{ active: mode === 'login' }"
          @click="mode = 'login'"
        >
          Entrar
        </button>
        <button
          type="button"
          :class="{ active: mode === 'register' }"
          @click="mode = 'register'"
        >
          Criar conta
        </button>
      </div>

      <div v-if="mode === 'register'" class="field">
        <label>Nome</label>
        <v-text-field v-model="name" autocomplete="name" />
      </div>

      <div class="field">
        <label>Email</label>
        <v-text-field v-model="email" type="email" autocomplete="email" />
      </div>

      <div class="field">
        <label>Senha</label>
        <v-text-field
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          autocomplete="current-password"
          @click:append-inner="showPassword = !showPassword"
        />
      </div>

      <v-btn
        type="submit"
        color="primary"
        block
        :loading="auth.loading"
        :prepend-icon="mode === 'login' ? 'mdi-login' : 'mdi-account-plus'"
      >
        {{ mode === "login" ? "Entrar" : "Criar conta" }}
      </v-btn>

      <p v-if="auth.error" class="login-error">{{ auth.error }}</p>
    </form>
  </main>
</template>

<style scoped>
.auth-loading,
.login-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background:
    radial-gradient(ellipse 80% 60% at 20% 10%, var(--app-primary-wash) 0%, transparent 55%),
    radial-gradient(ellipse 70% 50% at 90% 90%, rgba(30, 90, 168, 0.06) 0%, transparent 50%),
    var(--app-background);
}

.login-panel {
  width: min(400px, calc(100vw - 2rem));
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem 2rem 1.75rem;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-surface);
  background: var(--app-surface);
}

.login-brand {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}

.login-brand-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding-top: 0.15rem;
}

.login-tagline {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.35;
  color: var(--app-text-muted);
}

.auth-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  overflow: hidden;
}

.auth-tabs button {
  border: 0;
  background: transparent;
  padding: 0.65rem;
  cursor: pointer;
  color: var(--app-text-muted);
}

.auth-tabs button.active {
  background: var(--app-primary-wash);
  color: var(--app-primary-wash-text);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field label {
  font-size: 0.78rem;
  color: var(--app-text-muted);
}

.login-error {
  margin: 0;
  text-align: center;
  font-size: 0.8rem;
  color: rgb(var(--v-theme-error));
}

.app-user {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.app-role {
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: var(--app-primary-wash);
  color: var(--app-primary-wash-text);
  border: 1px solid rgba(30, 90, 168, 0.12);
  font-size: 0.72rem;
}

.app-user-email {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
  color: var(--app-text-muted);
}
</style>
