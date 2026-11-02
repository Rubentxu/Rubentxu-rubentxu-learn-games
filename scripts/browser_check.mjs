// Pruebas de navegador de extremo a extremo (escritorio y móvil) con Playwright.
// Uso: python3 -m http.server 8000 --directory public &  node scripts/browser_check.mjs [http://localhost:8000] [carpeta-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const base = process.argv[2] || "http://localhost:8000";
const shots = process.argv[3] || "";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " · " + detail : ""}`);
};

async function page(browser, profile) {
  const context = await browser.newContext(profile === "móvil" ? { ...devices["iPhone 13"] } : { viewport: { width: 1440, height: 900 } });
  const p = await context.newPage();
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && p.errors.push(m.text()));
  return p;
}
const shot = async (p, name) => shots && p.screenshot({ path: `${shots}/${name}.png` });

const browser = await chromium.launch();
for (const profile of ["escritorio", "móvil"]) {
  const p = await page(browser, profile);

  // Capitales: todas las vistas cargan sin errores.
  for (const view of ["mapa", "puzzles", "hoy", "tarjetas", "estadisticas", "ajustes"]) {
    await p.goto(`${base}/capitales/#${view}`);
    await p.waitForTimeout(350);
    const active = await p.evaluate(() => document.querySelector(".view.active")?.id);
    check(`[${profile}] capitales #${view} abre su vista`, active === "view-" + view, active);
    await shot(p, `${profile}-capitales-${view}`);
  }
  await p.goto(`${base}/capitales/#mapa`);
  await p.waitForTimeout(400);
  const fills = await p.evaluate(() => {
    const svg = document.getElementById("atlas-map"),
      r = svg.getBoundingClientRect(),
      [, , w, h] = svg.getAttribute("viewBox").split(" ").map(Number);
    return { aspectSvg: r.width / r.height, aspectView: w / h, shapes: svg.querySelectorAll("[data-iso]").length };
  });
  check(`[${profile}] el encuadre del mapa coincide con su tamaño (sin bandas)`, Math.abs(fills.aspectSvg - fills.aspectView) < 0.01, JSON.stringify(fills));
  check(`[${profile}] Serbia, Montenegro y microestados tienen silueta`, await p.evaluate(() => ["RS", "ME", "AD", "VA", "MC"].every((id) => document.querySelector(`#atlas-map [data-iso="${id}"]`))));

  // Desafío: fallo con pista de distancia y acierto con puntos.
  await p.click("#map-challenge-btn");
  const target = await p.evaluate(() => atlas.challenge.round[0]);
  const wrong = await p.evaluate((t) => [...document.querySelectorAll("#atlas-map .atlas-lands [data-iso]")].map((e) => e.dataset.iso).find((id) => id !== t), target);
  await p.evaluate((id) => onMapCountry(id), wrong);
  const hint = await p.locator("#view-mapa .mk-hud-bottom").innerText();
  check(`[${profile}] un fallo en el desafío da distancia y dirección`, /km al (norte|sur|este|oeste|noreste|noroeste|sureste|suroeste)/.test(hint) || /menos de 150 km/.test(hint), hint.replace(/\s+/g, " "));
  await p.waitForTimeout(950);
  await p.evaluate((id) => onMapCountry(id), target);
  const pts = await p.evaluate(() => atlas.challenge.points);
  check(`[${profile}] acertar al segundo intento suma 2 puntos`, pts === 2, String(pts));
  await shot(p, `${profile}-capitales-desafio`);

  // Gestos: la rueda con Ctrl y el pellizco amplían el mapa.
  const before = await p.evaluate(() => atlas.camera.zoom);
  const box = await p.locator("#atlas-map").boundingBox();
  if (profile === "escritorio") {
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.keyboard.down("Control");
    await p.mouse.wheel(0, -400);
    await p.keyboard.up("Control");
  } else {
    const cdp = await p.context().newCDPSession(p);
    const cx = box.x + box.width / 2,
      cy = box.y + box.height / 2;
    const touch = (type, d) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }],
      });
    await touch("touchStart", 30);
    for (let d = 40; d <= 130; d += 15) await touch("touchMove", d);
    await touch("touchEnd", 0);
  }
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => atlas.camera.zoom);
  check(`[${profile}] ${profile === "escritorio" ? "Ctrl + rueda" : "pellizco"} amplía el mapa`, after > before * 1.3, `${before.toFixed(2)} → ${after.toFixed(2)}`);

  // Puzles: dominó con opciones en el HUD y nueva ronda.
  await p.goto(`${base}/capitales/#puzzles`);
  await p.click('[data-puzzle-mode="pair"]');
  const options = await p.locator("#view-puzzles .mk-hud-bottom .puzzle-answer").count();
  check(`[${profile}] el dominó muestra 4 capitales sobre el mapa`, options === 4, String(options));
  await p.locator("#view-puzzles .mk-hud-bottom .puzzle-answer").first().click();
  check(`[${profile}] responder muestra el resultado y «Siguiente»`, await p.locator('#view-puzzles .mk-hud-bottom [data-hud="next"]').isVisible());
  await shot(p, `${profile}-capitales-domino`);

  // Relieve: expedición, HUD y taller.
  for (const view of ["map", "play", "errors", "progress", "puzzles"]) {
    await p.goto(`${base}/relieve/#${view}`);
    await p.waitForTimeout(350);
    const active = await p.evaluate(() => document.querySelector(".view.active")?.id);
    check(`[${profile}] relieve #${view} abre su vista`, active === "view-" + view, active);
    await shot(p, `${profile}-relieve-${view}`);
  }
  await p.goto(`${base}/relieve/#play`);
  await p.click('#view-play [data-hud="start"]');
  const prompt = await p.locator("#view-play .mk-hud-top").innerText();
  check(`[${profile}] la pregunta de la expedición está sobre el mapa`, prompt.includes("1/10"), prompt.replace(/\s+/g, " "));
  await p.locator("#quiz-map .feature-target").first().click();
  check(`[${profile}] marcar en el mapa responde y ofrece «Siguiente»`, await p.locator('#view-play [data-hud="next"]').isVisible());
  await shot(p, `${profile}-relieve-respuesta`);
  await p.goto(`${base}/relieve/?tema=montanas#puzzles`);
  await p.click('[data-workshop="summit"]');
  await p.locator("#view-puzzles .mk-hud-bottom [data-workshop-answer]").first().click();
  check(`[${profile}] el taller de relieve responde desde el HUD`, await p.locator('#view-puzzles [data-hud="next"]').isVisible());

  // Relieve: dos juegos separados y nuevas mecánicas.
  await p.goto(`${base}/relieve/?tema=rios#map`);
  await p.waitForTimeout(300);
  const onlyRivers = await p.evaluate(() => [...document.querySelectorAll("#explore-map [data-id]")].every((el) => el.dataset.id.startsWith("r-")));
  check(`[${profile}] el juego de ríos solo muestra ríos`, onlyRivers);
  await p.goto(`${base}/relieve/?tema=rios#puzzles`);
  await p.waitForTimeout(300);
  const tapTarget = (step) =>
    p.evaluate((step) => {
      const name = document.querySelector("#view-puzzles .mk-question em").textContent;
      const f = DATA.features.find((x) => nameOf(x) === name);
      const [x, y] = project(step === "outlet" ? f.points.at(-1) : f.points[0]),
        c = cams.workshop,
        svg = document.getElementById("workshop-svg"),
        r = svg.getBoundingClientRect();
      svg.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: r.left + r.width / 2 + (x - c.cx) / c.s, clientY: r.top + r.height / 2 + (y - c.cy) / c.s }));
      return f.id;
    }, step);
  const river = await tapTarget("source");
  await tapTarget("outlet");
  const traced = await p.locator("#view-puzzles .mk-hud-bottom").innerText();
  const evidence = await p.evaluate((id) => JSON.parse(localStorage.getItem("atlas-quest-europe-relief-v1")).items[id], river);
  check(`[${profile}] rastreador: tocar nacimiento y desembocadura sin marcadores cuenta como evidencia`, /primera/.test(traced) && evidence?.correct === 1, river);
  await p.click('[data-workshop="basin"]');
  await p.locator("#view-puzzles .mk-hud-bottom [data-workshop-answer]").nth(2).click();
  check(`[${profile}] vertientes: elegir un mar explica dónde desemboca`, /Desemboca|isurtzen/.test(await p.locator("#view-puzzles .mk-hud-bottom").innerText()));
  await p.goto(`${base}/relieve/?tema=montanas#puzzles`);
  await p.click('[data-workshop="cordada"]');
  await p.evaluate(() => document.querySelector('#workshop-svg [data-range="m-urales"] .feature-hit').dispatchEvent(new MouseEvent("click", { bubbles: true })));
  check(`[${profile}] cumbre y cordillera: tocar una cordillera en el mapa responde`, /Urales|Ural/.test(await p.locator("#view-puzzles .mk-hud-bottom").innerText()));
  await p.click('[data-workshop="order"]');
  for (let i = 0; i < 4; i++) await p.locator("#view-puzzles .mk-hud-bottom [data-workshop-answer]:not([disabled])").first().click();
  check(`[${profile}] ordena alturas: muestra el perfil de las cumbres`, await p.locator("#view-puzzles .mk-hud-bottom .profile-chart").isVisible());
  await shot(p, `${profile}-relieve-ordena`);

  // Portal: muestra el progreso guardado por los juegos.
  await p.goto(`${base}/`);
  await p.waitForTimeout(200);
  check(`[${profile}] el portal resume el progreso de ríos y de montañas`, (await p.locator("#riv-progress").isVisible()) && (await p.locator("#mnt-progress").isVisible()));
  await shot(p, `${profile}-portal`);

  const keys = await p.evaluate(() => Object.keys(localStorage).sort());
  check(`[${profile}] se conservan las claves de progreso`, keys.includes("atlas.capitales.v1") && keys.includes("atlas-quest-europe-relief-v1"), keys.join(", "));
  check(`[${profile}] sin errores de consola`, p.errors.length === 0, p.errors.join(" | "));
  await p.context().close();
}
// Euskera en Capitales: interfaz, nombres, respuestas y persistencia del idioma.
{
  const p = await page(browser, "móvil");
  await p.goto(`${base}/capitales/#hoy`);
  await p.click("#lang-eu");
  check("[euskera] la navegación cambia de idioma", (await p.locator('.mobile-nav [data-view="hoy"]').innerText()).includes("Ikasi"));
  const card = await p.evaluate(() => ({ key: currentKey(), eu: COUNTRIES_EU[currentKey().split(":")[0]], front: dom("front-content").textContent }));
  check("[euskera] la tarjeta muestra el nombre en euskera", card.front === card.eu[card.key.endsWith(":pc") ? 0 : 1], `${card.front}`);
  const accepted = await p.evaluate(() => {
    const c = currentCard();
    return isMatch(COUNTRIES_EU[c.id][c.dir === "pc" ? 1 : 0], c) && isMatch(c.dir === "pc" ? c.capital : c.name, c);
  });
  check("[euskera] se aceptan respuestas en euskera y en castellano", accepted);
  await p.goto(`${base}/capitales/#mapa`);
  await p.reload();
  await p.click("#map-challenge-btn");
  const prompt = await p.locator("#view-mapa .mk-hud-top").innerText();
  check("[euskera] el idioma se recuerda y el desafío pregunta en euskera", prompt.includes("Aurkitu"), prompt.replace(/\s+/g, " "));
  await shot(p, "euskera-capitales-desafio");
  await p.goto(`${base}/`);
  check("[euskera] el portal sigue el idioma elegido", (await p.locator("#heading").innerText()).startsWith("Ikasi"));
  await p.goto(`${base}/capitales/#hoy`);
  await p.click("#lang-es");
  check("[euskera] volver a castellano restaura los textos", (await p.locator('.mobile-nav [data-view="hoy"]').innerText()).includes("Estudiar"));
  check("[euskera] sin errores de consola", p.errors.length === 0, p.errors.join(" | "));
  await p.context().close();
}

// Sin conexión: tras una visita, los tres juegos abren sin red.
{
  const p = await page(browser, "escritorio");
  await p.goto(`${base}/`);
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForTimeout(500);
  await p.context().setOffline(true);
  for (const [url, view] of [["/capitales/#puzzles", "view-puzzles"], ["/relieve/#play", "view-play"]]) {
    await p.goto(base + url).catch(() => {});
    await p.waitForTimeout(400);
    check(`[sin conexión] ${url} funciona sin red`, (await p.evaluate(() => document.querySelector(".view.active")?.id)) === view);
  }
  await p.goto(`${base}/`).catch(() => {});
  check("[sin conexión] el portal funciona sin red", (await p.title()).includes("Atlas Quest"));
  await p.context().close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones superadas`);
process.exit(failed.length ? 1 : 0);
