from __future__ import annotations

import re


def parse_de_number(value: str) -> float:
    cleaned = value.strip().replace(" ", "")
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")
    return float(cleaned)


_NETWERT_TAIL = re.compile(
    r"(?P<net>[\d.]+,\d{2})\s*EUR\s*$", re.IGNORECASE
)
