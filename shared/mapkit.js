// MapKit: proyecciones, trazado SVG y cámara táctil compartidos por los juegos de Atlas Quest.
// Fuente única: shared/mapkit.js. `python3 scripts/sync_shared.py` lo copia dentro de cada juego.
const MapKit = (() => {
  const RAD = Math.PI / 180;
  const SCALE = 1000;
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Lambert acimutal equivalente: conserva áreas y formas razonables en encuadres continentales.
  function laea(lon0, lat0) {
    const sp0 = Math.sin(lat0 * RAD),
      cp0 = Math.cos(lat0 * RAD);
    const project = (lon, lat) => {
      const dl = (((lon - lon0 + 540) % 360) - 180) * RAD,
        p = lat * RAD;
      const cosc = sp0 * Math.sin(p) + cp0 * Math.cos(p) * Math.cos(dl);
      const k = Math.sqrt(2 / Math.max(1e-9, 1 + cosc));
      return [SCALE * k * Math.cos(p) * Math.sin(dl), -SCALE * k * (cp0 * Math.sin(p) - sp0 * Math.cos(p) * Math.cos(dl))];
    };
    // Solo se dibuja el hemisferio visible ampliado: evita trazos que cruzan el disco desde el antípoda.
    project.visible = (lon, lat) => sp0 * Math.sin(lat * RAD) + cp0 * Math.cos(lat * RAD) * Math.cos((lon - lon0) * RAD) > -0.5;
    return project;
  }

  // Equal Earth (Šavrič, Patterson y Jenny, 2018) para la vista mundial.
  function equalEarth(lon0 = 0) {
    const A1 = 1.340264,
      A2 = -0.081106,
      A3 = 0.000893,
      A4 = 0.003796,
      M = Math.sqrt(3) / 2;
    const project = (lon, lat) => {
      const l = (((lon - lon0 + 540) % 360) - 180) * RAD,
        t = Math.asin(M * Math.sin(lat * RAD)),
        t2 = t * t,
        t6 = t2 * t2 * t2;
      const x = (l * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
      const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
      return [SCALE * x, -SCALE * y];
    };
    project.visible = () => true;
    return project;
  }

  function ringPath(ring, project, close = true) {
    let d = "";
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = project(ring[i][0], ring[i][1]);
      d += (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
    }
    return close ? d + "Z" : d;
  }

  // polygons: [[ring, hole...], ...]; rings: [[lon, lat], ...]
  function polygonsPath(polygons, project) {
    let d = "";
    for (const poly of polygons) {
      if (!poly[0]?.some(([lon, lat]) => project.visible(lon, lat))) continue;
      for (const ring of poly) d += ringPath(ring, project);
    }
    return d;
  }

  function bounds(points, project) {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const [lon, lat] of points) {
      if (!project.visible(lon, lat)) continue;
      const [x, y] = project(lon, lat);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return Number.isFinite(x0) ? [x0, y0, x1, y1] : null;
  }

  // Encuadre geográfico [oeste, sur, este, norte] muestreado por sus bordes (las curvas de la proyección).
  function boxBounds([w, s, e, n], project) {
    const pts = [];
    const span = e >= w ? e - w : e + 360 - w;
    for (let i = 0; i <= 24; i++) {
      const lon = w + (span * i) / 24;
      pts.push([lon, s], [lon, n], [lon, (s + n) / 2]);
    }
    for (let j = 0; j <= 12; j++) pts.push([w, s + ((n - s) * j) / 12], [e, s + ((n - s) * j) / 12]);
    return bounds(pts, project);
  }

  function graticule(project, [w, s, e, n], step = 10) {
    let d = "";
    const span = e >= w ? e - w : e + 360 - w;
    for (let lat = Math.ceil(s / step) * step; lat <= n; lat += step) {
      const ring = [];
      for (let i = 0; i <= 60; i++) ring.push([w + (span * i) / 60, lat]);
      d += ringPath(
        ring.filter(([lon, la]) => project.visible(lon, la)),
        project,
        false,
      );
    }
    for (let lon = Math.ceil(w / step) * step; lon <= w + span; lon += step) {
      const ring = [];
      for (let i = 0; i <= 40; i++) ring.push([lon, s + ((n - s) * i) / 40]);
      d += ringPath(
        ring.filter(([lo, la]) => project.visible(lo, la)),
        project,
        false,
      );
    }
    return d;
  }

  // Grupo que mantiene tamaño constante en pantalla (marcadores, letras, etiquetas).
  function pin(x, y, inner, attrs = "") {
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" ${attrs}><g class="mk-s">${inner}</g></g>`;
  }

  // Distancia ortodrómica (km) y rumbo en 8 direcciones, para pistas de «frío/caliente».
  function distanceKm([lon1, lat1], [lon2, lat2]) {
    const p1 = lat1 * RAD,
      p2 = lat2 * RAD,
      dp = p2 - p1,
      dl = (lon2 - lon1) * RAD;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function bearing([lon1, lat1], [lon2, lat2]) {
    const p1 = lat1 * RAD,
      p2 = lat2 * RAD,
      dl = (lon2 - lon1) * RAD;
    const y = Math.sin(dl) * Math.cos(p2),
      x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) / RAD + 360) % 360;
  }
  function compass(deg, names) {
    return names[Math.round(deg / 45) % 8];
  }

  class Camera {
    // world: zona navegable [x0,y0,x1,y1]; home: encuadre inicial; maxZoom respecto al encuadre inicial.
    constructor(svg, { world, home, maxZoom = 14, pad = 18, onChange, doubleTap = true } = {}) {
      this.doubleTap = doubleTap;
      this.svg = svg;
      this.world = world || home;
      this.homeRect = home || world;
      this.maxZoom = maxZoom;
      this.pad = pad;
      this.onChange = onChange;
      this.cx = 0;
      this.cy = 0;
      this.s = 1;
      this.ready = false;
      this.suppressClick = false;
      this.pointers = new Map();
      this.gesture = null;
      this.frame = 0;
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      if (!svg.hasAttribute("tabindex")) svg.setAttribute("tabindex", "0");
      new ResizeObserver(() => this.resized()).observe(svg);
      this.bindGestures();
    }
    size() {
      const r = this.svg.getBoundingClientRect();
      return [Math.max(40, r.width), Math.max(40, r.height)];
    }
    hidden() {
      const r = this.svg.getBoundingClientRect();
      return r.width < 41 || r.height < 41;
    }
    // Al girar el móvil o mostrar una vista oculta se conserva el nivel de zoom relativo al encuadre inicial.
    resized() {
      if (this.hidden()) return;
      if (!this.ready || this.stale) {
        this.stale = false;
        this.home(false);
        return;
      }
      this.s = this.scaleFor(this.homeRect) * (this.relative || 1);
      this.apply();
    }
    scaleFor([x0, y0, x1, y1], pad = this.pad) {
      const [w, h] = this.size();
      return Math.max((x1 - x0) / Math.max(20, w - 2 * pad), (y1 - y0) / Math.max(20, h - 2 * pad), 1e-6);
    }
    limits() {
      const homeS = this.scaleFor(this.homeRect);
      // Se permite alejar hasta ver el mundo navegable completo.
      return { min: homeS / this.maxZoom, max: Math.max(homeS * 1.35, this.scaleFor(this.world, 0) * 1.05) };
    }
    get zoom() {
      return this.scaleFor(this.homeRect) / this.s;
    }
    clamp() {
      const { min, max } = this.limits();
      this.s = Math.min(max, Math.max(min, this.s));
      const [w, h] = this.size(),
        [x0, y0, x1, y1] = this.world;
      const hw = (w * this.s) / 2,
        hh = (h * this.s) / 2;
      // El centro no se aleja del mundo: siempre queda tierra a la vista.
      this.cx = x1 - x0 > 2 * hw ? Math.min(x1 - hw * 0.3, Math.max(x0 + hw * 0.3, this.cx)) : Math.min(x1, Math.max(x0, this.cx));
      this.cy = y1 - y0 > 2 * hh ? Math.min(y1 - hh * 0.3, Math.max(y0 + hh * 0.3, this.cy)) : Math.min(y1, Math.max(y0, this.cy));
    }
    apply() {
      if (this.hidden()) {
        this.stale = true;
        return;
      }
      this.clamp();
      this.relative = this.s / this.scaleFor(this.homeRect);
      const [w, h] = this.size();
      const vw = w * this.s,
        vh = h * this.s;
      this.svg.setAttribute("viewBox", `${(this.cx - vw / 2).toFixed(2)} ${(this.cy - vh / 2).toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}`);
      this.svg.style.setProperty("--u", this.s.toFixed(4));
      this.svg.classList.toggle("mk-zoomed", this.zoom > 1.6);
      this.svg.classList.toggle("mk-closeup", this.zoom > 3.2);
      this.onChange?.(this);
    }
    set(cx, cy, s, animate = false) {
      cancelAnimationFrame(this.frame);
      if (!animate || !this.ready || reducedMotion()) {
        Object.assign(this, { cx, cy, s, ready: true });
        this.apply();
        return;
      }
      const from = { cx: this.cx, cy: this.cy, s: this.s },
        start = performance.now(),
        ms = 420;
      const step = (t) => {
        const k = Math.min(1, (t - start) / ms),
          e = 1 - Math.pow(1 - k, 3);
        this.cx = from.cx + (cx - from.cx) * e;
        this.cy = from.cy + (cy - from.cy) * e;
        this.s = Math.exp(Math.log(from.s) + (Math.log(s) - Math.log(from.s)) * e);
        this.apply();
        if (k < 1) this.frame = requestAnimationFrame(step);
      };
      this.frame = requestAnimationFrame(step);
    }
    // Franjas ocupadas por el HUD (pregunta arriba, resultado abajo): el encuadre las esquiva.
    insets() {
      const r = this.svg.getBoundingClientRect();
      let top = 0,
        bottom = 0;
      for (const el of this.svg.parentElement?.querySelectorAll(":scope > .mk-hud:not([hidden])") || []) {
        const b = el.getBoundingClientRect();
        if (!b.height) continue;
        if (b.top - r.top < r.height / 2) top = Math.max(top, b.bottom - r.top);
        else bottom = Math.max(bottom, r.bottom - b.top);
      }
      return { top: Math.min(top, r.height * 0.4), bottom: Math.min(bottom, r.height * 0.45) };
    }
    framing([x0, y0, x1, y1], pad, mode = "contain") {
      const [w, h] = this.size(),
        { top, bottom } = this.insets();
      const sx = (x1 - x0) / Math.max(20, w - 2 * pad),
        sy = (y1 - y0) / Math.max(20, h - top - bottom - 2 * pad);
      const s = mode === "balanced" && w / h < (x1 - x0) / (y1 - y0) ? Math.sqrt(sx * sy) : Math.max(sx, sy, 1e-6);
      return [(x0 + x1) / 2, (y0 + y1) / 2 + ((bottom - top) / 2) * s, s];
    }
    fit(rect, { animate = true, pad = this.pad, minSize = 0 } = {}) {
      if (!rect) return;
      let [x0, y0, x1, y1] = rect;
      const grow = (a, b) => (b - a < minSize ? [(a + b) / 2 - minSize / 2, (a + b) / 2 + minSize / 2] : [a, b]);
      [x0, x1] = grow(x0, x1);
      [y0, y1] = grow(y0, y1);
      const [cx, cy, s] = this.framing([x0, y0, x1, y1], pad);
      this.set(cx, cy, s, animate);
    }
    setHome(home, world = home) {
      this.homeRect = home;
      this.world = world;
    }
    // En pantallas verticales se recorta un poco a los lados en lugar de dejar el continente diminuto.
    home(animate = true) {
      const [cx, cy, s] = this.framing(this.homeRect, this.pad, "balanced");
      this.set(cx, cy, s, animate);
    }
    toWorld(clientX, clientY) {
      const r = this.svg.getBoundingClientRect(),
        [w, h] = this.size();
      return [this.cx + (clientX - r.left - w / 2) * this.s, this.cy + (clientY - r.top - h / 2) * this.s];
    }
    zoomAt(factor, clientX, clientY, animate = false) {
      const r = this.svg.getBoundingClientRect();
      if (clientX == null) {
        clientX = r.left + r.width / 2;
        clientY = r.top + r.height / 2;
      }
      const [wx, wy] = this.toWorld(clientX, clientY);
      const { min, max } = this.limits();
      const s = Math.min(max, Math.max(min, this.s / factor));
      const k = s / this.s;
      this.set(wx - (wx - this.cx) * k, wy - (wy - this.cy) * k, s, animate);
    }
    panBy(dx, dy) {
      this.cx -= dx * this.s;
      this.cy -= dy * this.s;
      this.apply();
    }
    bindGestures() {
      const svg = this.svg;
      let lastTap = null;
      const midpoint = () => {
        const [a, b] = [...this.pointers.values()];
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
      };
      svg.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        cancelAnimationFrame(this.frame);
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.pointers.size === 1) this.gesture = { type: "pan", x: e.clientX, y: e.clientY, cx: this.cx, cy: this.cy, moved: false };
        else if (this.pointers.size === 2) {
          const m = midpoint();
          this.gesture = { type: "pinch", m, s: this.s, anchor: this.toWorld(m.x, m.y), moved: true };
          for (const id of this.pointers.keys()) svg.setPointerCapture?.(id);
        }
      });
      svg.addEventListener("pointermove", (e) => {
        if (!this.pointers.has(e.pointerId) || !this.gesture) return;
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g = this.gesture;
        if (g.type === "pan") {
          const dx = e.clientX - g.x,
            dy = e.clientY - g.y;
          if (!g.moved && Math.hypot(dx, dy) < 7) return;
          if (!g.moved) {
            g.moved = true;
            svg.setPointerCapture?.(e.pointerId);
            svg.classList.add("mk-dragging");
          }
          this.cx = g.cx - dx * this.s;
          this.cy = g.cy - dy * this.s;
          this.apply();
        } else if (g.type === "pinch" && this.pointers.size === 2) {
          const m = midpoint(),
            { min, max } = this.limits();
          this.s = Math.min(max, Math.max(min, (g.s * g.m.d) / m.d));
          const r = svg.getBoundingClientRect(),
            [w, h] = this.size();
          this.cx = g.anchor[0] - (m.x - r.left - w / 2) * this.s;
          this.cy = g.anchor[1] - (m.y - r.top - h / 2) * this.s;
          this.apply();
        }
      });
      const end = (e) => {
        if (!this.pointers.has(e.pointerId)) return;
        this.pointers.delete(e.pointerId);
        const g = this.gesture;
        if (g?.moved) {
          this.suppressClick = true;
          setTimeout(() => (this.suppressClick = false), 140);
        } else if (this.doubleTap && e.type === "pointerup" && e.pointerType !== "mouse") {
          // Doble toque: amplía en el punto tocado.
          const now = performance.now();
          if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
            this.zoomAt(2, e.clientX, e.clientY, true);
            lastTap = null;
          } else lastTap = { t: now, x: e.clientX, y: e.clientY };
        }
        svg.classList.remove("mk-dragging");
        if (this.pointers.size === 1) {
          const [p] = this.pointers.values();
          this.gesture = { type: "pan", x: p.x, y: p.y, cx: this.cx, cy: this.cy, moved: true };
        } else if (!this.pointers.size) this.gesture = null;
      };
      svg.addEventListener("pointerup", end);
      svg.addEventListener("pointercancel", end);
      svg.addEventListener(
        "click",
        (e) => {
          if (this.suppressClick) {
            e.stopPropagation();
            e.preventDefault();
          }
        },
        true,
      );
      svg.addEventListener("dblclick", (e) => {
        e.preventDefault();
        this.zoomAt(e.shiftKey ? 0.5 : 2, e.clientX, e.clientY, true);
      });
      // La rueda solo amplía con Ctrl/⌘ (o pellizco del trackpad) o si el mapa tiene el foco: la página sigue desplazándose.
      svg.addEventListener(
        "wheel",
        (e) => {
          if (!(e.ctrlKey || e.metaKey || document.activeElement === svg)) {
            svg.dispatchEvent(new CustomEvent("mk-wheelhint", { bubbles: true }));
            return;
          }
          e.preventDefault();
          // Un «clic» de rueda (±100) amplía ~1,5×; el pellizco del trackpad envía deltas pequeños y continuos.
          const delta = Math.max(-40, Math.min(40, e.deltaY * (e.deltaMode === 1 ? 33 : 1)));
          this.zoomAt(Math.exp(-delta * 0.01), e.clientX, e.clientY);
        },
        { passive: false },
      );
      svg.addEventListener("pointerdown", () => svg.focus({ preventScroll: true }));
      svg.addEventListener("keydown", (e) => {
        const step = 60;
        const actions = {
          "+": () => this.zoomAt(1.5, null, null, true),
          "=": () => this.zoomAt(1.5, null, null, true),
          "-": () => this.zoomAt(1 / 1.5, null, null, true),
          0: () => this.home(),
          ArrowLeft: () => this.panBy(step, 0),
          ArrowRight: () => this.panBy(-step, 0),
          ArrowUp: () => this.panBy(0, step),
          ArrowDown: () => this.panBy(0, -step),
        };
        if (!svg.contains(e.target) || e.altKey || e.ctrlKey || e.metaKey || !actions[e.key]) return;
        e.preventDefault();
        actions[e.key]();
      });
    }
  }

  // Capas del HUD (pregunta arriba, resultado abajo) dentro del contenedor del mapa.
  function hud(stage, part, html) {
    let el = stage.querySelector(":scope > .mk-hud-" + part);
    if (!el) {
      el = document.createElement("div");
      el.className = "mk-hud mk-hud-" + part;
      stage.append(el);
    }
    if (el.dataset.html !== html) {
      el.innerHTML = html;
      el.dataset.html = html;
    }
    el.hidden = !html;
    return el;
  }
  // Aviso breve cuando la rueda desplaza la página en lugar de ampliar el mapa.
  function wheelTip(stage, text) {
    const tip = document.createElement("div");
    let timer = 0;
    tip.className = "mk-tip";
    tip.setAttribute("aria-hidden", "true");
    stage.append(tip);
    stage.addEventListener("mk-wheelhint", () => {
      tip.textContent = typeof text === "function" ? text() : text;
      tip.classList.add("show");
      clearTimeout(timer);
      timer = setTimeout(() => tip.classList.remove("show"), 1400);
    });
  }

  return { hud, wheelTip, laea, equalEarth, ringPath, polygonsPath, bounds, boxBounds, graticule, pin, distanceKm, bearing, compass, Camera };
})();
