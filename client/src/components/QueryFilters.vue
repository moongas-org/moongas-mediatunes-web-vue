<script setup lang="ts">
import { computed, ref, type Directive } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'
import { queryList } from '../utils/queryParams'
import type { FilterField, FilterOption } from '../types'

interface Pending {
  id: number
  key: string
}

const props = defineProps<{ fields: FilterField[] }>()

const route = useRoute()
const router = useRouter()

const vFocus: Directive<HTMLInputElement | HTMLSelectElement> = { mounted: (el) => el.focus() }

/** One chip per value present in the URL for each supported field. */
const active = computed(() =>
  props.fields.flatMap((field) => {
    const values = queryList(route.query, field.key)
    return (field.multi ? values : values.slice(0, 1)).map((value, index) => ({
      field,
      index,
      value,
    }))
  }),
)

/** Filters added via the UI that don't have a value yet (not in the URL). */
const pending = ref<Pending[]>([])
let nextPendingId = 0

const fieldByKey = computed(() => new Map(props.fields.map((f) => [f.key, f])))

const addable = computed(() =>
  props.fields.filter(
    (f) =>
      f.multi ||
      (queryList(route.query, f.key).length === 0 && !pending.value.some((p) => p.key === f.key)),
  ),
)

const addKey = ref('')

function setValues(key: string, values: string[]): void {
  const query: LocationQuery = { ...route.query }
  if (values.length === 0) delete query[key]
  else query[key] = fieldByKey.value.get(key)?.multi ? values : values[0]
  router.push({ query })
}

function updateValue(key: string, index: number, value: string): void {
  const values = queryList(route.query, key)
  const trimmed = value.trim()
  if (trimmed) values[index] = trimmed
  else values.splice(index, 1)
  setValues(key, values)
}

function removeValue(key: string, index: number): void {
  const values = queryList(route.query, key)
  values.splice(index, 1)
  setValues(key, values)
}

function addPending(): void {
  if (!addKey.value) return
  pending.value.push({ id: nextPendingId++, key: addKey.value })
  addKey.value = ''
}

function removePending(id: number): void {
  pending.value = pending.value.filter((p) => p.id !== id)
}

function commitPending(p: Pending, value: string): void {
  const trimmed = value.trim()
  removePending(p.id)
  if (!trimmed) return
  const field = fieldByKey.value.get(p.key)
  const values = field?.multi ? queryList(route.query, p.key) : []
  setValues(p.key, [...values, trimmed])
}

function inputValue(e: Event): string {
  return (e.target as HTMLInputElement | HTMLSelectElement).value
}

function optionsOf(field: FilterField | undefined): FilterOption[] {
  return (field?.options ?? []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
}

/** Options for a select, keeping a URL value that isn't in the known list. */
function optionsWith(field: FilterField, value: string): FilterOption[] {
  const options = optionsOf(field)
  return value && !options.some((o) => o.value === value)
    ? [{ value, label: value }, ...options]
    : options
}
</script>

<template>
  <div class="query-filters">
    <span
      v-for="chip in active"
      :key="`${chip.field.key}-${chip.index}`"
      class="query-filter"
    >
      <label>
        {{ chip.field.label }}
        <select
          v-if="chip.field.options"
          :value="chip.value"
          @change="updateValue(chip.field.key, chip.index, inputValue($event))"
        >
          <option
            v-for="opt in optionsWith(chip.field, chip.value)"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
        <input
          v-else
          :type="chip.field.type ?? 'text'"
          :value="chip.value"
          @change="updateValue(chip.field.key, chip.index, inputValue($event))"
        />
      </label>
      <button
        type="button"
        class="query-filter-close"
        :title="`Remove ${chip.field.label} filter`"
        @click="removeValue(chip.field.key, chip.index)"
      >
        ×
      </button>
    </span>

    <span v-for="p in pending" :key="`pending-${p.id}`" class="query-filter">
      <label>
        {{ fieldByKey.get(p.key)?.label }}
        <select
          v-if="fieldByKey.get(p.key)?.options"
          v-focus
          value=""
          @change="commitPending(p, inputValue($event))"
          @keydown.esc="removePending(p.id)"
        >
          <option value="" disabled>choose…</option>
          <option v-for="opt in optionsOf(fieldByKey.get(p.key))" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <input
          v-else
          v-focus
          :type="fieldByKey.get(p.key)?.type ?? 'text'"
          @change="commitPending(p, inputValue($event))"
          @keydown.esc="removePending(p.id)"
        />
      </label>
      <button
        type="button"
        class="query-filter-close"
        title="Remove filter"
        @click="removePending(p.id)"
      >
        ×
      </button>
    </span>

    <select v-if="addable.length" v-model="addKey" class="query-filter-add" @change="addPending">
      <option value="" disabled>+ add filter</option>
      <option v-for="f in addable" :key="f.key" :value="f.key">{{ f.label }}</option>
    </select>
  </div>
</template>

<style scoped>
.query-filters {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin: 8px 0;
}

.query-filter {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px 3px 10px;
  border: 1px solid #666;
  border-radius: 8px;
  background-color: #333;
  color: white;
}

.query-filter input {
  width: 9em;
  margin-left: 4px;
}

.query-filter input[type='number'] {
  width: 5em;
}

.query-filter-close {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 1.2em;
  line-height: 1;
  cursor: pointer;
  padding: 0 6px;
}

.query-filter-close:hover {
  color: #ff8080;
}
</style>
