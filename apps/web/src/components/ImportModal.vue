<script setup lang="ts">
import { ref, computed } from "vue";
import { useSnackbar } from "../composables/useSnackbar";
import { useReferenceStore } from "../stores/reference";
import {
  preview as previewImport,
  confirmImport,
  type PreviewBatchResponse,
  type ImportMetadata,
} from "../lib/api";
import { fmtMoneyBR, fmtDateBR, classMoney } from "../lib/format";
import { categoryOptionLabel } from "../lib/categories";

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "imported", stats: { totalImportadas: number; totalDuplicadas: number }): void;
}>();

const ref_ = useReferenceStore();
const snackbar = useSnackbar();

const step = ref<"upload" | "preview" | "confirming">("upload");
const loading = ref(false);
const preview = ref<PreviewBatchResponse | null>(null);
const selectedIds = ref(new Set<string>());

const visibleProxy = computed({
  get: () => props.visible,
  set: (v) => emit("update:visible", v),
});

const previewHeaders = [
  { title: "", key: "select", sortable: false, width: 48 },
  { title: "Data", key: "data", width: 100 },
  { title: "Tipo", key: "tipo", width: 170 },
  { title: "Detalhe", key: "detalhe" },
  { title: "Categoria", key: "categoriaSugerida", width: 220, sortable: false },
  { title: "Valor", key: "valor", width: 130 },
  { title: "Origem", key: "regraAplicada", width: 110 },
  { title: "", key: "actions", sortable: false, width: 60 },
];

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

function normalizeFiles(files: File | File[] | null): File[] {
  if (!files) return [];
  return Array.isArray(files) ? files.filter(Boolean) : [files];
}

async function onSelect(files: File | File[] | null) {
  const list = normalizeFiles(files);
  if (!list.length) return;
  loading.value = true;
  try {
    if (!ref_.loaded) await ref_.load();
    preview.value = await previewImport(list);
    selectedIds.value = new Set();
    step.value = "preview";
  } catch (err) {
    snackbar.add({
      severity: "error",
      summary: "Erro no preview",
      detail: (err as Error).message,
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
}

function metadataForConfirm(source: ImportMetadata): ImportMetadata {
  return {
    nomeArquivo: source.nomeArquivo,
    hashSha256: source.hashSha256,
    conta: source.conta,
    periodoInicio: source.periodoInicio,
    periodoFim: source.periodoFim,
    totalLinhas: source.totalLinhas,
    jaImportadoEm: null,
  };
}

async function onConfirm() {
  if (!preview.value) return;
  step.value = "confirming";
  try {
    const totals = { totalImportadas: 0, totalDuplicadas: 0 };

    for (const source of preview.value.sources) {
      const novos = preview.value.itens.filter(
        (i) =>
          !i.jaExistente &&
          i.sourceHashSha256 === source.hashSha256 &&
          selectedIds.value.has(i.identificador),
      );
      if (!novos.length) continue;

      const itens = novos.map((i) => {
        const categoriaId = ref_.categoryIdByCode(i.categoriaSugerida);
        if (!categoriaId) {
          throw new Error(`Categoria desconhecida: ${i.categoriaSugerida}`);
        }
        return {
          identificador: i.identificador,
          data: i.data,
          valor: i.valor,
          descricaoRaw: i.descricaoRaw,
          tipo: i.tipo,
          detalhe: i.detalhe,
          chaveNormalizada: i.chaveNormalizada,
          categoriaId,
          categoryRuleId: i.categoryRuleId,
          regraAplicada: i.regraAplicada,
        };
      });

      const result = await confirmImport({
        metadata: metadataForConfirm(source),
        itens,
      });
      totals.totalImportadas += result.totalImportadas;
      totals.totalDuplicadas += result.totalDuplicadas;
    }

    emit("imported", totals);
    visibleProxy.value = false;
    reset();
  } catch (err) {
    snackbar.add({
      severity: "error",
      summary: "Erro ao confirmar",
      detail: (err as Error).message,
      life: 4000,
    });
    step.value = "preview";
  }
}

const previewCategoryOptions = computed(() =>
  ref_.categories.map((c) => ({
    label: categoryOptionLabel(c),
    value: c.code,
  })),
);

const categoryOptions = computed(() => previewCategoryOptions.value);

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

const reimportedSources = computed(
  () => preview.value?.sources.filter((s) => s.jaImportadoEm) ?? [],
);

function toggleItem(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id);
  else selectedIds.value.add(id);
  selectedIds.value = new Set(selectedIds.value);
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
  <v-dialog
    v-model="visibleProxy"
    max-width="1200"
    width="95vw"
    @after-leave="reset"
  >
    <v-card title="Importar extrato">
      <v-card-text>
        <div v-if="step === 'upload'">
          <p>
            Selecione um ou mais arquivos CSV do Nubank (formato
            NU_&lt;conta&gt;_&lt;periodo&gt;.csv) ou um ZIP contendo vários CSVs.
          </p>
          <v-file-input
            accept=".csv,.zip,application/zip"
            label="Selecionar arquivo(s)"
            prepend-icon="mdi-file-upload"
            multiple
            show-size
            @update:model-value="onSelect"
          />
          <div v-if="loading" class="upload-loading">
            <v-progress-circular indeterminate size="24" />
            Processando...
          </div>
        </div>

        <div v-else-if="step === 'preview' && preview">
          <div class="preview-meta">
            <div><strong>Arquivos:</strong> {{ preview.sources.length }}</div>
            <div><strong>Registros:</strong> {{ preview.itens.length }}</div>
            <v-chip color="success" size="small">Novas: {{ novosCount }}</v-chip>
            <v-chip color="warning" size="small">Duplicadas: {{ dupCount }}</v-chip>
            <v-chip size="small">Selecionadas: {{ selectedCount }}</v-chip>
          </div>

          <ul v-if="preview.sources.length" class="source-list">
            <li v-for="source in preview.sources" :key="source.hashSha256">
              <strong>{{ source.nomeArquivo }}</strong>
              — conta {{ source.conta }},
              {{ fmtDateBR(source.periodoInicio) }} a {{ fmtDateBR(source.periodoFim) }}
              ({{ source.totalLinhas }} linhas)
              <v-chip
                v-if="source.jaImportadoEm"
                color="info"
                size="x-small"
                class="source-chip"
              >
                já importado
              </v-chip>
            </li>
          </ul>
          <v-alert
            v-if="reimportedSources.length"
            type="info"
            density="compact"
            variant="tonal"
            class="reimport-alert"
          >
            {{ reimportedSources.length }} arquivo(s) já foram importados antes; linhas duplicadas
            aparecem marcadas na tabela.
          </v-alert>

          <v-data-table
            class="preview-table"
            :headers="previewHeaders"
            :items="preview.itens"
            item-value="identificador"
            :items-per-page="-1"
            hide-default-footer
            height="55vh"
            fixed-header
            striped="even"
          >
            <template #header.select>
              <div class="select-cell">
                <v-checkbox-btn
                  :model-value="allSelected"
                  :indeterminate="someSelected"
                  @update:model-value="toggleAll"
                />
              </div>
            </template>
            <template #item.select="{ item }">
              <div class="select-cell">
                <v-checkbox-btn
                  v-if="!item.jaExistente"
                  :model-value="selectedIds.has(item.identificador)"
                  @update:model-value="toggleItem(item.identificador)"
                />
                <v-icon
                  v-else
                  icon="mdi-content-copy"
                  color="warning"
                  size="20"
                  title="Já existe"
                />
              </div>
            </template>
            <template #item.data="{ item }">{{ fmtDateBR(item.data) }}</template>
            <template #item.categoriaSugerida="{ item }">
              <v-autocomplete
                v-model="item.categoriaSugerida"
                :items="categoryOptions"
                item-title="label"
                item-value="value"
                density="compact"
                hide-details
              />
            </template>
            <template #item.valor="{ item }">
              <span :class="classMoney(item.valor)">{{ fmtMoneyBR(item.valor) }}</span>
            </template>
            <template #item.actions="{ item }">
              <v-btn
                icon="mdi-delete"
                variant="text"
                color="error"
                size="small"
                aria-label="Remover"
                @click="removeItem(item.identificador)"
              />
            </template>
          </v-data-table>
        </div>

        <div v-else-if="step === 'confirming'" class="confirming">
          <v-progress-circular indeterminate />
          Confirmando...
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="visibleProxy = false">Cancelar</v-btn>
        <v-btn
          v-if="step === 'preview'"
          color="primary"
          :disabled="selectedCount === 0"
          @click="onConfirm"
        >
          {{ selectedCount === 0 ? "Confirmar" : `Confirmar (${selectedCount})` }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.upload-loading,
.confirming {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.preview-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
  align-items: center;
}

.source-list {
  margin: 0 0 0.75rem;
  padding-left: 1.1rem;
  font-size: 0.85rem;
  opacity: 0.9;
}

.source-list li + li {
  margin-top: 0.25rem;
}

.source-chip {
  margin-left: 0.35rem;
  vertical-align: middle;
}

.reimport-alert {
  margin-bottom: 0.75rem;
}

.select-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
}

.preview-table :deep(th:first-child),
.preview-table :deep(td:first-child) {
  width: 48px;
  min-width: 48px;
  max-width: 48px;
  padding-left: 8px;
  padding-right: 8px;
  text-align: center;
}

.preview-table :deep(th:first-child .select-cell),
.preview-table :deep(td:first-child .select-cell) {
  margin: 0 auto;
}
</style>
