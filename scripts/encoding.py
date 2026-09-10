"""
Shared encoding for the precomputed data files.

Everything is written as arrays of tuples rather than arrays of objects, and
gzipped. Measured on real telemetry, tuples are 2.3x smaller than the object
form before compression; gzip takes roughly another 5x off. Nine seasons come
to about 15 MB committed instead of 60 MB.

Every file carries its own `schema`, naming the fields of each tuple table in
order, so the format stays readable without consulting this file and the
TypeScript decoder has something to check itself against.
"""

from __future__ import annotations

import gzip
import json
import math
from pathlib import Path
from typing import Any

FORMAT_VERSION = 1


def rounded(value: Any, digits: int = 3):
    """Plain float rounded, or None. Trims the file more than it looks."""
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return round(f, digits)


def write_gz(path: Path, payload: dict) -> int:
    """
    Write a payload as gzipped JSON, returning bytes written.

    Keys are sorted and mtime is pinned so re-running the pipeline on unchanged
    data produces an identical file — otherwise every run would show up as a
    diff and the committed data would churn.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    raw = text.encode("utf-8")
    with gzip.GzipFile(filename="", mode="wb", fileobj=open(path, "wb"), mtime=0) as f:
        f.write(raw)
    return path.stat().st_size


def read_gz(path: Path) -> dict:
    with gzip.open(path, "rt", encoding="utf-8") as f:
        return json.load(f)
