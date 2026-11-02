from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import subprocess, tempfile, shutil, sys, json, re

root=Path(__file__).resolve().parents[1]/"public"
files=["index.html","capitales/index.html","relieve/index.html"]

class Inspector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links=[]
        self.scripts=[]
        self.script=None
    def handle_starttag(self,name,attributes):
        values=dict(attributes)
        if name=="a" and values.get("href"):
            self.links.append(values["href"])
        if name=="script":
            if values.get("src"):raise ValueError("external script")
            self.script=[]
        if name=="link" and values.get("rel") in ("manifest","icon","apple-touch-icon"):
            self.links.append(values["href"])
        if name=="link" and values.get("rel")=="stylesheet":
            if values.get("href","").startswith("http"):raise ValueError("external stylesheet")
    def handle_data(self,data):
        if self.script is not None:self.script.append(data)
    def handle_endtag(self,name):
        if name=="script" and self.script is not None:
            self.scripts.append("".join(self.script))
            self.script=None

for name in files:
    file=root/name
    assert file.is_file(),name
    raw=file.read_text(encoding="utf-8")
    assert "<title>" in raw,name
    p=Inspector()
    p.feed(raw)
    for link in p.links:
        u=urlsplit(link)
        if link.startswith("#") or u.scheme or link.startswith("//") or not u.path:continue
        target=root/u.path.lstrip("/") if u.path.startswith("/") else file.parent/u.path
        assert target.exists(),str(target)
    if "--check-js" in sys.argv:
        assert shutil.which("node"),"Node.js is required"
        with tempfile.TemporaryDirectory() as directory:
            for i,js in enumerate(p.scripts):
                path=Path(directory)/f"script{i}.js"
                path.write_text(js,encoding="utf-8")
                subprocess.run(["node","--check",str(path)],check=True,capture_output=True)
    print("OK",name)

# Coherencia cartográfica: cada capital cae dentro (o junto) a la silueta de su país.
capitals = (root / "capitales/index.html").read_text(encoding="utf-8")
def const(name):
    return json.loads(re.search(r"^const " + name + r"=(.*?);$", capitals, re.M).group(1))
countries, geo, pos = const("COUNTRIES"), const("GEO"), const("POS")
for c in countries:
    code = c["id"]
    assert code in geo and code in pos, f"{code}: falta silueta o posición"
    lon, lat = pos[code][2], pos[code][3]
    def inside(ring):
        hit = False
        for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
            if (y1 > lat) != (y2 > lat) and lon < x1 + (lat - y1) * (x2 - x1) / (y2 - y1):
                hit = not hit
        return hit
    points = [p for poly in geo[code] for p in poly[0]]
    near = min((p[0] - lon) ** 2 + (p[1] - lat) ** 2 for p in points) ** 0.5
    assert any(inside(poly[0]) for poly in geo[code]) or near < 2.0, f"{code}: la capital {c['capital']} está lejos de su país {pos[code]}"
print("OK cartografía", len(countries), "Estados")

# El código común incrustado debe coincidir con shared/.
subprocess.run([sys.executable, str(root.parent / "scripts/sync_shared.py"), "--check"], check=True)

# Modo sin conexión: el manifiesto y el service worker solo referencian archivos existentes.
manifest = json.loads((root / "manifest.webmanifest").read_text(encoding="utf-8"))
for icon in manifest["icons"]:
    assert (root / icon["src"]).is_file(), icon["src"]
worker = (root / "sw.js").read_text(encoding="utf-8")
for entry in re.findall(r'"\./([^"]*)"', worker):
    target = root / entry
    assert target.is_file() or (target / "index.html").is_file(), f"sw.js precache: {entry}"
print("OK modo sin conexión")
