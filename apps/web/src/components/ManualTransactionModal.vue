<script setup lang="ts">
import { ref, watch, computed } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import DatePicker from "primevue/datepicker";
import Select from "primevue/select";
import Textarea from "primevue/textarea";
import { useToast } from "primevue/usetoast";
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
const toast = useToast();

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
  { label: "Saida (-)", value: "saida" },
  { label: "Entrada (+)", value: "entrada" },
];

const tipoOptions = computed(() => ref_.tipos.map((t) => ({ label: t, value: t })));

async function save() {
  if (!data.value || valor.value == null || !tipo.value.trim() || !categoriaId.value) {
    toast.add({
      severity: "warn",
      summary: "Campos obrigatorios",
      detail: "Data, valor, tipo e categoria sao obrigatorios.",
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
      toast.add({ severity: "success", summary: "Atualizada", life: 1500 });
      emit("updated", t);
    } else {
      const t = await createTransaction(body);
      toast.add({ severity: "success", summary: "Criada", life: 1500 });
      emit("created", t);
    }
    emit("update:visible", false);
  } catch (err) {
    toast.add({
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
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    modal
    :header="dialogHeader"
    :style="{ width: '480px' }"
  >
    <div class="form-grid">
      <div class="field">
        <label>Data *</label>
        <DatePicker v-model="data" dateFormat="dd/mm/yy" showIcon fluid />
      </div>
      <div class="field">
        <label>Sinal</label>
        <Select v-model="sinal" :options="sinalOptions" optionLabel="label" optionValue="value" fluid />
      </div>
      <div class="field">
        <label>Valor (R$) *</label>
        <InputNumber
          v-model="valor"
          mode="decimal"
          locale="pt-BR"
          :minFractionDigits="2"
          :maxFractionDigits="2"
          :min="0"
          placeholder="0,00"
          fluid
        />
      </div>
      <div class="field full">
        <label>Tipo *</label>
        <Select
          v-model="tipo"
          :options="tipoOptions"
          optionLabel="label"
          optionValue="value"
          editable
          filter
          placeholder="Selecione ou digite"
          fluid
        />
      </div>
      <div class="field full">
        <label>Detalhe</label>
        <InputText v-model="detalhe" placeholder="Descrição do destinatário / loja" fluid />
      </div>
      <div class="field full">
        <label>Categoria *</label>
        <Select
          v-model="categoriaId"
          :options="ref_.categoryOptions"
          optionLabel="label"
          optionValue="value"
          filter
          placeholder="Selecione"
          fluid
        />
      </div>
      <div class="field full">
        <label>Observacao</label>
        <Textarea v-model="observacao" rows="2" autoResize fluid />
      </div>
    </div>
    <template #footer>
      <Button label="Cancelar" severity="secondary" text @click="emit('update:visible', false)" />
      <Button label="Salvar" icon="pi pi-check" :loading="saving" @click="save" />
    </template>
  </Dialog>
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
