from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import subprocess, tempfile, shutil, sys

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
