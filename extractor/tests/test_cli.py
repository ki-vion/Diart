import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT.parent / "Vorlagen" / "KAN_1060020 EK Preis IFB.pdf"


def test_cli_success_json(tmp_path):
    out = tmp_path / "out.xlsx"
    proc = subprocess.run(
        [
            sys.executable,
            str(ROOT / "main.py"),
            "--input",
            str(PDF),
            "--output",
            str(out),
        ],
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout.strip().splitlines()[-1])
    assert payload["ok"] is True
    assert payload["layout_id"] == "kan_ifb"
    assert out.exists()


def test_cli_custom_aufschlag(tmp_path):
    out = tmp_path / "out.xlsx"
    proc = subprocess.run(
        [
            sys.executable,
            str(ROOT / "main.py"),
            "--input",
            str(PDF),
            "--output",
            str(out),
            "--aufschlag",
            "0.15",
        ],
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout.strip().splitlines()[-1])
    assert payload["aufschlag"] == 0.15
