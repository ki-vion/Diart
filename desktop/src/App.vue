<script setup lang="ts">
import { computed, ref } from "vue";
import {
  convertPdfFile,
  type ConvertResponse,
  type PreviewRow,
} from "./lib/convert";
import { downloadBlob } from "./lib/download";
import { formatEuroDe, formatQuantityDe } from "./export/format-money";

const aufschlagPercent = ref(20);
const loading = ref(false);
const result = ref<ConvertResponse | null>(null);
const error = ref("");
const pdfInput = ref<HTMLInputElement | null>(null);

const previewColumns = [
  "Artikel",
  "Menge",
  "Einheit",
  "Einzelpreis (€)",
  "Gesamt (€)",
  "Einzelpreis PDF (€)",
  "Aufschlag",
] as const;

type PreviewSpacer = { kind: "spacer" };
type PreviewTableEntry = PreviewRow | PreviewSpacer;

const previewTableEntries = computed((): PreviewTableEntry[] => {
  const preview = result.value?.preview;
  if (!preview?.length) return [];
  const out: PreviewTableEntry[] = [];
  for (let i = 0; i < preview.length; i++) {
    out.push(preview[i]!);
    if (i < preview.length - 1) out.push({ kind: "spacer" });
  }
  return out;
});

const MONEY_COLUMNS = new Set<(typeof previewColumns)[number]>([
  "Einzelpreis (€)",
  "Gesamt (€)",
  "Einzelpreis PDF (€)",
]);

function openFilePicker() {
  pdfInput.value?.click();
}

async function onPdfSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.item(0);
  input.value = "";
  if (!file) return;

  loading.value = true;
  error.value = "";
  result.value = null;
  try {
    const res = await convertPdfFile(file, aufschlagPercent.value);
    result.value = res;
    if (!res.ok) {
      error.value = res.error ?? "Konvertierung fehlgeschlagen";
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function download() {
  const blob = result.value?.xlsxBlob;
  const name = result.value?.outputFileName;
  if (!blob || !name) return;
  downloadBlob(blob, name);
}

function cell(row: PreviewRow, col: (typeof previewColumns)[number]) {
  const v = row[col as keyof PreviewRow];
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && MONEY_COLUMNS.has(col)) {
    return formatEuroDe(v);
  }
  if (typeof v === "number" && col === "Menge") {
    return formatQuantityDe(v);
  }
  return String(v);
}
</script>

<template>
  <main class="app">
    <header>
      <h1>Diart — PDF zu Excel</h1>
      <p class="subtitle">
        Extrahiert Materialtabellen aus PDFs und exportiert als Excel
      </p>
    </header>

    <section class="card controls">
      <label class="aufschlag">
        Aufschlag (%)
        <input
          v-model.number="aufschlagPercent"
          type="number"
          min="0"
          step="1"
          :disabled="loading"
        />
      </label>
      <p class="hint">
        VK-Einzelpreis = PDF-Preis × (1 + Aufschlag/100). Standard: 20 %.
      </p>
      <div class="convert-row">
        <input
          ref="pdfInput"
          type="file"
          accept="application/pdf,.pdf"
          class="file-input"
          :disabled="loading"
          @change="onPdfSelected"
        />
        <button type="button" class="primary" :disabled="loading" @click="openFilePicker">
          {{ loading ? "Wird konvertiert…" : "PDF auswählen & konvertieren" }}
        </button>
      </div>
    </section>

    <p v-if="error" class="error">{{ error }}</p>

    <section v-if="result?.ok" class="card success">
      <p>{{ result.message }}</p>
      <p v-if="result.layout_id"><strong>Layout:</strong> {{ result.layout_id }}</p>
      <p v-if="result.outputFileName"><strong>Datei:</strong> {{ result.outputFileName }}</p>
      <button
        v-if="result.xlsxBlob && result.outputFileName"
        type="button"
        class="primary"
        @click="download"
      >
        Excel herunterladen
      </button>
    </section>

    <section v-if="result?.preview?.length" class="card">
      <h2>Vorschau</h2>
      <dl v-if="result.previewTotals" class="preview-totals">
        <div class="preview-totals-row">
          <dt>Gesamt Netto</dt>
          <dd>{{ formatEuroDe(result.previewTotals.netto) }} €</dd>
        </div>
        <div class="preview-totals-row">
          <dt>MwSt. 19 %</dt>
          <dd>{{ formatEuroDe(result.previewTotals.mwst) }} €</dd>
        </div>
        <div class="preview-totals-row preview-totals-row--brutto">
          <dt>Gesamt Brutto</dt>
          <dd>{{ formatEuroDe(result.previewTotals.brutto) }} €</dd>
        </div>
      </dl>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th v-for="col in previewColumns" :key="col">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(entry, idx) in previewTableEntries"
              :key="idx"
              :class="{ 'preview-spacer-row': 'kind' in entry }"
            >
              <template v-if="'kind' in entry">
                <td :colspan="previewColumns.length" class="preview-spacer-cell" />
              </template>
              <template v-else>
                <td
                  v-for="col in previewColumns"
                  :key="col"
                  :class="{ 'cell-multiline': col === 'Artikel' }"
                >
                  {{ cell(entry, col) }}
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped>
.app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  font-family: Inter, system-ui, sans-serif;
  color: #1a1a1a;
}

header h1 {
  margin: 0 0 0.25rem;
  font-size: 1.75rem;
}

.subtitle {
  margin: 0 0 1.5rem;
  color: #555;
}

.card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.aufschlag {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
}

.aufschlag input {
  max-width: 120px;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 8px;
}

.hint {
  margin: 0;
  font-size: 0.9rem;
  color: #666;
}

.convert-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.primary {
  align-self: flex-start;
  padding: 0.65rem 1.25rem;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.primary:disabled {
  opacity: 0.6;
  cursor: wait;
}

.error {
  color: #b91c1c;
  font-weight: 500;
}

.success p {
  margin: 0.35rem 0;
}

.preview-totals {
  display: grid;
  gap: 0.35rem;
  max-width: 20rem;
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.preview-totals-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  margin: 0;
}

.preview-totals-row dt {
  margin: 0;
  font-weight: 500;
  color: #444;
}

.preview-totals-row dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.preview-totals-row--brutto dd {
  color: #1d4ed8;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

th,
td {
  border: 1px solid #e5e5e5;
  padding: 0.4rem 0.5rem;
  text-align: left;
}

th {
  background: #f5f5f5;
}

td.cell-multiline {
  white-space: pre-line;
  vertical-align: top;
  min-width: 14rem;
}

.preview-spacer-row .preview-spacer-cell {
  height: 0.75rem;
  padding: 0;
  border-left: none;
  border-right: none;
  background: transparent;
}
</style>
