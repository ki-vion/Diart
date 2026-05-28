<script setup lang="ts">
import { ref } from "vue";
import { pickAndConvert, type ConvertResponse, type PreviewRow } from "./lib/convert";

const aufschlagPercent = ref(20);
const loading = ref(false);
const result = ref<ConvertResponse | null>(null);
const error = ref("");

const previewColumns = [
  "Position",
  "Artikel",
  "Menge",
  "Einheit",
  "Einzelpreis PDF (€)",
  "Aufschlag",
  "Einzelpreis (€)",
  "Gesamt (€)",
] as const;

async function convert() {
  loading.value = true;
  error.value = "";
  result.value = null;
  try {
    const res = await pickAndConvert(aufschlagPercent.value);
    if (!res) {
      return;
    }
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

function cell(row: PreviewRow, col: (typeof previewColumns)[number]) {
  const v = row[col as keyof PreviewRow];
  if (v === null || v === undefined) return "";
  return String(v);
}
</script>

<template>
  <main class="app">
    <header>
      <h1>Diart — PDF zu Excel</h1>
      <p class="subtitle">
        Angebote/Rechnungen extrahieren · Format „Materialliste mit VK Preis“
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
      <button type="button" class="primary" :disabled="loading" @click="convert">
        {{ loading ? "Wird konvertiert…" : "PDF auswählen & konvertieren" }}
      </button>
    </section>

    <p v-if="error" class="error">{{ error }}</p>

    <section v-if="result?.ok" class="card success">
      <p>{{ result.message }}</p>
      <p v-if="result.layout_id"><strong>Layout:</strong> {{ result.layout_id }}</p>
      <p v-if="result.outputFileName"><strong>Datei:</strong> {{ result.outputFileName }}</p>
    </section>

    <section v-if="result?.preview?.length" class="card">
      <h2>Vorschau (erste Zeilen)</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th v-for="col in previewColumns" :key="col">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in result.preview" :key="idx">
              <td v-for="col in previewColumns" :key="col">{{ cell(row, col) }}</td>
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
</style>
