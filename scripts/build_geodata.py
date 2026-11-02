#!/usr/bin/env python3
"""Regenera la cartografía embebida en los juegos a partir de Natural Earth 1:50m.

Uso:
    python3 scripts/build_geodata.py ne_110m_admin_0_countries.geojson ne_50m_admin_0_countries.geojson

Los ficheros GeoJSON proceden de github.com/nvkelso/natural-earth-vector (carpeta geojson/).

Natural Earth es de dominio público (https://www.naturalearthdata.com/).
El script conserva las siluetas existentes y solo completa lo que falta:
  * `const GEO=`: Estados sin silueta (Serbia, Montenegro, Myanmar, Palestina con
    la escala 1:110m; microestados e islas con la 1:50m).
  * `const CONTEXT_LAND=` en public/capitales/index.html.
  * las claves `land` y `context` de `const DATA=` en public/relieve/index.html.

Decisiones cartográficas:
  * Los 195 Estados del juego usan su código ISO 3166-1 alfa-2.
  * Somalilandia se integra en Somalia y el norte de Chipre en Chipre,
    siguiendo las fronteras reconocidas por la ONU que usa el temario.
  * Kosovo, Sáhara Occidental, Taiwán, Groenlandia y demás territorios que
    no son Estados del temario se dibujan como «tierra de contexto»: visibles,
    sin nombre y no interactivos, para que el mapa no tenga huecos.
"""
import json, math, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MERGE = {"Somaliland": "SO", "N. Cyprus": "CY"}
SKIP = {"AQ", "TF", "HM", "GS"}  # territorios australes fuera de los encuadres


def simplify(points, tol):
    if len(points) < 5:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]; bx, by = points[b]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy) or 1e-12
        best, idx = -1, -1
        for i in range(a + 1, b):
            px, py = points[i]
            d = abs(dy * (px - ax) - dx * (py - ay)) / norm if (dx or dy) else math.hypot(px - ax, py - ay)
            if d > best:
                best, idx = d, i
        if best > tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(points, keep) if k]


def area(ring):
    return abs(sum(ring[i][0] * ring[i - 1][1] - ring[i - 1][0] * ring[i][1] for i in range(len(ring)))) / 2


def clean(polys, tol=0.035, min_area=0.004):
    """Simplifica, redondea y descarta islotes, conservando siempre el anillo mayor."""
    xs = [p[0] for poly in polys for p in poly[0]]
    ys = [p[1] for poly in polys for p in poly[0]]
    small = max(xs) - min(xs) < 1.2 and max(ys) - min(ys) < 1.2
    digits = 3 if small else 2
    tol = tol / 8 if small else tol
    biggest = max(area(poly[0]) for poly in polys)
    out = []
    for poly in polys:
        if area(poly[0]) < min_area and area(poly[0]) < biggest:
            continue
        rings = []
        for j, ring in enumerate(poly):
            if j and area(ring) < min_area * 4:
                continue
            r = [[round(x, digits), round(y, digits)] for x, y in simplify(ring, tol)]
            dedup = [p for i, p in enumerate(r) if i == 0 or p != r[i - 1]]
            if len(dedup) >= 4:
                rings.append(dedup)
        if rings:
            out.append(rings)
    return out


def clip_ring(ring, box):
    """Sutherland–Hodgman contra un rectángulo lon/lat amplio (bordes fuera de cámara)."""
    x0, y0, x1, y1 = box
    edges = [
        (lambda p: p[0] >= x0, lambda a, b: (x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0]))),
        (lambda p: p[0] <= x1, lambda a, b: (x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0]))),
        (lambda p: p[1] >= y0, lambda a, b: (a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0)),
        (lambda p: p[1] <= y1, lambda a, b: (a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1)),
    ]
    pts = [tuple(p) for p in ring]
    for inside, cut in edges:
        if not pts:
            break
        res = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            if inside(cur):
                if not inside(prev):
                    res.append(cut(prev, cur))
                res.append(cur)
            elif inside(prev):
                res.append(cut(prev, cur))
        pts = res
    return [list(p) for p in pts]


def load(path):
    countries, context = {}, {}
    for f in json.load(open(path, encoding="utf-8"))["features"]:
        p, g = f["properties"], f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        code = MERGE.get(p["NAME"], p["ISO_A2_EH"])
        if code in SKIP:
            continue
        if code == "-99" or len(code) != 2:
            context.setdefault(p["ADM0_A3"], []).extend(polys)
        else:
            countries.setdefault(code, []).extend(polys)
    return countries, context


def merged_pieces(path):
    """Polígonos que Natural Earth separa pero el temario integra (Somalilandia, norte de Chipre)."""
    pieces = {}
    for f in json.load(open(path, encoding="utf-8"))["features"]:
        p, g = f["properties"], f["geometry"]
        if p["NAME"] in MERGE:
            polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
            pieces.setdefault(MERGE[p["NAME"]], []).extend(polys)
    return pieces


def replace_const(html, name, value):
    pattern = re.compile(r"^const " + name + r"=.*?;$", re.M)
    line = "const " + name + "=" + json.dumps(value, ensure_ascii=False, separators=(",", ":")) + ";"
    if pattern.search(html):
        return pattern.sub(lambda _: line, html, count=1)
    return html.replace("const POS=", line + "\nconst POS=", 1)


def covers(polys, lon, lat):
    for poly in polys:
        ring, inside = poly[0], False
        for i in range(len(ring)):
            (x1, y1), (x2, y2) = ring[i - 1], ring[i]
            if (y1 > lat) != (y2 > lat) and lon < x1 + (lat - y1) * (x2 - x1) / (y2 - y1):
                inside = not inside
        if inside:
            return True
    return False


# Un punto representativo de cada pieza integrada, para no duplicarla si ya existe.
MERGE_PROBE = {"SO": (44.06, 9.56), "CY": (33.6, 35.25)}
CONTEXT_WORLD = {"EH", "FK", "GL", "PR", "NC", "TW", "XK"}


def main(src110, src50):
    c110, x110 = load(src110)
    c50, _ = load(src50)
    pieces = merged_pieces(src110)

    capitals_file = ROOT / "public/capitales/index.html"
    html = capitals_file.read_text(encoding="utf-8")
    ids = [c["id"] for c in json.loads(re.search(r"^const COUNTRIES=(.*?);$", html, re.M).group(1))]
    geo = json.loads(re.search(r"^const GEO=(.*?);$", html, re.M).group(1))
    added = []
    for i in ids:
        if i not in geo:
            source = c110.get(i) or c50.get(i)
            if source:
                geo[i] = clean(source, tol=0.02, min_area=0.0005)
                added.append(i)
    for code, polys in pieces.items():
        if code in geo and not covers(geo[code], *MERGE_PROBE[code]):
            geo[code] += clean(polys, tol=0.02, min_area=0.0005)
            added.append(code + "+")
    context = {k: clean(v, tol=0.04, min_area=0.01) for k, v in c110.items() if k in CONTEXT_WORLD}
    html = replace_const(html, "GEO", geo)
    html = replace_const(html, "CONTEXT_LAND", context)
    capitals_file.write_text(html, encoding="utf-8")

    relief_file = ROOT / "public/relieve/index.html"
    rhtml = relief_file.read_text(encoding="utf-8")
    data = json.loads(re.search(r"^const DATA=(.*?);$", rhtml, re.M).group(1))
    box = (-50, 18, 100, 86)
    land = data["land"]  # en el relieve cada país es una lista de anillos exteriores
    rings = lambda polys: [poly[0] for poly in polys]
    # La Rusia original terminaba en un corte recto en 66° E, visible con la proyección cónica.
    land["RU"] = rings(clean([[clip_ring(poly[0], box)] for poly in c110["RU"] if len(clip_ring(poly[0], box)) >= 4], tol=0.04, min_area=0.01))
    for code in ("RS", "ME", "XK"):
        if code not in land:
            land[code] = rings(clean(c110[code], tol=0.02, min_area=0.0005))
    if not covers([[r] for r in land["CY"]], *MERGE_PROBE["CY"]):
        land["CY"] += rings(clean(pieces["CY"], tol=0.02, min_area=0.0005))
    context_land = {}
    for code, polys in c110.items():
        if code in land:
            continue
        clipped = []
        for poly in polys:
            ring = clip_ring(poly[0], box)
            if len(ring) >= 4:
                clipped.append([ring])
        if clipped:
            cleaned = clean(clipped, tol=0.04, min_area=0.01)
            if cleaned:
                context_land[code] = rings(cleaned)
    data["land"] = land
    data["context"] = context_land
    data["attribution"] = "Fronteras: Atlas Quest y Natural Earth (dominio público). Ríos, cordilleras y cumbres: trazados esquemáticos, no aptos para navegación."
    line = "const DATA=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";"
    rhtml = re.sub(r"^const DATA=.*?;$", lambda _: line, rhtml, count=1, flags=re.M)
    relief_file.write_text(rhtml, encoding="utf-8")
    print("capitales: añadidos", added, "contexto", sorted(context))
    print("relieve: contexto", sorted(context_land))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
