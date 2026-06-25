<script setup lang="ts">
import { ref, computed } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import FileUpload, { type FileUploadSelectEvent } from "primevue/fileupload";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Select from "primevue/select";
import Tag from "primevue/tag";
import ProgressSpinner from "primevue/progressspinner";
import { useToast } from "primevue/usetoast";
import { useReferenceStore } from "../stores/reference";
import {
  preview as previewImport,
  confirmImport,
  type PreviewResponse,
} from "../lib/api";
import { fmtMoneyBR, fmtDateBR, classMoney } from "../lib/format";

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "imported", stats: { totalImportadas: number; totalDuplicadas: number }): void;
}>();

const ref_ = useReferenceStore();
const toast = useToast();

const step = ref<"upload" | "preview" | "confirming">("upload");
const loading = ref(false);
const preview = ref<PreviewResponse | null>(null);
const selectedIds = ref(new Set<string>());

const visibleProxy = computed({
  get: () => props.visible,
  set: (v) => emit("update:visible", v),
});

function reset() {
  step.value = "upload";
  preview.value = null;
  loading.value = false;
  selectedIds.value = new Set();
}

function removeItem(id: string) {
  if (!preview.value) return;
  preview.value.itens = preview.value.itens.filter((i) => i.identificador !== id);
}

async function onSelect(e: FileUploadSelectEvent) {
  const file = (Array.isArray(e.files) ? e.files[0] : e.files) as File | undefined;
  if (!file) return;
  loading.value = true;
  try {
    if (!ref_.loaded) await ref_.load();
    const data = await previewImport(file);
    preview.value = data;
    // Começa com tudo desmarcado
    selectedIds.value = new Set();
    step.value = "preview";
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "Erro no preview",
      detail: (err as Error).message,
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
}

async function onConfirm() {
  if (!preview.value) return;
  step.value = "confirming";
  try {
    const novos = preview.value.itens.filter(
      (i) => !i.jaExistente && selectedIds.value.has(i.identificador),
    );
    const result = await confirmImport({
      metadata: preview.value.metadata,
      itens: novos.map((i) => ({
        identificador: i.identificador,
        data: i.data,
        valor: i.valor,
        descricaoRaw: i.descricaoRaw,
        tipo: i.tipo,
        detalhe: i.detalhe,
        chaveNormalizada: i.chaveNormalizada,
        categoriaId: i.categoriaSugerida,
        categoryRuleId: i.categoryRuleId,
        regraAplicada: i.regraAplicada,
      })),
    });
    emit("imported", {
      totalImportadas: result.totalImportadas,
      totalDuplicadas: result.totalDuplicadas,
    });
    visibleProxy.value = false;
    reset();
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "Erro ao confirmar",
      detail: (err as Error).message,
      life: 4000,
    });
    step.value = "preview";
  }
}

const categoryOptions = computed(() => ref_.categoryOptions);

const novosCount = computed(
  () => preview.value?.itens.filter((i) => !i.jaExistente).length ?? 0,
);
const dupCount = computed(
  () => preview.value?.itens.filter((i) => i.jaExistente).length ?? 0,
);

const novosDisponiveis = computed(
  () => preview.value?.itens.filter((i) => !i.jaExistente) ?? [],
);
const selectedCount = computed(
  () => novosDisponiveis.value.filter((i) => selectedIds.value.has(i.identificador)).length,
);
const allSelected = computed(
  () => novosDisponiveis.value.length > 0 && selectedCount.value === novosDisponiveis.value.length,
);
const someSelected = computed(
  () => selectedCount.value > 0 && !allSelected.value,
);

function toggleItem(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id);
  else selectedIds.value.add(id);
  selectedIds.value = new Set(selectedIds.value); // trigger reactivity
}

function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = new Set();
  } else {
    selectedIds.value = new Set(novosDisponiveis.value.map((i) => i.identificador));
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visibleProxy"
    modal
    header="Importar extrato"
    :style="{ width: '95vw', maxWidth: '1200px' }"
    @hide="reset"
  >
    <div v-if="step === 'upload'">
      <p>Selecione um arquivo CSV do Nubank (formato NU_&lt;conta&gt;_&lt;periodo&gt;.csv).</p>
      <FileUpload
        mode="basic"
        :auto="true"
        accept=".csv"
        chooseLabel="Selecionar arquivo"
        customUpload
        @select="onSelect"
        :pt="{ root: { style: 'display: inline-block' } }"
      />
      <div v-if="loading" style="margin-top: 1rem; display: flex; align-items: center; gap: 0.5rem">
        <ProgressSpinner style="width: 24px; height: 24px" /> Processando...
      </div>
    </div>

    <div v-else-if="step === 'preview' && preview">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem">
        <div><strong>Arquivo:</strong> {{ preview.metadata.nomeArquivo }}</div>
        <div><strong>Conta:</strong> {{ preview.metadata.conta }}</div>
        <div>
            <strong>Período:</strong>
          {{ fmtDateBR(preview.metadata.periodoInicio) }} -
          {{ fmtDateBR(preview.metadata.periodoFim) }}
        </div>
        <div><strong>Total:</strong> {{ preview.metadata.totalLinhas }}</div>
        <Tag severity="success" :value="`Novas: ${novosCount}`" />
        <Tag severity="warn" :value="`Duplicadas: ${dupCount}`" />
        <Tag severity="secondary" :value="`Selecionadas: ${selectedCount}`" />
        <Tag
          v-if="preview.metadata.jaImportadoEm"
          severity="info"
          value="Arquivo ja foi importado antes"
        />
      </div>

      <DataTable
        :value="preview.itens"
        size="small"
        scrollable
        scrollHeight="55vh"
        stripedRows
      >
        <Column header="" :style="{ width: '44px' }">
          <template #header>
            <Checkbox
              :modelValue="allSelected"
              :indeterminate="someSelected"
              binary
              @change="toggleAll"
              title="Selecionar todos"
            />
          </template>
          <template #body="{ data }">
            <Checkbox
              v-if="!data.jaExistente"
              :modelValue="selectedIds.has(data.identificador)"
              binary
              @change="toggleItem(data.identificador)"
            />
            <i
              v-else
              class="pi pi-clone"
              style="color: #ca8a04; font-size: 0.85rem"
              title="Já existe"
            />
          </template>
        </Column>
        <Column field="data" header="Data" :style="{ width: '100px' }">
          <template #body="{ data }">{{ fmtDateBR(data.data) }}</template>
        </Column>
        <Column field="tipo" header="Tipo" :style="{ width: '170px' }" />
        <Column field="detalhe" header="Detalhe" />
        <Column field="categoriaSugerida" header="Categoria" :style="{ width: '220px' }">
          <template #body="{ data }">
            <Select
              v-model="data.categoriaSugerida"
              :options="categoryOptions"
              optionLabel="label"
              optionValue="value"
              filter
              :pt="{ root: { style: 'width: 100%' } }"
            />
          </template>
        </Column>
        <Column field="valor" header="Valor" :style="{ width: '130px' }">
          <template #body="{ data }">
            <span :class="classMoney(data.valor)">{{ fmtMoneyBR(data.valor) }}</span>
          </template>
        </Column>
        <Column field="regraAplicada" header="Origem" :style="{ width: '110px' }" />
        <Column header="" :style="{ width: '60px' }">
          <template #body="{ data }">
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              aria-label="Remover"
              @click="removeItem(data.identificador)"
            />
          </template>
        </Column>
      </DataTable>
    </div>

    <div v-else-if="step === 'confirming'" style="padding: 2rem; text-align: center">
      <ProgressSpinner /> Confirmando...
    </div>

    <template #footer>
      <Button label="Cancelar" severity="secondary" @click="visibleProxy = false" />
      <Button
        v-if="step === 'preview'"
        :label="selectedCount === 0 ? 'Confirmar' : `Confirmar (${selectedCount})`"
        :disabled="selectedCount === 0"
        @click="onConfirm"
      />
    </template>
  </Dialog>
</template>
