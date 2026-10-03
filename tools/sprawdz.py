#!/usr/bin/env python3
"""Sanity checks for the published site, run by the integrator after every merge.

Rebuilds the site layout the way deploy.yml does, then checks: local links and
assets resolve, paths are relative (the site lives under /hackyeah-2026/),
JavaScript parses, and no secrets or duplicate uploads slipped in.
Exits 1 if anything is broken; warnings alone don't fail.
"""
import re
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_PREFIXES = ("http://", "https://", "//", "data:", "mailto:", "tel:", "#", "javascript:", "blob:")
SECRET_PATTERNS = [
    r"sk-ant-[A-Za-z0-9_-]{20,}",
    r"sk_live_[A-Za-z0-9]{10,}",
    r"rk_live_[A-Za-z0-9]{10,}",
    r"whsec_[A-Za-z0-9]{10,}",
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    r"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJ[^\"']*service_role",
]

errors, warnings = [], []


def build_site(dest):
    """Lay files out exactly as deploy.yml does (its mkdir/cp/rm lines, with _site -> dest)."""
    workflow = (ROOT / ".github/workflows/deploy.yml").read_text()
    for line in workflow.splitlines():
        cmd = line.strip()
        if re.match(r"(mkdir|cp|rm)\s", cmd) and "${{" not in cmd:
            cmd = re.sub(r"(?<![\w/])_site", str(dest), cmd)
            r = subprocess.run(cmd, shell=True, cwd=ROOT, capture_output=True, text=True)
            if r.returncode:
                errors.append(f"deploy.yml: '{line.strip()}' nie działa: {r.stderr.strip()[:200]}")
    return dest


class Refs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs, self.scripts, self._in_script = [], [], None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for key in ("src", "href"):
            if a.get(key):
                self.refs.append(a[key])
        if tag == "script" and not a.get("src"):
            self._in_script = (a.get("type") or "").lower()
            self.scripts.append([self._in_script, ""])

    def handle_endtag(self, tag):
        if tag == "script":
            self._in_script = None

    def handle_data(self, data):
        if self._in_script is not None:
            self.scripts[-1][1] += data


def node_check(code, module, label):
    with tempfile.NamedTemporaryFile("w", suffix=".mjs" if module else ".cjs", delete=False) as f:
        f.write(code)
    r = subprocess.run(["node", "--check", f.name], capture_output=True, text=True)
    Path(f.name).unlink()
    if r.returncode:
        msg = next((l for l in r.stderr.splitlines() if "Error" in l), r.stderr.strip()[:200])
        errors.append(f"{label}: JS się nie parsuje: {msg}")


def check_html(path, site):
    rel = Path("_site") / path.relative_to(site)
    p = Refs()
    p.feed(path.read_text(errors="replace"))
    for ref in p.refs:
        ref = ref.strip()
        if not ref or ref.startswith(SKIP_PREFIXES) or "${" in ref or "{{" in ref:
            continue
        if ref.startswith("/"):
            errors.append(f"{rel}: ścieżka absolutna '{ref}' (na Pages strona jest pod /hackyeah-2026/, użyj względnej)")
            continue
        target = (path.parent / re.split(r"[?#]", ref)[0]).resolve()
        if not target.exists():
            errors.append(f"{rel}: brak pliku '{ref}'")
    for i, (typ, code) in enumerate(p.scripts):
        if typ in ("", "text/javascript", "application/javascript", "module") and code.strip():
            node_check(code, typ == "module", f"{rel} <script #{i + 1}>")


def main():
    tmp = tempfile.TemporaryDirectory()
    site = build_site(Path(tmp.name) / "_site")
    if not any(site.rglob("*.html")):
        errors.append("deploy.yml nie publikuje żadnej strony HTML")
    for f in sorted(site.rglob("*")):
        if not f.is_file() or "node_modules" in f.parts:
            continue
        rel = Path("_site") / f.relative_to(site)
        if re.search(r" \(\d+\)(\.[^.]+)?$", f.name):
            warnings.append(f"{rel}: wygląda na duplikat z uploadu przez stronę")
        if f.suffix == ".html":
            check_html(f, site)
        elif f.suffix in (".js", ".mjs", ".cjs"):
            r = subprocess.run(["node", "--check", str(f)], capture_output=True, text=True)
            if r.returncode:
                msg = next((l for l in r.stderr.splitlines() if "Error" in l), r.stderr.strip()[:200])
                errors.append(f"{rel}: JS się nie parsuje: {msg}")

    tracked = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout.split()
    for name in tracked:
        if re.search(r"(^|/)\.env(\.|$)", name) and not name.endswith(".example"):
            errors.append(f"{name}: plik .env w repo (sekrety nie mogą być publiczne)")
        f = ROOT / name
        if f.is_file() and f.stat().st_size < 2_000_000 and "node_modules" not in f.parts:
            text = f.read_text(errors="ignore")
            for pat in SECRET_PATTERNS:
                if re.search(pat, text):
                    errors.append(f"{name}: wygląda na sekretny klucz ({pat[:12]}…)")

    print(f"Sprawdzona strona tak, jak publikuje ją deploy.yml: {sum(1 for f in site.rglob('*') if f.is_file())} plików")
    for w in warnings:
        print(f"UWAGA: {w}")
    for e in errors:
        print(f"BŁĄD: {e}")
    print("OK" if not errors else f"{len(errors)} błędów")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
