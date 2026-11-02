#!/usr/bin/env python3
"""Copia shared/mapkit.{css,js} dentro de cada juego.

Los juegos se publican como un único HTML autocontenido (funcionan sin red y con
file://), así que el código común se incrusta en bloques marcados:

    <style id="mapkit-css">…</style>
    <script id="mapkit-js">…</script>

Uso:  python3 scripts/sync_shared.py          # reescribe los bloques
      python3 scripts/sync_shared.py --check  # falla si algún juego está desfasado
"""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAMES = ["public/capitales/index.html", "public/relieve/index.html"]
BLOCKS = {
    "style": ("mapkit-css", ROOT / "shared/mapkit.css", "</head>"),
    "script": ("mapkit-js", ROOT / "shared/mapkit.js", "<script>"),
}


def embed(html):
    for tag, (block_id, source, anchor) in BLOCKS.items():
        content = source.read_text(encoding="utf-8")
        block = f'<{tag} id="{block_id}">\n{content}</{tag}>\n'
        pattern = re.compile(rf'<{tag} id="{block_id}">.*?</{tag}>\n', re.S)
        if pattern.search(html):
            html = pattern.sub(lambda _: block, html, count=1)
        else:
            html = html.replace(anchor, block + anchor, 1)
    return html


def main():
    stale = []
    for name in GAMES:
        path = ROOT / name
        html = path.read_text(encoding="utf-8")
        updated = embed(html)
        if updated != html:
            stale.append(name)
            if "--check" not in sys.argv:
                path.write_text(updated, encoding="utf-8")
    if "--check" in sys.argv and stale:
        sys.exit("Código compartido desfasado en: " + ", ".join(stale) + ". Ejecuta scripts/sync_shared.py")
    print("Sincronizado" if "--check" not in sys.argv else "Código compartido al día")


if __name__ == "__main__":
    main()
