<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink, RouterView } from "vue-router";
import Toast from "primevue/toast";
import ConfirmDialog from "primevue/confirmdialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import { useToast } from "primevue/usetoast";
import { useAuthStore } from "./stores/auth";
import { useReferenceStore } from "./stores/reference";

const auth = useAuthStore();
const refs = useReferenceStore();
const toast = useToast();

const mode = ref<"login" | "register">("login");
const name = ref("");
const email = ref("farukz@gmail.com");
const password = ref("");

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
    toast.add({
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
  <Toast />
  <ConfirmDialog />

  <div v-if="auth.loading" class="auth-loading">
    <i class="pi pi-spin pi-spinner" />
  </div>

  <template v-else-if="auth.user">
    <header class="app-header">
      <div class="app-header-brand">
        <span class="app-header-logo">C</span>
        <span class="app-header-title">Financeiro</span>
      </div>
      <nav class="app-header-nav" aria-label="Navegacao principal">
        <RouterLink to="/" class="app-nav-link" title="Transacoes">
          <i class="pi pi-list" />
          <span>Transacoes</span>
        </RouterLink>
        <RouterLink to="/configuracoes" class="app-nav-link" title="Configuracoes">
          <i class="pi pi-cog" />
          <span>Configuracoes</span>
        </RouterLink>
      </nav>
      <div class="app-user">
        <span v-if="auth.user.role === 'admin'" class="app-role">admin</span>
        <span class="app-user-email">{{ auth.user.email }}</span>
        <Button icon="pi pi-sign-out" text rounded aria-label="Sair" @click="onLogout" />
      </div>
    </header>
    <main class="app-shell">
      <RouterView />
    </main>
  </template>

  <main v-else class="login-shell">
    <form class="login-panel" @submit.prevent="submitAuth">
      <div class="login-brand">
        <span class="app-header-logo">C</span>
        <span class="app-header-title">Financeiro</span>
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
        <InputText v-model="name" autocomplete="name" fluid />
      </div>

      <div class="field">
        <label>Email</label>
        <InputText v-model="email" type="email" autocomplete="email" fluid />
      </div>

      <div class="field">
        <label>Senha</label>
        <Password
          v-model="password"
          :feedback="mode === 'register'"
          toggleMask
          autocomplete="current-password"
          fluid
        />
      </div>

      <Button
        type="submit"
        :label="mode === 'login' ? 'Entrar' : 'Criar conta'"
        icon="pi pi-sign-in"
        :loading="auth.loading"
        fluid
      />

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
  background: var(--p-content-background);
}

.auth-loading {
  font-size: 2rem;
  color: var(--p-primary-color);
}

.login-panel {
  width: min(380px, calc(100vw - 2rem));
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  background: var(--p-surface-0, #fff);
}

.login-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  margin-bottom: 0.25rem;
}

.auth-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  overflow: hidden;
}

.auth-tabs button {
  border: 0;
  background: transparent;
  padding: 0.65rem;
  cursor: pointer;
  color: var(--p-text-muted-color, #6b7280);
}

.auth-tabs button.active {
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color, #fff);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field label {
  font-size: 0.78rem;
  color: var(--p-text-muted-color, #6b7280);
}

.login-error {
  margin: 0;
  text-align: center;
  font-size: 0.8rem;
  color: var(--p-text-muted-color, #6b7280);
}

.login-error {
  color: var(--p-red-600, #dc2626);
}

.app-user {
  display: flex;
  align-items: center;
  justify-self: end;
  gap: 0.5rem;
  min-width: 0;
}

.app-role {
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color, #fff);
  font-size: 0.72rem;
}

.app-user-email {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
  color: var(--p-text-muted-color, #6b7280);
}
</style>
