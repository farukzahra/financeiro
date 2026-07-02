<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useSnackbar } from "../composables/useSnackbar";
import { useReferenceStore } from "../stores/reference";
import { createTransaction, patchTransaction, type Transaction } from "../lib/api";

const props = defineProps<{
  visible: boolean;
  editing?: Transaction | null;
}>();
const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "created", t: Transaction): void;
  (e: "updated", t: Transaction): void;
}>();

const ref_ = useReferenceStore();
const snackbar = useSnackbar();

const data = ref<Date | null>(new Date());
const valor = ref<number | null>(null);
const sinal = ref<"saida" | "entrada">("saida");
const tipo = ref("");
const detalhe = ref("");
const categoriaId = ref<string | null>(null);
const observacao = ref("");
const saving = ref(false);

const isEdit = computed(() => !!props.editing);
const dialogHeader = computed(() =>
  isEdit.value ? "Editar transação" : "Nova transação manual",
);

function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

watch(
  () => props.visible,
  (v) => {
    if (!v) return;
    if (props.editing) {
      const e = props.editing;
      data.value = parseIso(e.data);
      const n = Number(e.valor);
      valor.value = Math.abs(n);
      sinal.value = n < 0 ? "saida" : "entrada";
      tipo.value = e.tipo;
      detalhe.value = e.detalhe;
      categoriaId.value = e.categoriaId;
      observacao.value = e.observacao ?? "";
    } else {
      data.value = new Date();
      valor.value = null;
      sinal.value = "saida";
      tipo.value = "";
      detalhe.value = "";
      categoriaId.value = null;
      observacao.value = "";
    }
  },
);

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const sinalOptions = [
  { title: "Saída (-)", value: "saida" },
  { title: "Entrada (+)", value: "entrada" },
];

const tipoOptions = computed(() => ref_.tipos.map((t) => ({ title: t, value: t })));

async function save() {
  if (!data.value || valor.value == null || !tipo.value.trim() || !categoriaId.value) {
    snackbar.add({
      severity: "warn",
      summary: "Campos obrigatórios",
      detail: "Data, valor, tipo e categoria são obrigatórios.",
      life: 3000,
    });
    return;
  }
  saving.value = true;
  try {
    const abs = Math.abs(valor.value);
    const signed = sinal.value === "saida" ? -abs : abs;
    const body = {
      data: toIso(data.value),
      valor: signed.toFixed(2),
      tipo: tipo.value.trim(),
      detalhe: detalhe.value.trim(),
      categoriaId: categoriaId.value,
      observacao: observacao.value.trim() || null,
    };
    if (isEdit.value && props.editing) {
      const t = await patchTransaction(props.editing.identificador, body);
      snackbar.add({ severity: "success", summary: "Atualizada", life: 1500 });
      emit("updated", t);
    } else {
      const t = await createTransaction(body);
      snackbar.add({ severity: "success", summary: "Criada", life: 1500 });
      emit("created", t);
    }
    emit("update:visible", false);
  } catch (err) {
    snackbar.add({
      severity: "error",
      summary: "Erro ao salvar",
      detail: (err as Error).message,
      life: 3000,
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-dialog
    :model-value="visible"
    max-width="480"
    @update:model-value="emit('update:visible', $event)"
  >
    <v-card>
      <v-card-title>{{ dialogHeader }}</v-card-title>
      <v-card-text>
        <div class="form-grid">
          <div class="field">
            <label>Data *</label>
            <v-menu :close-on-content-click="false">
              <template #activator="{ props: menuProps }">
                <v-text-field
                  v-bind="menuProps"
                  :model-value="data ? data.toLocaleDateString('pt-BR') : ''"
                  readonly
                  prepend-inner-icon="mdi-calendar"
                />
              </template>
              <v-date-picker v-model="data" />
            </v-menu>
          </div>
          <div class="field">
            <label>Sinal</label>
            <v-select v-model="sinal" :items="sinalOptions" item-title="title" item-value="value" />
          </div>
          <div class="field">
            <label>Valor (R$) *</label>
            <v-number-input
              v-model="valor"
              :min="0"
              :precision="2"
              control-variant="hidden"
              placeholder="0,00"
            />
          </div>
          <div class="field full">
            <label>Tipo *</label>
            <v-combobox
              v-model="tipo"
              :items="tipoOptions"
              item-title="title"
              item-value="value"
              placeholder="Selecione ou digite"
            />
          </div>
          <div class="field full">
            <label>Detalhe</label>
            <v-text-field v-model="detalhe" placeholder="Descrição do destinatário / loja" />
          </div>
          <div class="field full">
            <label>Categoria *</label>
            <v-autocomplete
              v-model="categoriaId"
              :items="ref_.categoryOptions"
              item-title="label"
              item-value="value"
              placeholder="Selecione"
            />
          </div>
          <div class="field full">
            <label>Observação</label>
            <v-textarea v-model="observacao" rows="2" auto-grow />
          </div>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:visible', false)">Cancelar</v-btn>
        <v-btn color="primary" prepend-icon="mdi-check" :loading="saving" @click="save">
          Salvar
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.field.full {
  grid-column: 1 / -1;
}
.field label {
  font-size: 0.75rem;
  opacity: 0.75;
}
</style>
