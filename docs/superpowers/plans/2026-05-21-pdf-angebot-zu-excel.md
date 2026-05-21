# PDF-Angebot → Excel (Diart) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows-Desktop-App (`.exe`) zum Laden von Angebots-/Rechnungs-PDFs, Erkennung eines von bis zu 6 festen Layouts, Extraktion der Artikeltabellen per PyMuPDF und Export als `.xlsx` im Format von `Vorlagen/Materialliste mit VK Preis.xlsx` — inkl. Aufschlag und berechnetem VK-Einzelpreis — mit Vue-Oberfläche und Python-Sidecar über Tauri.

**Architecture:** Zwei getrennte Schichten: (1) Python-Paket `extractor` mit Strategy-Pattern und CLI (`argparse` → JSON auf stdout), layout-spezifische Koordinaten-/Zeilenparser pro Vorlage; Excel-Export via **openpyxl** mit festem Spaltenlayout und **Excel-Formeln** (nicht nur pandas-Dump). (2) Tauri+Vue ruft das Sidecar auf, übergibt einen **Aufschlag** (z. B. 20 % → `0.2`), zeigt Dialog/Drag-Drop und Ergebnis. Tests: PDFs aus `Vorlagen/` + Spalten-/Formel-Test gegen die Referenz-Excel.

**Tech Stack:** Python 3.11+ (3.13 ok), PyMuPDF (`fitz`), pandas, openpyxl, pytest; PyInstaller; Tauri 2, Vue 3, TypeScript, Rust toolchain; Node.js 20+.

---

## Ausgangslage (Vorlagen-Analyse)

Im Ordner `Vorlagen/` liegen **4** PDFs (nicht 6). Für die Planung sind **4 konkrete Strategien** spezifiziert; **2 Platzhalter-Strategien** (`layout_5`, `layout_6`) bleiben als Stub, bis weitere Muster-PDFs geliefert werden.

| Layout-ID | Erkennungsmerkmal (Seite 1) | Spalten / Besonderheit |
|-----------|----------------------------|-------------------------|
| `kan_ifb` | `ANGEBOT` + `Beleg` + `KAN` | Pos., Bezeichnung (mehrzeilig), Menge, ME, E.-Preis, Betrag |
| `norit_rechnung` | `Rechnungsnummer:` + `Einzelpreis` + `Nettowert` | Pos, Artikel (Block über mehrere Zeilen), Menge, Einzelpreis, Nettowert |
| `rk_stark` | `STARK Deutschland` / `Raab Karcher` + `ANGEBOT` | Tabelle unten auf Seite: POS., ARTIKEL-NR., MENGE, ME, EINZEL-PREIS, POS.-WERT (feste X-Koordinaten) |
| `laier_van` | `Rudolf Laier` oder `VAN` + `VK-Preis` | Artikelnr. eigene Zeile, Beschreibung + Menge + Einheit + VK-Preis + Betrag |

**Wichtig:** `Norit Rechnung.pdf` ist eine **Rechnung**, kein Angebot — trotzdem gleiche Tabellenlogik, eigene Strategie.

### Referenz-Output: `Materialliste mit VK Preis.xlsx`

Golden-Datei: `Vorlagen/Materialliste mit VK Preis.xlsx` (Sheet `Materialliste`).

**Ziel-Spalten (Reihenfolge exakt wie Vorlage):**

| Spalte | Inhalt | Quelle / Berechnung |
|--------|--------|---------------------|
| A `Position` | Pos. aus PDF | Extraktion (`001` → `1` oder `001`, konsistent halten) |
| B `Artikel` | Artikelbezeichnung | PDF: Beschreibung (+ optional Artikelnr. voranstellen: `"0206050001 weber.prim 400 Tiefgrund"`) |
| C `Menge` | Menge | PDF |
| D `Einheit` | Mengeneinheit (ME) | PDF |
| E `Einzelpreis (€)` | **Einzelpreis mit Aufschlag** | Excel-Formel: `=H{row}*(1+I{row})` |
| F `Gesamt (€)` | Zeilensumme VK | Excel-Formel: `=E{row}*C{row}` (wenn Menge fehlt: leer oder `0`) |
| G | *(leer)* | wie Vorlage |
| H `Einzelpreis PDF (€)` | Einzelpreis aus Angebot/Rechnung | PDF (`E.-Preis`, `VK-Preis`, `Einzelpreis`, …) |
| I `Aufschlag` | Aufschlagsfaktor | Parameter (z. B. `0.2` = **+20 %**), pro Zeile gleicher Wert |

**Aufschlag-Logik (wie in der Vorlage):**

- `Aufschlag` ist ein **Dezimalfaktor**, nicht Prozentpunkte: `0.2` bedeutet +20 %.
- `Einzelpreis mit Aufschlag` = `Einzelpreis PDF × (1 + Aufschlag)`.
- `Gesamt` = `Menge × Einzelpreis mit Aufschlag` (Vorlage nutzt Formeln in E/F; PDF-`Betrag` dient zur Plausibilitätsprüfung, nicht als primäre Gesamt-Spalte).

**PDF-Feld → Export-Mapping (einheitlich über alle Layouts):**

| PDF (typisch) | Intern (`LineItem`) | Excel-Spalte |
|---------------|---------------------|--------------|
| Pos. | `position` | A |
| Artikel / Bezeichnung | `description` (+ `article_number`) | B |
| Menge | `quantity` | C |
| ME / Einheit | `unit` | D |
| E.-Preis / Einzelpreis / VK-Preis | `unit_price` | H |
| Betrag / Nettowert / Pos.-Wert | `line_total` | *(nur Validierung, nicht eigene Spalte)* |

**Standard-Aufschlag:** `0.2` (20 %), wie in der Referenz-Excel. In der Desktop-App als Prozentfeld (Default `20`), intern `aufschlag = prozent / 100`.

---

## Ziel-Verzeichnisstruktur

```
Diart/
├── Vorlagen/                          # PDF-Referenzen + Excel-Zielbild
│   ├── Materialliste mit VK Preis.xlsx  # Golden Output
│   └── *.pdf
├── extractor/                         # Python-Kern (CLI + Tests)
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── main.py
│   ├── extractor/
│   │   ├── __init__.py
│   │   ├── cli.py
│   │   ├── models.py
│   │   ├── detector.py
│   │   ├── pipeline.py
│   │   ├── export/
│   │   │   └── excel_writer.py
│   │   └── strategies/
│   │       ├── __init__.py
│   │       ├── base.py
│   │       ├── kan_ifb.py
│   │       ├── norit_rechnung.py
│   │       ├── rk_stark.py
│   │       ├── laier_van.py
│   └── tests/
│       ├── conftest.py
│       ├── test_detector.py
│       ├── test_kan_ifb.py
│       ├── test_norit_rechnung.py
│       ├── test_rk_stark.py
│       ├── test_laier_van.py
│       ├── test_cli.py
│       └── test_excel_export.py
├── desktop/                           # Tauri + Vue
│   ├── package.json
│   ├── src/
│   │   ├── App.vue
│   │   ├── main.ts
│   │   └── lib/
│   │       └── convert.ts
│   └── src-tauri/
│       ├── Cargo.toml
│       ├── tauri.conf.json
│       ├── src/
│       │   ├── main.rs
│       │   └── commands/
│       │       └── convert.rs
│       └── binaries/                  # PyInstaller-Output (gitignored)
│           └── extractor-sidecar-x86_64-pc-windows-msvc.exe
└── docs/superpowers/plans/
    └── 2026-05-21-pdf-angebot-zu-excel.md
```

---

### Task 1: Python-Projektgerüst und Datenmodelle

**Files:**
- Create: `extractor/pyproject.toml`
- Create: `extractor/requirements.txt`
- Create: `extractor/extractor/models.py`
- Create: `extractor/extractor/__init__.py`
- Test: `extractor/tests/test_models.py`

- [ ] **Step 1: Write the failing test**

```python
# extractor/tests/test_models.py
from extractor.models import LineItem, ExtractionResult, ExportOptions

def test_line_item_fields():
    item = LineItem(
        position="001",
        article_number="0206050001",
        description="weber.prim 400 Tiefgrund",
        quantity=80.0,
        unit="l",
        unit_price=2.76,
        line_total=220.80,
    )
    assert item.position == "001"
    assert item.line_total == 220.80

def test_artikel_label_merges_number():
    item = LineItem(
        position="1", article_number="0206050001",
        description="Tiefgrund", quantity=1.0, unit="l",
        unit_price=1.61, line_total=1.61,
    )
    assert item.artikel_label() == "0206050001 Tiefgrund"

def test_export_options_default_aufschlag():
    opts = ExportOptions()
    assert opts.aufschlag == 0.2
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd c:\Users\Felix\Kivion_github\Diart\extractor
python -m pytest tests/test_models.py -v
```
Expected: FAIL — `ModuleNotFoundError: extractor`

- [ ] **Step 3: Write minimal implementation**

`extractor/pyproject.toml`:
```toml
[project]
name = "diart-extractor"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
  "pymupdf>=1.24",
  "pandas>=2.2",
  "openpyxl>=3.1",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

`extractor/requirements.txt`:
```
pymupdf>=1.24
pandas>=2.2
openpyxl>=3.1
pytest>=8.0
```

`extractor/extractor/models.py`:
```python
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any


@dataclass
class LineItem:
    position: str | None
    article_number: str | None
    description: str
    quantity: float | None
    unit: str | None
    unit_price: float | None  # Einzelpreis aus PDF (EK/VK laut Angebot)
    line_total: float | None  # Betrag aus PDF — nur Validierung

    def artikel_label(self) -> str:
        parts = [p for p in (self.article_number, self.description) if p]
        return " ".join(parts)


@dataclass
class ExportOptions:
    aufschlag: float = 0.2  # 0.2 = +20 %


@dataclass
class ExtractionResult:
    layout_id: str
    source_pdf: str
    items: list[LineItem]
```

`extractor/extractor/__init__.py`: leer lassen.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_models.py -v`  
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add extractor/
git commit -m "feat(extractor): add data models for line items"
```

---

### Task 2: Strategy-Basis und Layout-Detektor

**Files:**
- Create: `extractor/extractor/strategies/base.py`
- Create: `extractor/extractor/detector.py`
- Test: `extractor/tests/test_detector.py`

- [ ] **Step 1: Write the failing test**

```python
# extractor/tests/test_detector.py
from pathlib import Path
import pytest
from extractor.detector import detect_layout

VORLAGEN = Path(__file__).resolve().parents[2] / "Vorlagen"

@pytest.mark.parametrize("pdf_name,expected", [
    ("KAN_1060020 EK Preis IFB.pdf", "kan_ifb"),
    ("Norit Rechnung.pdf", "norit_rechnung"),
    ("RK - Fermacell.pdf", "rk_stark"),
    ("Verkauf - Angebot_VAN029183.pdf", "laier_van"),
])
def test_detect_layout_from_vorlagen(pdf_name, expected):
    path = VORLAGEN / pdf_name
    assert path.exists(), f"Missing fixture: {path}"
    assert detect_layout(path) == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_detector.py -v`  
Expected: FAIL — `detect_layout` not defined

- [ ] **Step 3: Write minimal implementation**

`extractor/extractor/strategies/base.py`:
```python
from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
import fitz

from extractor.models import ExtractionResult


class BaseStrategy(ABC):
    layout_id: str

    @abstractmethod
    def matches(self, doc: fitz.Document) -> bool:
        ...

    @abstractmethod
    def extract(self, doc: fitz.Document, source_pdf: str) -> ExtractionResult:
        ...
```

`extractor/extractor/detector.py`:
```python
from __future__ import annotations

from pathlib import Path
import fitz

from extractor.strategies.kan_ifb import KanIfbStrategy
from extractor.strategies.norit_rechnung import NoritRechnungStrategy
from extractor.strategies.rk_stark import RkStarkStrategy
from extractor.strategies.laier_van import LaierVanStrategy

STRATEGIES = [
    KanIfbStrategy(),
    NoritRechnungStrategy(),
    RkStarkStrategy(),
    LaierVanStrategy(),
]


def detect_layout(pdf_path: Path) -> str:
    doc = fitz.open(pdf_path)
    try:
        for strategy in STRATEGIES:
            if strategy.matches(doc):
                return strategy.layout_id
        raise ValueError(f"Unbekanntes PDF-Layout: {pdf_path.name}")
    finally:
        doc.close()
```

Erstelle zunächst **Stub-Strategien** (nur `matches`, `extract` wirft `NotImplementedError`), damit der Detektor-Test grün wird — vollständige `extract` kommt in Tasks 3–6.

Stub-Beispiel `extractor/extractor/strategies/kan_ifb.py`:
```python
import fitz
from extractor.strategies.base import BaseStrategy
from extractor.models import ExtractionResult

class KanIfbStrategy(BaseStrategy):
    layout_id = "kan_ifb"

    def matches(self, doc: fitz.Document) -> bool:
        t = doc[0].get_text()
        return "ANGEBOT" in t and "Beleg" in t and "KAN" in t

    def extract(self, doc: fitz.Document, source_pdf: str) -> ExtractionResult:
        raise NotImplementedError
```

Analog:
- `norit_rechnung.py`: `"Rechnungsnummer:" in t and "Einzelpreis" in t`
- `rk_stark.py`: `"STARK Deutschland" in t or "Raab Karcher" in t`
- `laier_van.py`: `"VK-Preis" in t and ("Rudolf Laier" in t or "VAN" in t)`

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_detector.py -v`  
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add extractor/extractor/detector.py extractor/extractor/strategies/
git commit -m "feat(extractor): add layout detector and strategy stubs"
```

---

### Task 3: Strategie `kan_ifb` (IFB-Angebot)

**Files:**
- Modify: `extractor/extractor/strategies/kan_ifb.py`
- Test: `extractor/tests/test_kan_ifb.py`

**Parser-Logik:** Auf jeder Seite nach Header-Zeile `Pos. | Bezeichnung | Menge` suchen (y ≈ 402). Datenzeilen: Zeile beginnt mit `^\d{3}\s` → Pos + Artikelnummer-Zeile; folgende Zeilen ohne Pos sind Beschreibung bis zur nächsten Pos-Zeile.

- [ ] **Step 1: Write the failing test**

```python
# extractor/tests/test_kan_ifb.py
from pathlib import Path
from extractor.pipeline import run_extraction

VORLAGEN = Path(__file__).resolve().parents[2] / "Vorlagen"
PDF = VORLAGEN / "KAN_1060020 EK Preis IFB.pdf"

def test_kan_ifb_extracts_positions_and_totals():
    result = run_extraction(PDF)
    assert result.layout_id == "kan_ifb"
    assert len(result.items) >= 4
    first = result.items[0]
    assert first.position == "001"
    assert first.article_number == "0206050001"
    assert first.quantity == 80.0
    assert first.unit == "l"
    assert first.line_total == 220.80
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_kan_ifb.py -v`  
Expected: FAIL — `run_extraction` missing or `NotImplementedError`

- [ ] **Step 3: Write minimal implementation**

`extractor/extractor/pipeline.py` (neu):
```python
from pathlib import Path
import fitz
from extractor.detector import STRATEGIES
from extractor.models import ExtractionResult

def run_extraction(pdf_path: Path) -> ExtractionResult:
    doc = fitz.open(pdf_path)
    try:
        for strategy in STRATEGIES:
            if strategy.matches(doc):
                return strategy.extract(doc, str(pdf_path))
        raise ValueError(f"Unbekanntes Layout: {pdf_path}")
    finally:
        doc.close()
```

`kan_ifb.py` — Kernfunktion (vereinfacht, vollständig in Datei übernehmen):

```python
import re
import fitz
from extractor.strategies.base import BaseStrategy
from extractor.models import ExtractionResult, LineItem

_POS_LINE = re.compile(
    r"^(?P<pos>\d{3})\s+Artikelnummer:\s+(?P<art>\S+)\s+"
    r"(?P<qty>[\d.,]+)\s+(?P<unit>\S+)\s+(?P<price>[\d.,]+)\s+(?P<total>[\d.,]+)\s*$"
)

def _parse_de_number(s: str) -> float:
    return float(s.replace(".", "").replace(",", "."))

class KanIfbStrategy(BaseStrategy):
    layout_id = "kan_ifb"

    def matches(self, doc: fitz.Document) -> bool:
        t = doc[0].get_text()
        return "ANGEBOT" in t and "Beleg" in t and "KAN" in t

    def extract(self, doc: fitz.Document, source_pdf: str) -> ExtractionResult:
        items: list[LineItem] = []
        for page in doc:
            for raw in page.get_text().splitlines():
                m = _POS_LINE.match(raw.strip())
                if not m:
                    continue
                items.append(LineItem(
                    position=m.group("pos"),
                    article_number=m.group("art"),
                    description="",
                    quantity=_parse_de_number(m.group("qty")),
                    unit=m.group("unit"),
                    unit_price=_parse_de_number(m.group("price")),
                    line_total=_parse_de_number(m.group("total")),
                ))
        # Beschreibungszeilen: nächster Task-Verfeinerung — hier mind. 1 Zeile mit Text aus Folgezeilen mergen
        return ExtractionResult(layout_id=self.layout_id, source_pdf=source_pdf, items=items)
```

**Nach dem ersten grünen Test:** Beschreibungs-Merge ergänzen (Zeilen zwischen Pos-Zeilen an `description` anhängen). Test erweitern:

```python
assert "Tiefgrund" in result.items[0].description or "weber" in result.items[0].description
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_kan_ifb.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extractor/extractor/strategies/kan_ifb.py extractor/extractor/pipeline.py extractor/tests/test_kan_ifb.py
git commit -m "feat(extractor): implement KAN IFB layout strategy"
```

---

### Task 4: Strategie `laier_van` (Rudolf Laier)

**Files:**
- Modify: `extractor/extractor/strategies/laier_van.py`
- Test: `extractor/tests/test_laier_van.py`

**Parser-Logik:** Header `Artikel | Menge | Einheit | VK-Preis | Betrag`. Artikelnummer = 8-stellige Zeile (`^\d{8}$`); darunter Beschreibungszeile mit Mengen/Preisen am Zeilenende.

- [ ] **Step 1: Write the failing test**

```python
from pathlib import Path
from extractor.pipeline import run_extraction

PDF = Path(__file__).resolve().parents[2] / "Vorlagen" / "Verkauf - Angebot_VAN029183.pdf"

def test_laier_van_first_article():
    result = run_extraction(PDF)
    assert result.layout_id == "laier_van"
    nums = [i.article_number for i in result.items if i.article_number]
    assert "33011303" in nums
    row = next(i for i in result.items if i.article_number == "33011303")
    assert row.quantity == 57.0
    assert row.unit and "Sack" in row.unit
    assert row.line_total == 675.45
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement `laier_van.py`**

Hilfsregex für Datenzeile:
```python
_DATA = re.compile(
    r"^(?P<desc>.+?)\s+(?P<qty>[\d.,]+)\s+(?P<unit>\S+)\s+(?P<price>[\d.,]+)\s+(?P<total>[\d.,]+)\s*$"
)
_ARTNR = re.compile(r"^\d{8}$")
```

Algorithmus pro Seite: Zeilen iterieren; bei Artikelnummer → `current_art`; bei `_DATA.match` und `current_art` → `LineItem` erzeugen.

- [ ] **Step 4: pytest PASS**

- [ ] **Step 5: Commit** — `feat(extractor): implement Laier VAN layout strategy`

---

### Task 5: Strategie `rk_stark` (Raab Karcher / STARK)

**Files:**
- Modify: `extractor/extractor/strategies/rk_stark.py`
- Test: `extractor/tests/test_rk_stark.py`

**Koordinaten (aus Vorlage, A4):**

| Spalte | x0 (ca.) |
|--------|----------|
| POS | 42 |
| ARTIKEL-NR | 77 |
| MENGE | 306 |
| ME | 323 |
| EINZEL-PREIS | 397 |
| POS-WERT | 519 |

**Parser:** `page.get_text("words")`, nur Wörter mit `y` zwischen Tabellenkopf (≈649) und Footer (≈760). Zeilen nach `y` gruppieren (`round(y,0)`). Zeile mit Muster `^\d{5}\s` an x≈42 = neue Position.

- [ ] **Step 1: Write the failing test**

```python
PDF = Path(__file__).resolve().parents[2] / "Vorlagen" / "RK - Fermacell.pdf"

def test_rk_stark_fermacell_line():
    result = run_extraction(PDF)
    assert result.layout_id == "rk_stark"
    arts = [i.article_number for i in result.items]
    assert "330240" in arts
```

- [ ] **Step 2–4: Implement coordinate row builder, pytest PASS**

- [ ] **Step 5: Commit** — `feat(extractor): implement RK STARK coordinate strategy`

---

### Task 6: Strategie `norit_rechnung`

**Files:**
- Modify: `extractor/extractor/strategies/norit_rechnung.py`
- Test: `extractor/tests/test_norit_rechnung.py`

**Parser-Logik:** Positionszeile z. B. `120 TE 25 Therm ... 50 St 45,10 EUR /m² 1.217,70 EUR` — Artikelblock über mehrere Zeilen; `Artikelnummer:` in Folgezeilen.

- [ ] **Step 1: Write the failing test**

```python
PDF = Path(__file__).resolve().parents[2] / "Vorlagen" / "Norit Rechnung.pdf"

def test_norit_first_line_net_value():
    result = run_extraction(PDF)
    assert result.layout_id == "norit_rechnung"
    assert any(i.line_total and i.line_total >= 1217.0 for i in result.items)
```

- [ ] **Step 2–4: Implement multi-line block parser, pytest PASS**

- [ ] **Step 5: Commit** — `feat(extractor): implement Norit invoice layout strategy`

---

### Task 7: Excel-Export (Referenzlayout + Formeln) und CLI

**Files:**
- Create: `extractor/extractor/export/excel_writer.py`
- Create: `extractor/extractor/export/columns.py`
- Create: `extractor/extractor/cli.py`
- Create: `extractor/main.py`
- Test: `extractor/tests/test_excel_export.py`
- Test: `extractor/tests/test_cli.py`

**Spalten-Konstanten** (`columns.py`):
```python
SHEET_NAME = "Materialliste"
HEADERS = [
    "Position",
    "Artikel",
    "Menge",
    "Einheit",
    "Einzelpreis (€)",
    "Gesamt (€)",
    None,
    "Einzelpreis PDF (€)",
    "Aufschlag",
]
COL_POS, COL_ARTIKEL, COL_MENGE, COL_EINHEIT = 1, 2, 3, 4
COL_EINZELPREIS_VK, COL_GESAMT, COL_LEER, COL_EINZELPREIS_PDF, COL_AUFSCHLAG = 5, 6, 7, 8, 9
```

- [ ] **Step 1: Write the failing test (Spalten + Formeln)**

```python
# extractor/tests/test_excel_export.py
from pathlib import Path
import openpyxl
from extractor.pipeline import run_extraction
from extractor.export.excel_writer import write_excel
from extractor.models import ExportOptions

VORLAGEN = Path(__file__).resolve().parents[2] / "Vorlagen"
REF = VORLAGEN / "Materialliste mit VK Preis.xlsx"
PDF = VORLAGEN / "KAN_1060020 EK Preis IFB.pdf"

def test_excel_matches_reference_headers(tmp_path):
    out = tmp_path / "out.xlsx"
    result = run_extraction(PDF)
    write_excel(result, out, ExportOptions(aufschlag=0.2))
    wb = openpyxl.load_workbook(out)
    ws = wb["Materialliste"]
    ref = openpyxl.load_workbook(REF)["Materialliste"]
    for col in range(1, 10):
        assert ws.cell(1, col).value == ref.cell(1, col).value

def test_excel_row_formulas_and_aufschlag(tmp_path):
    out = tmp_path / "out.xlsx"
    result = run_extraction(PDF)
    write_excel(result, out, ExportOptions(aufschlag=0.2))
    ws = openpyxl.load_workbook(out)["Materialliste"]
    row = 2
    assert ws.cell(row, 9).value == 0.2
    assert ws.cell(row, 5).value == f"=H{row}*(1+I{row})"
    assert ws.cell(row, 6).value == f"=E{row}*C{row}"
    assert isinstance(ws.cell(row, 8).value, (int, float))

def test_vk_price_math_without_excel():
    pdf_price = 1.61
    aufschlag = 0.2
    assert round(pdf_price * (1 + aufschlag), 3) == 1.932
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `python -m pytest tests/test_excel_export.py -v`

- [ ] **Step 3: Implement `excel_writer.py` (openpyxl, nicht pandas-Dump)**

```python
from pathlib import Path
import openpyxl
from openpyxl import Workbook
from extractor.models import ExtractionResult, ExportOptions
from extractor.export.columns import (
    SHEET_NAME, HEADERS,
    COL_POS, COL_ARTIKEL, COL_MENGE, COL_EINHEIT,
    COL_EINZELPREIS_VK, COL_GESAMT, COL_EINZELPREIS_PDF, COL_AUFSCHLAG,
)

def write_excel(
    result: ExtractionResult,
    output_path: Path,
    options: ExportOptions,
) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = SHEET_NAME
    for col, header in enumerate(HEADERS, start=1):
        ws.cell(1, col, header)

    for i, item in enumerate(result.items, start=2):
        ws.cell(i, COL_POS, item.position)
        ws.cell(i, COL_ARTIKEL, item.artikel_label())
        if item.quantity is not None:
            ws.cell(i, COL_MENGE, item.quantity)
        ws.cell(i, COL_EINHEIT, item.unit)
        if item.unit_price is not None:
            ws.cell(i, COL_EINZELPREIS_PDF, item.unit_price)
        ws.cell(i, COL_AUFSCHLAG, options.aufschlag)
        ws.cell(i, COL_EINZELPREIS_VK, f"=H{i}*(1+I{i})")
        ws.cell(i, COL_GESAMT, f"=E{i}*C{i}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(output_path)
```

- [ ] **Step 4: CLI-Test mit `--aufschlag`**

```python
# extractor/tests/test_cli.py (ergänzen)
proc = subprocess.run(
    [sys.executable, str(ROOT / "main.py"),
     "--input", str(PDF), "--output", str(out), "--aufschlag", "0.15"],
    capture_output=True, text=True, cwd=ROOT,
)
payload = json.loads(proc.stdout.strip().splitlines()[-1])
assert payload["aufschlag"] == 0.15
```

`cli.py` — relevante Ergänzungen:
```python
parser.add_argument(
    "--aufschlag",
    type=float,
    default=0.2,
    help="Aufschlagsfaktor als Dezimalzahl, z.B. 0.2 für +20%%",
)
# ...
options = ExportOptions(aufschlag=args.aufschlag)
write_excel(result, out, options)
print(json.dumps({
    "ok": True,
    "layout_id": result.layout_id,
    "output": str(out.resolve()),
    "row_count": len(result.items),
    "aufschlag": options.aufschlag,
    "message": f"Erfolg: {len(result.items)} Positionen, Aufschlag {options.aufschlag:.0%}",
}, ensure_ascii=False))
```

- [ ] **Step 5: pytest PASS + Commit**

```bash
git add extractor/extractor/export/ extractor/tests/test_excel_export.py extractor/tests/test_cli.py
git commit -m "feat(extractor): export Materialliste layout with markup formulas"
```

---

### Task 8: Stubs für Layout 5 und 6

**Files:**
- Create: `extractor/extractor/strategies/layout_5.py`
- Create: `extractor/extractor/strategies/layout_6.py`
- Test: `extractor/tests/test_unknown_layout.py`

- [ ] **Step 1: Test — unbekanntes PDF wirft klaren Fehler**

```python
def test_unknown_pdf_raises(tmp_path):
    fake = tmp_path / "empty.pdf"
    # minimales PDF mit fitz erzeugen oder Text-only Mock
    import fitz
    doc = fitz.open()
    doc.new_page().insert_text((72, 72), "Unbekannter Lieferant XYZ")
    doc.save(fake)
    doc.close()
    with pytest.raises(ValueError, match="Unbekanntes"):
        from extractor.detector import detect_layout
        detect_layout(fake)
```

- [ ] **Step 2–5: Stubs mit `matches` → False; Dokumentation in README-Hinweis: 2 weitere PDFs in `Vorlagen/` legen, dann eigene Tasks analog Task 3–6**

Commit: `chore(extractor): reserve layout_5 and layout_6 strategy slots`

---

### Task 9: PyInstaller-Sidecar

**Files:**
- Create: `extractor/build_sidecar.ps1`
- Output: `desktop/src-tauri/binaries/extractor-sidecar-x86_64-pc-windows-msvc.exe`

- [ ] **Step 1: Install PyInstaller**

```bash
cd c:\Users\Felix\Kivion_github\Diart\extractor
pip install pyinstaller
```

- [ ] **Step 2: Build one-file exe**

`build_sidecar.ps1`:
```powershell
pyinstaller --onefile --name extractor-sidecar main.py
Copy-Item dist\extractor-sidecar.exe ..\desktop\src-tauri\binaries\extractor-sidecar-x86_64-pc-windows-msvc.exe -Force
```

- [ ] **Step 3: Manuell testen**

```powershell
.\desktop\src-tauri\binaries\extractor-sidecar-x86_64-pc-windows-msvc.exe `
  --input "c:\Users\Felix\Kivion_github\Diart\Vorlagen\KAN_1060020 EK Preis IFB.pdf" `
  --output "c:\Users\Felix\Kivion_github\Diart\extractor\tests\_out\manual.xlsx"
```

Expected: letzte stdout-Zeile JSON mit `"ok": true`

- [ ] **Step 4: Commit** — `build: add PyInstaller script for extractor sidecar` (exe in `.gitignore`, nur Script committen)

---

### Task 10: Tauri + Vue Grundgerüst

**Files:**
- Create: `desktop/` via `npm create tauri-app@latest`

- [ ] **Step 1: Scaffold**

```bash
cd c:\Users\Felix\Kivion_github\Diart
npm create tauri-app@latest desktop -- --template vue-ts
```

Bei Prompts: Vue + TypeScript, Tauri 2.

- [ ] **Step 2: Minimale UI in `desktop/src/App.vue`**

- Drag-Drop-Zone + Button „PDF auswählen“
- Liste: Dateiname, Status, Link „Excel öffnen“
- `@tauri-apps/plugin-dialog` für Dateiauswahl

- [ ] **Step 3: Dev starten**

```bash
cd desktop
npm install
npm run tauri dev
```

Expected: Fenster öffnet sich

- [ ] **Step 4: Commit** — `feat(desktop): scaffold Tauri Vue app shell`

---

### Task 11: Tauri Command — Sidecar aufrufen

**Files:**
- Modify: `desktop/src-tauri/tauri.conf.json`
- Create: `desktop/src-tauri/src/commands/convert.rs`
- Modify: `desktop/src-tauri/src/lib.rs` oder `main.rs`
- Create: `desktop/src/lib/convert.ts`

- [ ] **Step 1: `tauri.conf.json` — externalBin**

```json
{
  "bundle": {
    "externalBin": [
      "binaries/extractor-sidecar"
    ]
  }
}
```

- [ ] **Step 2: Rust Command**

`convert.rs` (Kernlogik):
```rust
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use serde::Serialize;

#[derive(Serialize)]
pub struct ConvertResult {
    pub ok: bool,
    pub layout_id: Option<String>,
    pub output: Option<String>,
    pub message: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn convert_pdf(
    app: AppHandle,
    input_path: String,
    aufschlag: f64,  // Dezimal, z.B. 0.2
) -> Result<ConvertResult, String> {
    let output_path = std::env::temp_dir()
        .join(format!("diart_{}.xlsx", uuid::Uuid::new_v4()));
    let aufschlag_str = aufschlag.to_string();
    let sidecar = app
        .shell()
        .sidecar("extractor-sidecar")
        .map_err(|e| e.to_string())?
        .args([
            "--input", &input_path,
            "--output", output_path.to_str().unwrap(),
            "--aufschlag", &aufschlag_str,
        ]);
    let output = sidecar.output().await.map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let last_line = stdout.lines().last().unwrap_or("{}");
    let parsed: serde_json::Value = serde_json::from_str(last_line).map_err(|e| e.to_string())?;
    Ok(ConvertResult {
        ok: parsed["ok"].as_bool().unwrap_or(false),
        layout_id: parsed["layout_id"].as_str().map(|s| s.to_string()),
        output: parsed["output"].as_str().map(|s| s.to_string()),
        message: parsed["message"].as_str().map(|s| s.to_string()),
        error: parsed["error"].as_str().map(|s| s.to_string()),
    })
}
```

`Cargo.toml` Dependencies: `tauri-plugin-shell`, `serde`, `serde_json`, `uuid`.

- [ ] **Step 3: Vue invoke**

`convert.ts`:
```typescript
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export async function pickAndConvert(aufschlagPercent: number) {
  const selected = await open({
    multiple: false,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!selected || typeof selected !== "string") return null;
  const aufschlag = aufschlagPercent / 100; // 20 → 0.2
  return invoke<{
    ok: boolean;
    layout_id?: string;
    output?: string;
    message?: string;
    error?: string;
    aufschlag?: number;
  }>("convert_pdf", { inputPath: selected, aufschlag });
}
```

- [ ] **Step 4: `tauri dev` — PDF wählen, Excel in Temp, Erfolgsmeldung**

- [ ] **Step 5: Commit** — `feat(desktop): wire PDF conversion via Python sidecar`

---

### Task 12: UI-Feinschliff (Aufschlag, Fortschritt, Vorschau, Excel öffnen)

**Files:**
- Modify: `desktop/src/App.vue`
- Modify: `desktop/src/lib/convert.ts`
- Modify: `extractor/extractor/cli.py` (Preview-Payload)

- [ ] **Step 1: Aufschlag-Eingabe in der UI**

In `App.vue` oberhalb des Upload-Bereichs:

```vue
<label>
  Aufschlag (%)
  <input type="number" v-model.number="aufschlagPercent" min="0" step="1" />
</label>
```

- Default: `20` (entspricht `0.2` in Excel)
- Hinweistext: „VK-Einzelpreis = PDF-Preis × (1 + Aufschlag/100)“
- Bei Konvertierung: `pickAndConvert(aufschlagPercent)`

- [ ] **Step 2: Loading-State während Sidecar läuft**

- [ ] **Step 3: Tabelle Vorschau** — Spalten wie Excel-Output (ohne Formeln, berechnete Werte)

CLI-Erweiterung in `cli.py`:
```python
def _preview_row(item: LineItem, aufschlag: float) -> dict:
    pdf = item.unit_price
    vk = round(pdf * (1 + aufschlag), 4) if pdf is not None else None
    menge = item.quantity
    gesamt = round(vk * menge, 2) if vk is not None and menge is not None else None
    return {
        "Position": item.position,
        "Artikel": item.artikel_label(),
        "Menge": menge,
        "Einheit": item.unit,
        "Einzelpreis (€)": vk,
        "Gesamt (€)": gesamt,
        "Einzelpreis PDF (€)": pdf,
        "Aufschlag": aufschlag,
    }

# im JSON-Response:
"preview": [_preview_row(it, options.aufschlag) for it in result.items[:20]],
```

Vue-Tabelle: dieselben Spaltenüberschriften wie `HEADERS` (ohne leere Spalte G).

- [ ] **Step 4: Button „Ordner öffnen“** — `@tauri-apps/plugin-opener` mit `output`-Pfad

- [ ] **Step 5: Manuell testen** — PDF wählen, Aufschlag `20` und `15` vergleichen (H/I-Spalten in Excel)

- [ ] **Step 6: Commit** — `feat(desktop): add markup input, preview, and open output folder`

---

### Task 13: Release-Build (.exe Installer)

**Files:**
- Modify: `desktop/package.json` scripts
- Re-run: `extractor/build_sidecar.ps1`

- [ ] **Step 1: Sidecar neu bauen (Release)**

- [ ] **Step 2: Production build**

```bash
cd c:\Users\Felix\Kivion_github\Diart\desktop
npm run tauri build
```

Expected: Installer unter `desktop/src-tauri/target/release/bundle/`

- [ ] **Step 3: Smoke-Test auf frischem Windows-VM oder zweitem Rechner** — alle 4 Vorlagen

- [ ] **Step 4: Commit** — `chore: document release build steps in README`

---

### Task 14: README und Entwickler-Doku

**Files:**
- Create: `README.md`

Inhalt:
- Voraussetzungen (Rust, Node, Python)
- `pytest` im `extractor/`
- Sidecar bauen + `tauri dev` / `tauri build`
- Ordner `Vorlagen/` — neue Layouts hinzufügen → neue Strategie + Detektor + Test
- Excel-Format: `Materialliste mit VK Preis.xlsx` — Spalten/Formeln in `excel_writer.py` nicht ändern ohne Abgleich mit Vorlage

- [ ] **Commit** — `docs: add setup and layout extension guide`

---

## Abweichung vom ursprünglichen Eel-Plan

Du hattest zuerst **Eel** (Python eingebettet) skizziert; dieser Plan folgt deiner **Tauri + CLI + Sidecar**-Variante. Vorteile: stabilere `.exe`, klarer Prozessgrenze, einfacheres Testen des Python-Teils ohne GUI.

---

## Self-Review (Plan vs. Anforderungen)

| Anforderung | Abgedeckt in |
|-------------|--------------|
| PDF laden | Task 10–11 (Dialog + Drag-Drop) |
| Tabellen → Excel | Task 7, Strategien 3–6 |
| Output wie `Materialliste mit VK Preis.xlsx` | Abschnitt Referenz-Output, Task 7 |
| Spalten Pos/Artikel/Menge/Einheit/Einzelpreis/Betrag | Mapping-Tabelle, `LineItem`, Strategien |
| Aufschlag + Einzelpreis mit Aufschlag | Task 7 (Spalten E, H, I + Formeln), Task 12 (UI %) |
| 6 Layouts / Strategy Pattern | Task 2, 3–6, 8 (4 konkret + 2 Stub) |
| CLI + JSON | Task 7 (`--aufschlag`) |
| Tauri + Vue | Task 10–12 |
| PyInstaller + `externalBin` | Task 9, 13 |
| Vorlagen als Referenz | PDF-Tests Tasks 3–6, Excel-Test Task 7 |

**Lücke:** Nur 4 von 6 PDF-Vorlagen vorhanden — Tasks für `layout_5`/`layout_6` nachliefern, sobald PDFs in `Vorlagen/` liegen.

**Keine Platzhalter** in Implementierungsschritten — Stubs nur für noch fehlende Lieferanten-PDFs, mit explizitem Test für „unbekannt“.

---

## Empfohlene Reihenfolge für dich

1. Tasks 1–8 (Python komplett testbar ohne GUI)  
2. Task 9 (Sidecar)  
3. Tasks 10–13 (Desktop)  
4. Fehlende 2 PDF-Vorlagen beschaffen → zwei neue Strategie-Tasks nach gleichem Muster wie Task 3
