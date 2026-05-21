# Diart — PDF-Angebot zu Excel

Desktop-Tool zum Extrahieren von Artikelpositionen aus Angebots-/Rechnungs-PDFs und Export als Excel im Format `Vorlagen/Materialliste mit VK Preis.xlsx` (inkl. Aufschlag und VK-Formeln).

## Python-Extractor (CLI)

```bash
cd extractor
pip install -r requirements.txt
python -m pytest -v
python main.py --input "../Vorlagen/KAN_1060020 EK Preis IFB.pdf" --output "./tests/_out/angebot.xlsx" --aufschlag 0.2
```

**Parameter:**

- `--input` — PDF-Pfad
- `--output` — Ziel-`.xlsx`
- `--aufschlag` — Dezimalfaktor (z. B. `0.2` = +20 %)

**Unterstützte Layouts:** `kan_ifb`, `norit_rechnung`, `rk_stark`, `laier_van` (PDFs in `Vorlagen/`)

## Desktop (Tauri + Vue)

**Voraussetzungen:** [Rust](https://www.rust-lang.org/learn/get-started), Node.js 20+, WebView2 (Windows).

```bash
# Sidecar (optional für Release; Dev nutzt Python automatisch)
cd extractor
.\build_sidecar.ps1

cd ../desktop
npm install
npm run tauri dev
```

Release:

```bash
cd desktop
npm run tauri build
```

Plan: `docs/superpowers/plans/2026-05-21-pdf-angebot-zu-excel.md`
