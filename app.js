/* =========================================================
   Cotizador por áreas — HTML, CSS y JS sin dependencias.
   Datos en localStorage (clave: cotizador.db.v1).
   ========================================================= */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $("#app");

/* ---------- Utilidades ---------- */

const KEY = "cotizador.comfamiliar.v2";
const LOGO = "assets/logo-comfamiliar.png";
const load = (k, d) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }
  catch { return d; }
};
const store = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); }
  catch { toast("Almacenamiento lleno"); }
};
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
const isoToDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtDate = (iso) => iso
  ? isoToDate(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })
  : "—";
const fmtShort = (ts) => new Date(ts).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
const fmtDateTime = (ts) => new Date(ts).toLocaleString("es-CO", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});
function addDays(iso, days) {
  if (!iso) return "—";
  const d = isoToDate(iso);
  d.setDate(d.getDate() + num(days));
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}
function money(v, moneda = "COP") {
  const dec = moneda === "COP" ? 0 : 2;
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency", currency: moneda, minimumFractionDigits: dec, maximumFractionDigits: dec,
    }).format(v);
  } catch { return Number(v).toFixed(dec); }
}
const pct = (v) => `${num(v).toLocaleString("es-CO")} %`;

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ---------- Datos ---------- */

const EMPRESA_BASE = { nombre: "", nit: "", telefono: "", email: "", web: "", direccion: "", logo: "" };

const ESTADOS = {
  pendiente: "Pendiente",
  en_proceso: "En cotización",
  cotizada: "Cotizada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};
const badge = (e) => `<span class="badge st-${e}">${ESTADOS[e] || e}</span>`;

function seed() {
  // Precios en 0: cada área los define en su catálogo.
  const mk = (nombre, descripcion, catalogo) => ({
    id: uid(), nombre, descripcion, responsable: "", email: "",
    catalogo: catalogo.map(([n, u]) => ({ id: uid(), nombre: n, unidad: u, precio: 0 })),
  });
  return {
    empresa: { ...EMPRESA_BASE, nombre: "Comfamiliar Risaralda", web: "www.comfamiliar.com", logo: LOGO },
    areas: [
      mk("Recreación y Turismo", "Parque Consotá y planes", [
        ["Pasadía Parque Consotá", "Persona"],
        ["Plan vacacional", "Plan"],
        ["Alojamiento", "Noche"],
      ]),
      mk("Eventos y Convenciones", "Salones y logística", [
        ["Alquiler de salón", "Día"],
        ["Ayudas audiovisuales", "Día"],
        ["Estación de café", "Persona"],
      ]),
      mk("Alimentos y Bebidas", "Refrigerios y menús", [
        ["Refrigerio", "Persona"],
        ["Almuerzo", "Persona"],
      ]),
      mk("Educación", "Colegio e idiomas", [
        ["Curso de idiomas", "Curso"],
        ["Programa académico", "Programa"],
      ]),
      mk("Capacitación Empresarial", "Formación para empresas", [
        ["Curso o taller a la medida", "Curso"],
        ["Diplomado", "Persona"],
      ]),
      mk("Salud", "Salud ocupacional", [
        ["Exámenes ocupacionales", "Persona"],
        ["Jornada de salud", "Jornada"],
      ]),
      mk("Cultura", "Talleres y presentaciones", [
        ["Taller artístico", "Curso"],
        ["Presentación cultural", "Evento"],
      ]),
      mk("Deportes", "Escuelas y torneos", [
        ["Escuela deportiva", "Mes"],
        ["Torneo empresarial", "Torneo"],
      ]),
    ],
    solicitudes: [],
    seq: { sol: 0, cot: 0 },
  };
}

let db = load(KEY, null) || seed();
db.empresa = { ...EMPRESA_BASE, nombre: "Comfamiliar Risaralda", web: "www.comfamiliar.com", logo: LOGO };
db.seq ??= { sol: 0, cot: 0 };
const saveDb = () => store(KEY, db);
saveDb();

const getArea = (id) => db.areas.find((a) => a.id === id);
const getSol = (id) => db.solicitudes.find((s) => s.id === id);
const newestFirst = (a, b) => b.creada - a.creada;

function nextSeq(k, prefix) {
  db.seq[k] = (db.seq[k] || 0) + 1;
  return `${prefix}-${new Date().getFullYear()}-${String(db.seq[k]).padStart(4, "0")}`;
}

function setEstado(s, estado, nota = "") {
  if (s.estado === estado) return;
  s.estado = estado;
  s.eventos.push({ fecha: Date.now(), estado, nota });
}

const nuevoItem = () => ({ id: uid(), desc: "", cant: 1, unidad: "Und", precio: 0, dcto: 0 });

function nuevaCotizacion(s, a) {
  const sol = s.solicitante;
  return {
    numero: nextSeq("cot", "COT"),
    fecha: today(),
    validez: 30,
    moneda: "COP",
    iva: 19,
    retencion: 0,
    descuentoGlobal: 0,
    cliente: {
      nombre: sol.dependencia || sol.nombre,
      contacto: sol.dependencia ? sol.nombre : "",
      nit: "", email: sol.email, telefono: sol.telefono, direccion: "",
    },
    items: s.items.length
      ? s.items.map((it) => {
          const c = a?.catalogo.find((x) => x.id === it.catId);
          return { id: uid(), desc: it.desc, cant: it.cant, unidad: it.unidad, precio: c?.precio || 0, dcto: 0 };
        })
      : [nuevoItem()],
    formaPago: "50 % anticipo, 50 % contra entrega",
    entrega: "",
    notas: "",
  };
}

function calc(q) {
  const lines = q.items.map((it) => {
    const bruto = num(it.cant) * num(it.precio);
    return { ...it, bruto, neto: bruto - bruto * num(it.dcto) / 100 };
  });
  const subtotal = lines.reduce((a, l) => a + l.neto, 0);
  const descLineas = lines.reduce((a, l) => a + (l.bruto - l.neto), 0);
  const dg = subtotal * num(q.descuentoGlobal) / 100;
  const base = subtotal - dg;
  const iva = base * num(q.iva) / 100;
  const ret = base * num(q.retencion) / 100;
  return { lines, subtotal, descLineas, dg, base, iva, ret, total: base + iva - ret };
}

/* ---------- Enlace de formularios ---------- */
// Los campos con data-bind="raiz.ruta" escriben en ctx[raiz].ruta y guardan solos.

const ctx = {};
let view = {};

const getPath = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);
function setPath(obj, path, val) {
  const keys = path.split(".");
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), obj)[last] = val;
}
function fillBinds(root = app) {
  $$("[data-bind]", root).forEach((el) => { el.value = getPath(ctx, el.dataset.bind) ?? ""; });
}

document.addEventListener("input", (e) => {
  const el = e.target;
  const path = el.dataset?.bind;
  if (!path) return;
  const isNum = el.type === "number" || el.dataset.type === "number";
  setPath(ctx, path, isNum ? num(el.value) : el.value);
  if (!path.startsWith("tmp.")) saveDb();
  view.onChange?.(path, el);
});

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const fn = view.actions?.[b.dataset.act] || globalActions[b.dataset.act];
  if (fn) { e.preventDefault(); fn(b, e); }
});

const globalActions = {
  "new-area": () => openAreaDialog(),
  salir: () => { localStorage.removeItem(SESION); checkLogin(); },
};

/* ---------- Ingreso ---------- */
// Pantalla de entrada local (sin servidor): solo el botón «Ingresar».

const SESION = "cotizador.sesion";
function checkLogin() {
  const ok = !!load(SESION, null);
  document.body.classList.toggle("locked", !ok);
  $("#login").hidden = ok;
  return ok;
}
$("#formLogin").addEventListener("submit", (e) => {
  e.preventDefault();
  store(SESION, { t: Date.now() });
  checkLogin();
  route();
});

/* ---------- Router ---------- */

const views = {
  areas: viewAreas,
  area: viewArea,
  solicitar: viewSolicitar,
  solicitudes: viewSolicitudes,
  solicitud: viewSolicitud,
};
const navOf = { area: "areas", solicitud: "solicitudes" };

function route() {
  const [name = "areas", id] = location.hash.replace(/^#\/?/, "").split("/");
  const fn = views[name] || viewAreas;
  view = {};
  const nav = navOf[name] ?? name;
  $$("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === nav));
  fn(id ? decodeURIComponent(id) : undefined);
  renderChrome();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

function renderChrome() {
  const pend = db.solicitudes.filter((s) => s.estado === "pendiente").length;
  $("#navCount").textContent = pend || "";
}

function notFound() {
  app.innerHTML = `<div class="page narrow"><p class="empty">No encontrado · <a href="#/areas">Volver</a></p></div>`;
}

/* ---------- Vista: Áreas ---------- */

function viewAreas() {
  app.innerHTML = `
    <div class="page">
      <div class="page-head">
        <h1>¿Qué área necesitas?</h1>
        <button class="ghost small" data-act="new-area">+ Área</button>
      </div>
      <div class="area-grid">${db.areas.map(areaCard).join("")}</div>
    </div>`;
}

function areaCard(a) {
  const sols = db.solicitudes.filter((s) => s.areaId === a.id);
  const pend = sols.filter((s) => s.estado === "pendiente").length;
  return `
    <article class="area-card">
      <a class="area-link" href="#/solicitar/${a.id}">
        <h2>${esc(a.nombre)}</h2>
        ${a.descripcion ? `<p class="area-desc">${esc(a.descripcion)}</p>` : ""}
        <span class="area-go">Solicitar →</span>
      </a>
      <a class="area-sub" href="#/area/${a.id}">Bandeja${sols.length ? ` · ${sols.length}` : ""}${pend ? ` <b>${pend}</b>` : ""}</a>
    </article>`;
}

/* ---------- Área: crear / editar ---------- */

function openAreaDialog(a) {
  const f = $("#formArea");
  f.reset();
  $("#dlgAreaTitle").textContent = a ? "Editar área" : "Nueva área";
  f.dataset.id = a?.id || "";
  f.elements.nombre.value = a?.nombre || "";
  f.elements.descripcion.value = a?.descripcion || "";
  f.elements.responsable.value = a?.responsable || "";
  f.elements.email.value = a?.email || "";
  $("#dlgArea").showModal();
}

$("#formArea").addEventListener("submit", (e) => {
  if (e.submitter?.value !== "ok") return;
  const f = e.target;
  const data = {
    nombre: f.elements.nombre.value.trim(),
    descripcion: f.elements.descripcion.value.trim(),
    responsable: f.elements.responsable.value.trim(),
    email: f.elements.email.value.trim(),
  };
  if (f.dataset.id) {
    Object.assign(getArea(f.dataset.id), data);
    toast("Área actualizada");
  } else {
    const a = { id: uid(), ...data, catalogo: [] };
    db.areas.push(a);
    toast("Área creada");
    saveDb();
    location.hash = `#/area/${a.id}`;
    return;
  }
  saveDb();
  route();
});

/* ---------- Vista: Detalle de área ---------- */

function viewArea(id) {
  const a = getArea(id);
  if (!a) return notFound();
  ctx.area = a;
  let filtro = "todas";

  app.innerHTML = `
    <div class="page">
      <a class="back" href="#/areas">← Áreas</a>
      <div class="page-head">
        <div>
          <h1>${esc(a.nombre)}</h1>
          ${[a.responsable, a.email].filter(Boolean).length
            ? `<p class="muted">${[a.responsable, a.email].filter(Boolean).map(esc).join(" · ")}</p>` : ""}
        </div>
        <div class="head-actions">
          <button class="ghost" data-act="edit-area" title="Editar">✎</button>
          <button class="ghost danger-ghost" data-act="del-area" title="Eliminar">🗑</button>
          <a class="btn primary" href="#/solicitar/${a.id}">Solicitar cotización</a>
        </div>
      </div>

      <div class="two-col">
        <section class="panel">
          <div class="panel-head">
            <h2>Solicitudes</h2>
            <div class="chips" id="chips"></div>
          </div>
          <div id="bandeja"></div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Servicios</h2></div>
          <div class="cat-head"><span>Servicio</span><span>Unidad</span><span>Precio</span><span></span></div>
          <div id="catalogo"></div>
          <button class="add" data-act="add-cat">+ Servicio</button>
        </section>
      </div>
    </div>`;

  const sols = () => db.solicitudes.filter((s) => s.areaId === a.id).sort(newestFirst);

  function renderBandeja() {
    const all = sols();
    const opts = [["todas", "Todas", all.length], ...Object.entries(ESTADOS)
      .map(([k, l]) => [k, l, all.filter((s) => s.estado === k).length])
      .filter(([, , n]) => n)];
    $("#chips").innerHTML = opts.map(([k, l, n]) =>
      `<button class="chip ${filtro === k ? "on" : ""}" data-act="chip" data-f="${k}">${l} ${n}</button>`).join("");
    const list = filtro === "todas" ? all : all.filter((s) => s.estado === filtro);
    $("#bandeja").innerHTML = solList(list, { area: false });
  }

  function renderCatalogo() {
    $("#catalogo").innerHTML = a.catalogo.length
      ? a.catalogo.map((c, i) => `
        <div class="cat-row">
          <input data-bind="area.catalogo.${i}.nombre" placeholder="Servicio">
          <input data-bind="area.catalogo.${i}.unidad" placeholder="Und">
          <input data-bind="area.catalogo.${i}.precio" type="number" min="0" step="any" placeholder="0">
          <button class="icon" data-act="del-cat" data-i="${i}" title="Quitar">✕</button>
        </div>`).join("")
      : `<p class="empty">—</p>`;
    fillBinds($("#catalogo"));
  }

  view.actions = {
    chip: (b) => { filtro = b.dataset.f; renderBandeja(); },
    "edit-area": () => openAreaDialog(a),
    "del-area": () => {
      const n = db.solicitudes.filter((s) => s.areaId === a.id).length;
      if (n) return toast(`Tiene ${n} solicitud(es); no se puede eliminar`);
      if (!confirm(`¿Eliminar el área ${a.nombre}?`)) return;
      db.areas = db.areas.filter((x) => x.id !== a.id);
      saveDb();
      location.hash = "#/areas";
    },
    "add-cat": () => {
      a.catalogo.push({ id: uid(), nombre: "", unidad: "Und", precio: 0 });
      saveDb();
      renderCatalogo();
      $("#catalogo .cat-row:last-child input")?.focus();
    },
    "del-cat": (b) => {
      a.catalogo.splice(Number(b.dataset.i), 1);
      saveDb();
      renderCatalogo();
    },
  };

  renderBandeja();
  renderCatalogo();
}

/* ---------- Lista de solicitudes (compartida) ---------- */

function solList(list, { area: showArea = true } = {}) {
  if (!list.length) return `<p class="empty">Sin solicitudes</p>`;
  return `<div class="sol-list">${list.map((s) => {
    const a = getArea(s.areaId);
    const total = s.cotizacion ? money(calc(s.cotizacion).total, s.cotizacion.moneda) : "—";
    return `
      <a class="sol-row" href="#/solicitud/${s.id}">
        <span class="chk ${s.estado === "aprobada" ? "on" : ""}"></span>
        <div class="sol-main">
          <strong>${esc(s.asunto)}</strong>
          <span>
            ${showArea && a ? `${esc(a.nombre)} ·` : ""}
            ${esc(s.solicitante.nombre)} · ${fmtShort(s.creada)}
          </span>
        </div>
        <div class="sol-meta">${badge(s.estado)}</div>
        <div class="sol-total">${total}</div>
      </a>`;
  }).join("")}</div>`;
}

/* ---------- Vista: Solicitar cotización (asistente por pasos) ---------- */

function viewSolicitar(areaId) {
  if (!db.areas.length) {
    app.innerHTML = `<div class="page narrow"><p class="empty">No hay áreas · <a href="#" data-act="new-area">Crear una</a></p></div>`;
    return;
  }
  const req = {
    areaId: getArea(areaId) ? areaId : "",
    solicitante: { nombre: "", dependencia: "", email: "", telefono: "" },
    asunto: "", detalle: "", fechaRequerida: "", presupuesto: "",
    items: {}, // catId -> cantidad
  };
  ctx.tmp = { req };

  const STEPS = [
    { key: "area", label: "Área" },
    { key: "servicios", label: "Servicios", skip: () => !getArea(req.areaId)?.catalogo.length },
    { key: "necesidad", label: "Necesidad" },
    { key: "datos", label: "Tus datos" },
    { key: "confirmar", label: "Confirmar" },
  ];
  const steps = () => STEPS.filter((s) => !s.skip?.());
  let step = req.areaId ? 1 : 0;
  let maxStep = step;

  app.innerHTML = `
    <div class="page narrow">
      <a class="back" href="#/areas">← Áreas</a>
      <div class="page-head"><h1>Solicitar cotización</h1></div>
      <ol class="stepper" id="stepper"></ol>
      <form id="wizard" class="wizard" autocomplete="on">
        <div id="stepBody"></div>
        <div class="wizard-foot">
          <button type="button" data-act="prev" id="btnPrev">← Atrás</button>
          <button type="submit" class="primary" id="btnNext"></button>
        </div>
      </form>
    </div>`;

  const bodies = {
    area: () => `
      <h2 class="step-title">¿A qué área?</h2>
      <div class="area-choices">${db.areas.map((a) => `
        <button type="button" class="area-choice ${req.areaId === a.id ? "on" : ""}"
                data-act="pick-area" data-id="${a.id}">${esc(a.nombre)}</button>`).join("")}
      </div>`,

    servicios: () => {
      const a = getArea(req.areaId);
      return `
        <h2 class="step-title">¿Qué servicios?</h2>
        <div class="pick">${a.catalogo.map((c) => {
          const on = c.id in req.items;
          return `
            <label class="pick-row ${on ? "on" : ""}">
              <input type="checkbox" data-cat="${c.id}" ${on ? "checked" : ""}>
              <span>${esc(c.nombre) || "—"}</span>
              <span class="price">${num(c.precio) ? `${money(num(c.precio))} / ` : ""}${esc(c.unidad)}</span>
              <input type="number" min="1" step="any" data-qty="${c.id}" value="${on ? req.items[c.id] : 1}"
                     ${on ? "" : "disabled"} aria-label="Cantidad">
            </label>`;
        }).join("")}</div>`;
    },

    necesidad: () => `
      <h2 class="step-title">¿Qué necesitas?</h2>
      <div class="grid">
        <label class="span-2">Asunto *
          <input data-bind="tmp.req.asunto" required>
        </label>
        <label class="span-2">Detalle
          <textarea data-bind="tmp.req.detalle" rows="4"></textarea>
        </label>
        <label>Fecha requerida
          <input data-bind="tmp.req.fechaRequerida" type="date" min="${today()}">
        </label>
        <label>Presupuesto
          <input data-bind="tmp.req.presupuesto" type="number" min="0" step="any">
        </label>
      </div>`,

    datos: () => `
      <h2 class="step-title">Tus datos</h2>
      <div class="grid">
        <label>Nombre *
          <input data-bind="tmp.req.solicitante.nombre" required autocomplete="name">
        </label>
        <label>Dependencia
          <input data-bind="tmp.req.solicitante.dependencia" autocomplete="organization">
        </label>
        <label>Correo *
          <input data-bind="tmp.req.solicitante.email" type="email" required autocomplete="email">
        </label>
        <label>Teléfono
          <input data-bind="tmp.req.solicitante.telefono" type="tel" autocomplete="tel">
        </label>
      </div>`,

    confirmar: () => {
      const a = getArea(req.areaId);
      const sol = req.solicitante;
      const servicios = Object.entries(req.items).map(([id, cant]) => {
        const c = a.catalogo.find((x) => x.id === id);
        return c ? `${cant} × ${c.nombre}` : "";
      }).filter(Boolean).join("\n");
      const filas = [
        ["Área", a.nombre],
        ["Servicios", servicios],
        ["Asunto", req.asunto],
        ["Detalle", req.detalle],
        ["Para", req.fechaRequerida && fmtDate(req.fechaRequerida)],
        ["Presupuesto", num(req.presupuesto) && money(num(req.presupuesto))],
        ["Solicitante", [sol.nombre, sol.dependencia].filter(Boolean).join(" · ")],
        ["Contacto", [sol.email, sol.telefono].filter(Boolean).join(" · ")],
      ].filter(([, v]) => v);
      return `
        <h2 class="step-title">Confirma</h2>
        <dl class="info summary">${filas.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
    },
  };

  function render() {
    const list = steps();
    step = Math.min(step, list.length - 1);
    const cur = list[step];
    $("#stepper").innerHTML = list.map((s, i) => `
      <li class="${i === step ? "now" : i < step ? "done" : ""}">
        <button type="button" data-act="goto" data-i="${i}" ${i > maxStep ? "disabled" : ""}>
          <span class="n">${i < step ? "✓" : i + 1}</span><span class="l">${s.label}</span>
        </button>
      </li>`).join("");
    $("#stepBody").innerHTML = bodies[cur.key]();
    fillBinds($("#stepBody"));
    $("#btnPrev").style.visibility = step === 0 ? "hidden" : "visible";
    $("#btnNext").textContent = cur.key === "confirmar" ? "Enviar solicitud" : "Siguiente →";
    $("#stepBody input:not([type=checkbox]), #stepBody textarea")?.focus();
  }

  function goTo(i) {
    step = i;
    maxStep = Math.max(maxStep, step);
    render();
    window.scrollTo(0, 0);
  }

  // Servicios: marcar y cantidad
  $("#stepBody").addEventListener("change", (e) => {
    const id = e.target.dataset.cat;
    if (!id) return;
    const qty = $(`[data-qty="${id}"]`);
    if (e.target.checked) req.items[id] = num(qty.value) || 1;
    else delete req.items[id];
    qty.disabled = !e.target.checked;
    e.target.closest(".pick-row").classList.toggle("on", e.target.checked);
  });
  $("#stepBody").addEventListener("input", (e) => {
    const id = e.target.dataset.qty;
    if (id && id in req.items) req.items[id] = num(e.target.value) || 1;
  });

  view.actions = {
    "pick-area": (b) => {
      if (req.areaId !== b.dataset.id) {
        req.areaId = b.dataset.id;
        req.items = {};
        maxStep = 0;
      }
      goTo(1);
    },
    prev: () => goTo(Math.max(0, step - 1)),
    goto: (b) => goTo(Number(b.dataset.i)),
  };

  // "Siguiente" valida el paso visible (validación nativa) y avanza; en el último, envía.
  $("#wizard").addEventListener("submit", (e) => {
    e.preventDefault();
    const list = steps();
    const cur = list[step].key;
    if (cur === "area" && !req.areaId) return toast("Elige un área");
    if (cur !== "confirmar") return goTo(step + 1);

    const idx = (k) => steps().findIndex((s) => s.key === k);
    if (!req.asunto.trim()) return goTo(idx("necesidad"));
    if (!req.solicitante.nombre.trim() || !req.solicitante.email.trim()) return goTo(idx("datos"));
    enviar();
  });

  function enviar() {
    const a = getArea(req.areaId);
    const s = {
      id: uid(),
      numero: nextSeq("sol", "SOL"),
      areaId: a.id,
      creada: Date.now(),
      estado: "pendiente",
      solicitante: { ...req.solicitante },
      asunto: req.asunto.trim(),
      detalle: req.detalle.trim(),
      fechaRequerida: req.fechaRequerida,
      presupuesto: num(req.presupuesto),
      items: Object.entries(req.items).map(([catId, cant]) => {
        const c = a.catalogo.find((x) => x.id === catId);
        return c && { catId, desc: c.nombre, cant, unidad: c.unidad };
      }).filter(Boolean),
      cotizacion: null,
      eventos: [{ fecha: Date.now(), estado: "pendiente", nota: "Creada" }],
    };
    db.solicitudes.push(s);
    saveDb();
    renderChrome();
    app.innerHTML = `
      <div class="page narrow">
        <div class="success">
          <div class="tick">✓</div>
          <h1>Solicitud enviada</h1>
          <p class="muted">${esc(s.numero)} · ${esc(a.nombre)}</p>
          <div class="head-actions">
            <a class="btn" href="#/solicitud/${s.id}">Ver solicitud</a>
            <a class="btn primary" href="#/areas">Listo</a>
          </div>
        </div>
      </div>`;
  }

  render();
}

/* ---------- Vista: Todas las solicitudes ---------- */

const filtros = { area: "", estado: "", q: "" };

function viewSolicitudes() {
  ctx.tmp = { f: filtros };
  app.innerHTML = `
    <div class="page">
      <div class="page-head"><h1>Solicitudes</h1></div>
      <div class="filters">
        <input type="search" data-bind="tmp.f.q" placeholder="Buscar…">
        <select data-bind="tmp.f.area">
          <option value="">Todas las áreas</option>
          ${db.areas.map((a) => `<option value="${a.id}">${esc(a.nombre)}</option>`).join("")}
        </select>
      </div>
      <div class="chips chips-row" id="chipsEstado"></div>
      <div id="lista"></div>
    </div>`;

  function renderLista() {
    const porArea = db.solicitudes.filter((s) => !filtros.area || s.areaId === filtros.area);
    const opts = [["", "Todas", porArea.length], ...Object.entries(ESTADOS)
      .map(([k, l]) => [k, l, porArea.filter((s) => s.estado === k).length]).filter(([, , n]) => n)];
    if (!opts.some(([k]) => k === filtros.estado)) filtros.estado = "";
    $("#chipsEstado").innerHTML = opts.map(([k, l, n]) =>
      `<button class="chip ${filtros.estado === k ? "on" : ""}" data-act="chip-estado" data-f="${k}">${l} ${n}</button>`).join("");
    const q = filtros.q.trim().toLowerCase();
    const list = db.solicitudes
      .filter((s) => !filtros.area || s.areaId === filtros.area)
      .filter((s) => !filtros.estado || s.estado === filtros.estado)
      .filter((s) => !q || `${s.numero} ${s.asunto} ${s.solicitante.nombre} ${s.solicitante.dependencia}`
        .toLowerCase().includes(q))
      .sort(newestFirst);
    $("#lista").innerHTML = solList(list);
  }
  view.onChange = renderLista;
  view.actions = { "chip-estado": (b) => { filtros.estado = b.dataset.f; renderLista(); } };
  fillBinds();
  renderLista();
}

/* ---------- Vista: Solicitud + cotización ---------- */

function viewSolicitud(id) {
  const s = getSol(id);
  if (!s) return notFound();
  const a = getArea(s.areaId) || { nombre: "Área eliminada", catalogo: [] };
  ctx.sol = s;
  ctx.q = s.cotizacion;
  const q = s.cotizacion;

  const info = [
    ["Solicitante", s.solicitante.nombre],
    ["Dependencia", s.solicitante.dependencia],
    ["Correo", s.solicitante.email],
    ["Teléfono", s.solicitante.telefono],
    ["Para", s.fechaRequerida && fmtDate(s.fechaRequerida)],
    ["Presupuesto", s.presupuesto && money(s.presupuesto)],
    ["Detalle", s.detalle],
    ["Servicios", s.items.map((i) => `${i.cant} × ${i.desc}`).join("\n")],
  ].filter(([, v]) => v);

  app.innerHTML = `
    <div class="page wide">
      <a class="back" href="#/area/${s.areaId}">← ${esc(a.nombre)}</a>
      <div class="page-head">
        <div>
          <h1>${esc(s.asunto)}</h1>
          <p class="muted">${esc(s.numero)} · ${fmtDateTime(s.creada)}</p>
        </div>
        <div class="head-actions">${badge(s.estado)}${accionesSolicitud(s, q)}</div>
      </div>

      <div class="layout">
        <section class="editor">
          <details class="card" ${q ? "" : "open"}>
            <summary>Solicitud</summary>
            <dl class="info">${info.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
            <ul class="timeline">${s.eventos.map((ev) =>
              `<li>${fmtDateTime(ev.fecha)} · ${ESTADOS[ev.estado] || ev.estado}</li>`).join("")}</ul>
            <button class="link-danger" data-act="del-sol">Eliminar solicitud</button>
          </details>
          ${q ? editorCards(a) : ""}
        </section>

        <section class="preview-wrap">
          ${q ? `<article id="preview" class="doc"></article>`
              : `<div class="doc placeholder"><span>Sin cotización</span></div>`}
        </section>
      </div>
    </div>`;

  view.actions = {
    "crear-cot": () => {
      s.cotizacion = nuevaCotizacion(s, a);
      setEstado(s, "en_proceso");
      saveDb();
      viewSolicitud(id);
      renderChrome();
    },
    "del-sol": () => {
      if (!confirm(`¿Eliminar ${s.numero}?`)) return;
      db.solicitudes = db.solicitudes.filter((x) => x.id !== s.id);
      saveDb();
      location.hash = `#/area/${s.areaId}`;
    },
    print: () => {
      const prev = document.title;
      document.title = `${q.numero} - ${q.cliente.nombre || a.nombre}`;
      window.print();
      setTimeout(() => (document.title = prev), 500);
      if (s.estado === "en_proceso" || s.estado === "pendiente") {
        setEstado(s, "cotizada");
        saveDb();
        viewSolicitud(id);
        renderChrome();
      }
    },
    estado: (b) => {
      setEstado(s, b.dataset.to);
      saveDb();
      viewSolicitud(id);
      renderChrome();
    },
    "item-add": () => {
      q.items.push(nuevoItem());
      saveDb(); renderItems(); refresh();
      $(".item:last-child textarea")?.focus();
    },
    "item-del": (b) => {
      const i = itemIndex(b);
      q.items.splice(i, 1);
      if (!q.items.length) q.items.push(nuevoItem());
      saveDb(); renderItems(); refresh();
    },
    "item-up": (b) => moveItem(itemIndex(b), -1),
    "item-down": (b) => moveItem(itemIndex(b), 1),
  };

  if (!q) return;

  const itemIndex = (b) => q.items.findIndex((x) => x.id === b.closest(".item").dataset.id);
  function moveItem(i, d) {
    const j = i + d;
    if (j < 0 || j >= q.items.length) return;
    [q.items[i], q.items[j]] = [q.items[j], q.items[i]];
    saveDb(); renderItems(); refresh();
  }

  function renderItems() {
    $("#items").innerHTML = q.items.map((it, i) => `
      <div class="item" data-id="${it.id}">
        <div class="item-head">
          <textarea data-k="desc" rows="1" placeholder="Descripción">${esc(it.desc)}</textarea>
          <div class="item-tools">
            <button type="button" data-act="item-up" ${i === 0 ? "disabled" : ""}>↑</button>
            <button type="button" data-act="item-down" ${i === q.items.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" data-act="item-del">✕</button>
          </div>
        </div>
        <div class="item-grid">
          <label>Cant.<input data-k="cant" type="number" min="0" step="any" value="${it.cant}"></label>
          <label>Unidad<input data-k="unidad" value="${esc(it.unidad)}"></label>
          <label>Valor unit.<input data-k="precio" type="number" min="0" step="any" value="${it.precio}"></label>
          <label>Dcto. %<input data-k="dcto" type="number" min="0" max="100" step="any" value="${it.dcto}"></label>
          <div class="item-total" data-total></div>
        </div>
      </div>`).join("");
    updateLineTotals();
  }

  function updateLineTotals() {
    calc(q).lines.forEach((l) => {
      const el = $(`.item[data-id="${l.id}"] [data-total]`);
      if (el) el.textContent = money(l.neto, q.moneda);
    });
  }

  function renderMiniTotals() {
    const t = calc(q);
    $("#miniTotals").innerHTML = `
      <dt>Subtotal</dt><dd>${money(t.subtotal, q.moneda)}</dd>
      ${t.dg ? `<dt>Descuento</dt><dd>− ${money(t.dg, q.moneda)}</dd>` : ""}
      <dt>IVA ${pct(q.iva)}</dt><dd>${money(t.iva, q.moneda)}</dd>
      ${t.ret ? `<dt>Retención</dt><dd>− ${money(t.ret, q.moneda)}</dd>` : ""}
      <dt class="grand">Total</dt><dd class="grand">${money(t.total, q.moneda)}</dd>`;
  }

  const refresh = () => { renderMiniTotals(); renderPreview(s, a); };

  $("#items").addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    const it = q.items.find((x) => x.id === e.target.closest(".item").dataset.id);
    it[k] = e.target.type === "number" ? num(e.target.value) : e.target.value;
    saveDb();
    updateLineTotals();
    refresh();
  });

  $("#addCat")?.addEventListener("change", (e) => {
    const c = a.catalogo.find((x) => x.id === e.target.value);
    e.target.value = "";
    if (!c) return;
    const vacio = q.items.length === 1 && !q.items[0].desc && !q.items[0].precio;
    const it = { id: uid(), desc: c.nombre, cant: 1, unidad: c.unidad, precio: num(c.precio), dcto: 0 };
    if (vacio) q.items = [it]; else q.items.push(it);
    saveDb(); renderItems(); refresh();
  });

  view.onChange = (path) => {
    if (path === "q.moneda") updateLineTotals();
    refresh();
  };

  fillBinds();
  renderItems();
  refresh();
}

// Una sola acción principal por estado (ley de Hick)
function accionesSolicitud(s, q) {
  if (!q) return `<button class="primary" data-act="crear-cot">Crear cotización</button>`;
  switch (s.estado) {
    case "cotizada":
      return `<button data-act="print">PDF</button>
        <button class="danger-ghost" data-act="estado" data-to="rechazada">Rechazada</button>
        <button class="primary" data-act="estado" data-to="aprobada">Aprobada</button>`;
    case "aprobada":
      return `<button class="primary" data-act="print">PDF</button>`;
    case "rechazada":
      return `<button data-act="estado" data-to="en_proceso">Reabrir</button>`;
    default:
      return `<button class="primary" data-act="print">Generar PDF</button>`;
  }
}

function editorCards(a) {
  return `
    <details class="card" open>
      <summary>Ítems</summary>
      <div id="items" class="items"></div>
      <div class="add-row">
        <button type="button" class="add" data-act="item-add">+ Ítem</button>
        ${a.catalogo.length ? `
          <select id="addCat" class="add-select" aria-label="Agregar del catálogo">
            <option value="">+ Del catálogo</option>
            ${a.catalogo.map((c) => `<option value="${c.id}">${esc(c.nombre)}${num(c.precio) ? ` · ${money(num(c.precio))}` : ""}</option>`).join("")}
          </select>` : ""}
      </div>
      <dl class="mini-totals" id="miniTotals"></dl>
    </details>

    <details class="card">
      <summary>Cliente</summary>
      <div class="grid">
        <label class="span-2">Nombre<input data-bind="q.cliente.nombre"></label>
        <label>NIT / C.C.<input data-bind="q.cliente.nit"></label>
        <label>Contacto<input data-bind="q.cliente.contacto"></label>
        <label>Correo<input data-bind="q.cliente.email" type="email"></label>
        <label>Teléfono<input data-bind="q.cliente.telefono"></label>
        <label class="span-2">Dirección<input data-bind="q.cliente.direccion"></label>
      </div>
    </details>

    <details class="card">
      <summary>Documento</summary>
      <div class="grid">
        <label>Número<input data-bind="q.numero"></label>
        <label>Fecha<input data-bind="q.fecha" type="date"></label>
        <label>Validez (días)<input data-bind="q.validez" type="number" min="0" step="1"></label>
        <label>Moneda
          <select data-bind="q.moneda">
            <option>COP</option><option>USD</option><option>EUR</option><option>MXN</option>
          </select>
        </label>
        <label>IVA
          <select data-bind="q.iva" data-type="number">
            <option value="19">19 %</option><option value="5">5 %</option><option value="0">0 %</option>
          </select>
        </label>
        <label>Descuento %<input data-bind="q.descuentoGlobal" type="number" min="0" max="100" step="any"></label>
        <label>Retención %<input data-bind="q.retencion" type="number" min="0" max="100" step="any"></label>
      </div>
    </details>

    <details class="card">
      <summary>Condiciones</summary>
      <div class="grid">
        <label class="span-2">Forma de pago<input data-bind="q.formaPago"></label>
        <label class="span-2">Entrega<input data-bind="q.entrega"></label>
        <label class="span-2">Notas<textarea data-bind="q.notas" rows="3"></textarea></label>
      </div>
    </details>`;
}

function renderPreview(s, a) {
  const q = s.cotizacion, e = db.empresa, c = q.cliente, m = q.moneda;
  const t = calc(q);
  const filled = t.lines.filter((l) => l.desc.trim() || l.precio);
  const hayDcto = filled.some((l) => num(l.dcto) > 0);

  const contacto = [e.nit && `NIT ${e.nit}`, e.direccion, e.telefono, e.email, e.web]
    .filter(Boolean).map(esc).join(" · ");
  const filasCliente = [
    ["NIT / C.C.", c.nit], ["Contacto", c.contacto], ["Teléfono", c.telefono],
    ["Correo", c.email], ["Dirección", c.direccion],
  ].filter(([, v]) => v);

  const rows = filled.length
    ? filled.map((l, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="desc">${esc(l.desc) || "—"}</td>
        <td class="num">${num(l.cant).toLocaleString("es-CO")} ${esc(l.unidad)}</td>
        <td class="num">${money(num(l.precio), m)}</td>
        ${hayDcto ? `<td class="num">${num(l.dcto) ? pct(l.dcto) : "—"}</td>` : ""}
        <td class="num">${money(l.neto, m)}</td>
      </tr>`).join("")
    : `<tr class="empty"><td colspan="${hayDcto ? 6 : 5}">—</td></tr>`;

  $("#preview").innerHTML = `
    <header class="doc-head">
      <div class="doc-company">
        ${e.logo ? `<img class="doc-logo" src="${e.logo}" alt="">` : ""}
        <h1>${esc(e.nombre) || "Empresa"}</h1>
        ${contacto ? `<p>${contacto}</p>` : ""}
        <p class="doc-area">${esc(a.nombre)}${a.email ? ` · ${esc(a.email)}` : ""}</p>
      </div>
      <div class="doc-title">
        <h2>COTIZACIÓN</h2>
        <table>
          <tr><td>N.º</td><td>${esc(q.numero)}</td></tr>
          <tr><td>Fecha</td><td>${fmtDate(q.fecha)}</td></tr>
          ${num(q.validez) ? `<tr><td>Válida hasta</td><td>${addDays(q.fecha, q.validez)}</td></tr>` : ""}
          <tr><td>Ref.</td><td>${esc(s.numero)}</td></tr>
        </table>
      </div>
    </header>

    <section class="doc-client">
      <p class="doc-label">Cliente</p>
      <p class="name">${esc(c.nombre) || "—"}</p>
      ${filasCliente.length ? `<div class="cols">${filasCliente
        .map(([k, v]) => `<span><strong>${k}:</strong> ${esc(v)}</span>`).join("")}</div>` : ""}
    </section>

    ${s.asunto ? `<p class="doc-ref"><strong>Asunto:</strong> ${esc(s.asunto)}</p>` : ""}

    <table class="doc-items">
      <thead>
        <tr>
          <th class="num" style="width:32px">#</th>
          <th>Descripción</th>
          <th class="num">Cantidad</th>
          <th class="num">Valor unit.</th>
          ${hayDcto ? `<th class="num">Dcto.</th>` : ""}
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <section class="doc-bottom">
      <div class="doc-terms">
        ${q.formaPago ? `<p class="doc-label">Forma de pago</p><p>${esc(q.formaPago)}</p>` : ""}
        ${q.entrega ? `<p class="doc-label">Entrega</p><p>${esc(q.entrega)}</p>` : ""}
        ${q.notas ? `<p class="doc-label">Notas</p><p>${esc(q.notas)}</p>` : ""}
      </div>
      <table class="doc-totals">
        <tr><td>Subtotal</td><td>${money(t.subtotal + t.descLineas, m)}</td></tr>
        ${t.descLineas ? `<tr><td>Descuentos</td><td class="neg">− ${money(t.descLineas, m)}</td></tr>` : ""}
        ${t.dg ? `<tr><td>Descuento (${pct(q.descuentoGlobal)})</td><td class="neg">− ${money(t.dg, m)}</td></tr>` : ""}
        ${t.descLineas || t.dg ? `<tr><td>Base</td><td>${money(t.base, m)}</td></tr>` : ""}
        <tr><td>IVA (${pct(q.iva)})</td><td>${money(t.iva, m)}</td></tr>
        ${t.ret ? `<tr><td>Retención (${pct(q.retencion)})</td><td class="neg">− ${money(t.ret, m)}</td></tr>` : ""}
        <tr class="grand"><td>Total</td><td>${money(t.total, m)}</td></tr>
      </table>
    </section>

    <footer class="doc-footer">
      <div class="firma">${esc(a.responsable) || "Firma"}<br><small>${esc(a.nombre)}</small></div>
      <small>${esc(m)}</small>
    </footer>`;
}

/* ---------- Inicio ---------- */


checkLogin();
route();
