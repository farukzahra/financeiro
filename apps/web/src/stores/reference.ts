import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  listCategories,
  listRules,
  listTipos,
  type Category,
  type CategoryRule,
} from "../lib/api";

export const useReferenceStore = defineStore("reference", () => {
  const categories = ref<Category[]>([]);
  const rules = ref<CategoryRule[]>([]);
  const tipos = ref<string[]>([]);
  const loaded = ref(false);

  async function load() {
    const [c, r, t] = await Promise.all([listCategories(), listRules(), listTipos()]);
    categories.value = c;
    rules.value = r;
    tipos.value = t;
    loaded.value = true;
  }

  async function reloadRules() {
    rules.value = await listRules();
  }

  async function reloadCategories() {
    categories.value = await listCategories();
  }

  async function reloadTipos() {
    tipos.value = await listTipos();
  }

  const categoryOptions = computed(() =>
    categories.value.map((c) => ({ label: `${c.letra} - ${c.id}`, value: c.id })),
  );

  return {
    categories,
    rules,
    tipos,
    loaded,
    load,
    reloadRules,
    reloadCategories,
    reloadTipos,
    categoryOptions,
  };
});
