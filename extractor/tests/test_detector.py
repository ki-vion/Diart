from pathlib import Path

import pytest

from extractor.detector import detect_layout

VORLAGEN = Path(__file__).resolve().parents[2] / "Vorlagen"


@pytest.mark.parametrize(
    "pdf_name,expected",
    [
        ("KAN_1060020 EK Preis IFB.pdf", "kan_ifb"),
        ("Norit Rechnung.pdf", "norit_rechnung"),
        ("RK - Fermacell.pdf", "rk_stark"),
        ("Verkauf - Angebot_VAN029183.pdf", "laier_van"),
    ],
)
def test_detect_layout_from_vorlagen(pdf_name, expected):
    path = VORLAGEN / pdf_name
    assert path.exists(), f"Missing fixture: {path}"
    assert detect_layout(path) == expected
