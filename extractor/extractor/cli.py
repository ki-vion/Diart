from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from extractor.export.excel_writer import preview_row, write_excel
from extractor.models import ExportOptions
from extractor.pipeline import run_extraction


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Diart PDF → Excel")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument(
        "--aufschlag",
        type=float,
        default=0.2,
        help="Aufschlagsfaktor als Dezimalzahl, z.B. 0.2 für +20%%",
    )
    args = parser.parse_args(argv)

    inp = Path(args.input)
    out = Path(args.output)
    options = ExportOptions(aufschlag=args.aufschlag)

    try:
        result = run_extraction(inp)
        write_excel(result, out, options)
        print(
            json.dumps(
                {
                    "ok": True,
                    "layout_id": result.layout_id,
                    "output": str(out.resolve()),
                    "row_count": len(result.items),
                    "aufschlag": options.aufschlag,
                    "message": (
                        f"Erfolg: {len(result.items)} Positionen, "
                        f"Aufschlag {options.aufschlag:.0%}"
                    ),
                    "preview": [
                        preview_row(item, options.aufschlag)
                        for item in result.items[:20]
                    ],
                },
                ensure_ascii=False,
            )
        )
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
