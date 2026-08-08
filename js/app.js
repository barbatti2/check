import { DB } from "./db.js";

// =====================================================================
// STATE
// =====================================================================
const state = {
  config: null,           // { sectors, questionsBySector }
  rondas: [],              // cached list from DB
  activeRonda: null,       // ronda em andamento (objeto completo)
  currentSectorId: null,   // setor sendo respondido agora
  historyFilter: { from: "", to: "" },
  periodMode: "dia",
  drillFilter: { year: null, month: null },
  pendenciasStatusFilter: "aberta",
  pendenciaTarget: null,   // { sectorId, questionId, questionText }
  observacaoTarget: null,  // { sectorId, questionId, questionText }
  selectedPriority: null,
  editingSectorId: null,   // setor sendo editado em Configurações
};

const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));

const views = {
  home: $("#view-home"),
  history: $("#view-history"),
  pendencias: $("#view-pendencias"),
  roundDetail: $("#view-round-detail"),
  sectors: $("#view-sectors"),
  questions: $("#view-questions"),
  settings: $("#view-settings"),
  sectorEditor: $("#view-sector-editor"),
  summary: $("#view-summary"),
};

const NAV_TAB_VIEWS = new Set(["home", "history", "pendencias", "settings"]);

function showView(name) {
  Object.values(views).forEach((v) => v.classList.add("hidden"));
  views[name].classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  updateBottomNav(name);
}

function updateBottomNav(name) {
  const nav = $("#bottom-nav");
  if (NAV_TAB_VIEWS.has(name)) {
    nav.classList.remove("hidden");
    $all(".bn-item").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  } else {
    nav.classList.add("hidden");
  }
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function toast(msg) {
  const root = $("#toast-root");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// =====================================================================
// DATE HELPERS
// =====================================================================
function fmtDateLong(d) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(d);
}
function fmtDateShort(iso) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function fmtTime(iso) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d);
}
function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

// =====================================================================
// INIT
// =====================================================================
async function init() {
  renderGreeting();
  await DB.init();
  state.config = await DB.getConfig();
  state.rondas = await DB.listRondas();

  const activeId = DB.getActiveRoundId();
  if (activeId) {
    const found = state.rondas.find((r) => r.id === activeId) || (await DB.getRonda(activeId));
    if (found && found.status === "em_andamento") state.activeRonda = found;
    else DB.setActiveRoundId(null);
  }

  renderHome();
  bindEvents();
  registerServiceWorker();
  refreshIcons();
}

function renderGreeting() {
  const now = new Date();
  const h = now.getHours();
  const greet = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  $("#home-greeting").textContent = greet;
  $("#home-date").textContent = fmtDateLong(now);
}

// =====================================================================
// HOME
// =====================================================================
function renderHome() {
  const banner = $("#active-round-banner");
  if (state.activeRonda) {
    banner.classList.remove("hidden");
    const total = activeSectorIds().length;
    const done = state.activeRonda.setoresConcluidos.length;
    $("#active-round-progress-text").textContent = `${done} de ${total} setores concluídos`;
    $("#active-round-progress-fill").style.width = (total ? Math.round((done / total) * 100) : 0) + "%";
    $("#qa-start-label").innerHTML = "Continuar<br/>Ronda";
    $("#qa-start-icon").innerHTML = `<i data-lucide="play"></i>`;
  } else {
    banner.classList.add("hidden");
    $("#qa-start-label").innerHTML = "Iniciar<br/>Ronda";
    $("#qa-start-icon").innerHTML = `<i data-lucide="check"></i>`;
  }
  renderHeroStats();
  renderHistoryPreview();
  refreshIcons();
}

function renderHeroStats() {
  const finished = state.rondas.filter((r) => r.status === "concluida");

  // Média dos últimos 7 dias, comparada aos 7 dias anteriores
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const currentWindow = finished.filter((r) => now - new Date(r.dataInicio).getTime() <= 7 * day);
  const previousWindow = finished.filter((r) => {
    const age = now - new Date(r.dataInicio).getTime();
    return age > 7 * day && age <= 14 * day;
  });
  const avg = currentWindow.length
    ? Math.round(currentWindow.reduce((sum, r) => sum + (r.stats?.pontuacao ?? 0), 0) / currentWindow.length)
    : null;
  const avgPrev = previousWindow.length
    ? Math.round(previousWindow.reduce((sum, r) => sum + (r.stats?.pontuacao ?? 0), 0) / previousWindow.length)
    : null;
  $("#hero-score-value").textContent = avg === null ? "—" : avg + "%";

  const trendEl = $("#hero-trend");
  if (avg !== null && avgPrev !== null) {
    const delta = avg - avgPrev;
    trendEl.classList.remove("hidden", "down");
    if (delta < 0) trendEl.classList.add("down");
    trendEl.innerHTML = `<i data-lucide="${delta >= 0 ? "trending-up" : "trending-down"}"></i>${delta >= 0 ? "+" : ""}${delta}%`;
  } else {
    trendEl.classList.add("hidden");
  }

  // Rondas no mês corrente
  const nowDate = new Date();
  const monthCount = finished.filter((r) => {
    const d = new Date(r.dataInicio);
    return d.getFullYear() === nowDate.getFullYear() && d.getMonth() === nowDate.getMonth();
  }).length;
  $("#stat-month-count").textContent = monthCount;

  // Pendências em aberto (todas as rondas)
  const openPend = finished.reduce(
    (sum, r) => sum + (r.pendencias || []).filter((p) => p.status !== "resolvida").length,
    0
  );
  $("#stat-open-pend").textContent = openPend;

  const badge = $("#bn-pend-badge");
  if (openPend > 0) {
    badge.textContent = openPend > 9 ? "9+" : String(openPend);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

  // Melhor pontuação já registrada
  const best = finished.length ? Math.max(...finished.map((r) => r.stats?.pontuacao ?? 0)) : null;
  $("#stat-best-score").textContent = best === null ? "—" : best + "%";
}

function activeSectorIds() {
  return state.config.sectors.filter((s) => s.ativo).map((s) => s.id);
}

function scoreClass(score) {
  if (score >= 85) return "score-high";
  if (score >= 60) return "score-mid";
  return "score-low";
}

function historyItemHTML(r) {
  const score = r.stats?.pontuacao ?? 0;
  return `
    <div class="history-item" data-id="${r.id}">
      <div class="history-score ${scoreClass(score)}">${score}%</div>
      <div class="history-info">
        <p class="history-date">${fmtDateShort(r.dataInicio)}</p>
        <p class="history-meta">${r.stats?.conformes ?? 0} conformes · ${r.stats?.naoConformes ?? 0} não conformes · ${r.pendencias?.length ?? 0} pendências</p>
      </div>
      <svg class="history-chevron" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>`;
}

function renderHistoryPreview() {
  const finished = state.rondas.filter((r) => r.status === "concluida").slice(0, 4);
  const container = $("#history-preview-list");
  if (!finished.length) {
    container.innerHTML = `<p class="empty-state">Nenhuma ronda concluída ainda.</p>`;
    return;
  }
  container.innerHTML = finished.map(historyItemHTML).join("");
  container.querySelectorAll(".history-item").forEach((el) => {
    el.addEventListener("click", () => openRoundDetail(el.dataset.id));
  });
}

// =====================================================================
// HISTORY (FULL + FILTERS: Dia / Mês / Ano)
// =====================================================================
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function groupItemHTML(label, count, avgScore) {
  return `
    <div class="history-item" data-group="1">
      <div class="history-score ${scoreClass(avgScore)}">${avgScore}%</div>
      <div class="history-info">
        <p class="history-date">${label}</p>
        <p class="history-meta">${count} ${count === 1 ? "ronda" : "rondas"} · média ${avgScore}%</p>
      </div>
      <svg class="history-chevron" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>`;
}

function avgOf(list) {
  if (!list.length) return 0;
  return Math.round(list.reduce((s, r) => s + (r.stats?.pontuacao ?? 0), 0) / list.length);
}

function switchPeriodTab(period, { resetDrill = true } = {}) {
  state.periodMode = period;
  if (resetDrill) state.drillFilter = { year: null, month: null };
  $all("#period-tabs .settings-tab").forEach((t) => t.classList.toggle("active", t.dataset.period === period));
  $("#filter-bar-dia").classList.toggle("hidden", period !== "dia");
  renderHistoryFull();
}

function renderBreadcrumb() {
  const { year, month } = state.drillFilter;
  const bc = $("#history-breadcrumb");
  if (year == null && month == null) {
    bc.classList.add("hidden");
    bc.innerHTML = "";
    return;
  }
  const parts = [];
  if (year != null) parts.push(year);
  if (month != null) parts.push(MONTH_NAMES[month]);
  bc.classList.remove("hidden");
  bc.innerHTML = `<span>${parts.join(" · ")}</span><button id="btn-clear-breadcrumb" aria-label="Limpar">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
  </button>`;
  $("#btn-clear-breadcrumb").addEventListener("click", () => {
    state.drillFilter = { year: null, month: null };
    renderHistoryFull();
  });
}

function openHistoryFull() {
  $("#filter-date-from").value = "";
  $("#filter-date-to").value = "";
  state.historyFilter = { from: "", to: "" };
  state.drillFilter = { year: null, month: null };
  state.periodMode = "dia";
  $all("#period-tabs .settings-tab").forEach((t) => t.classList.toggle("active", t.dataset.period === "dia"));
  $("#filter-bar-dia").classList.remove("hidden");
  renderHistoryFull();
  showView("history");
}

function openSettings() {
  renderSettingsSectors();
  checkConnectionStatus();
  showView("settings");
}

function renderHistoryFull() {
  renderBreadcrumb();
  const container = $("#history-full-list");
  const empty = $("#history-empty");
  const finished = state.rondas.filter((r) => r.status === "concluida");
  const { year: dYear, month: dMonth } = state.drillFilter;

  if (state.periodMode === "ano") {
    const groups = new Map(); // year -> rondas[]
    finished.forEach((r) => {
      const y = new Date(r.dataInicio).getFullYear();
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y).push(r);
    });
    const years = [...groups.keys()].sort((a, b) => b - a);
    if (!years.length) { container.innerHTML = ""; empty.classList.remove("hidden"); return; }
    empty.classList.add("hidden");
    container.innerHTML = years
      .map((y) => groupItemHTML(String(y), groups.get(y).length, avgOf(groups.get(y))))
      .join("");
    container.querySelectorAll(".history-item").forEach((el, i) => {
      el.addEventListener("click", () => {
        state.drillFilter = { year: years[i], month: null };
        switchPeriodTab("mes", { resetDrill: false });
      });
    });
    return;
  }

  if (state.periodMode === "mes") {
    let base = finished;
    if (dYear != null) base = base.filter((r) => new Date(r.dataInicio).getFullYear() === dYear);
    const groups = new Map(); // "y-m" -> {year, month, rondas[]}
    base.forEach((r) => {
      const d = new Date(r.dataInicio);
      const key = d.getFullYear() + "-" + d.getMonth();
      if (!groups.has(key)) groups.set(key, { year: d.getFullYear(), month: d.getMonth(), rondas: [] });
      groups.get(key).rondas.push(r);
    });
    const keys = [...groups.keys()].sort((a, b) => {
      const [ay, am] = a.split("-").map(Number);
      const [by, bm] = b.split("-").map(Number);
      return by - ay || bm - am;
    });
    if (!keys.length) { container.innerHTML = ""; empty.classList.remove("hidden"); return; }
    empty.classList.add("hidden");
    container.innerHTML = keys
      .map((k) => {
        const g = groups.get(k);
        const label = `${MONTH_NAMES[g.month]} ${g.year}`;
        return groupItemHTML(label, g.rondas.length, avgOf(g.rondas));
      })
      .join("");
    container.querySelectorAll(".history-item").forEach((el, i) => {
      const g = groups.get(keys[i]);
      el.addEventListener("click", () => {
        state.drillFilter = { year: g.year, month: g.month };
        switchPeriodTab("dia", { resetDrill: false });
      });
    });
    return;
  }

  // periodMode === 'dia'
  let list = finished;
  if (dYear != null) list = list.filter((r) => new Date(r.dataInicio).getFullYear() === dYear);
  if (dMonth != null) list = list.filter((r) => new Date(r.dataInicio).getMonth() === dMonth);
  const { from, to } = state.historyFilter;
  if (from) list = list.filter((r) => r.dataInicio.slice(0, 10) >= from);
  if (to) list = list.filter((r) => r.dataInicio.slice(0, 10) <= to);

  if (!list.length) {
    container.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  container.innerHTML = list.map(historyItemHTML).join("");
  container.querySelectorAll(".history-item").forEach((el) => {
    el.addEventListener("click", () => openRoundDetail(el.dataset.id));
  });
}

// =====================================================================
// ROUND DETAIL (read-only)
// =====================================================================
let currentDetailRonda = null;

async function openRoundDetail(id) {
  const ronda = state.rondas.find((r) => r.id === id) || (await DB.getRonda(id));
  if (!ronda) return;
  currentDetailRonda = ronda;
  const score = ronda.stats?.pontuacao ?? 0;

  let html = `
    <div class="summary-hero" style="padding:10px 0 20px;">
      <div class="history-score ${scoreClass(score)}" style="width:64px;height:64px;font-size:16px;margin:0 auto 10px;">${score}%</div>
      <p class="summary-sub">${fmtDateShort(ronda.dataInicio)} · ${fmtTime(ronda.dataInicio)} — ${ronda.dataFim ? fmtTime(ronda.dataFim) : ""}</p>
    </div>
    <div class="summary-stats-row" style="padding:0 20px;">
      <div class="summary-stat stat-ok"><p class="stat-num">${ronda.stats?.conformes ?? 0}</p><p class="stat-lbl">Conformes</p></div>
      <div class="summary-stat stat-bad"><p class="stat-num">${ronda.stats?.naoConformes ?? 0}</p><p class="stat-lbl">Não conformes</p></div>
      <div class="summary-stat"><p class="stat-num">${ronda.pendencias?.length ?? 0}</p><p class="stat-lbl">Pendências</p></div>
    </div>
    <div style="padding:0 20px;">`;

  for (const sectorId of ronda.setoresConcluidos || []) {
    const sector = state.config.sectors.find((s) => s.id === sectorId);
    const respostas = ronda.respostas?.[sectorId] || [];
    html += `<div class="detail-sector-block">
      <div class="detail-sector-header"><h3><i data-lucide="${sector ? sector.icone : "circle"}"></i>${sector ? sector.nome : sectorId}</h3></div>`;
    for (const r of respostas) {
      html += `<div class="detail-answer-row">
        <span class="a-emoji"><i data-lucide="${r.status === "ok" ? "smile" : "frown"}"></i></span>
        <div><p class="a-text">${escapeHTML(r.texto)}</p>${r.observacao ? `<p class="a-obs">"${escapeHTML(r.observacao)}"</p>` : ""}</div>
      </div>`;
    }
    html += `</div>`;
  }

  if (ronda.pendencias?.length) {
    html += `<p class="summary-section-title">Pendências</p>`;
    for (const p of ronda.pendencias) {
      html += pendenciaItemHTML(p);
    }
  }

  html += `</div><div style="height:20px"></div>`;
  $("#round-detail-content").innerHTML = html;
  showView("roundDetail");
  refreshIcons();
}

function pendenciaItemHTML(p) {
  return `<div class="summary-pendencia-item">
    <div class="p-top">
      <p class="p-desc">${escapeHTML(p.descricao)}</p>
      <span class="priority-chip ${p.prioridade}">${prioLabel(p.prioridade)}</span>
    </div>
    <p class="p-meta">${escapeHTML(p.responsavel || "Sem responsável")} · Prazo: ${p.prazo ? fmtDateShort(p.prazo) : "—"} · ${p.setorNome}</p>
  </div>`;
}
function prioLabel(v) {
  return { baixa: "Baixa", media: "Média", alta: "Alta" }[v] || v;
}
function escapeHTML(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// =====================================================================
// PENDÊNCIAS (GLOBAL VIEW)
// =====================================================================
function collectAllPendencias() {
  const items = [];
  for (const r of state.rondas) {
    (r.pendencias || []).forEach((p) => items.push({ ...p, rondaId: r.id }));
  }
  return items;
}

function pendenciaRowHTML(p, resolved) {
  return `<div class="summary-pendencia-item">
    <div class="p-top">
      <p class="p-desc">${escapeHTML(p.descricao)}</p>
      <span class="priority-chip ${p.prioridade}">${prioLabel(p.prioridade)}</span>
    </div>
    <p class="p-meta">${escapeHTML(p.responsavel || "Sem responsável")} · Prazo: ${p.prazo ? fmtDateShort(p.prazo) : "—"} · ${p.setorNome}</p>
    <button class="pendencia-toggle" data-id="${p.id}" data-ronda-id="${p.rondaId}">${resolved ? "Reabrir" : "Marcar como resolvida"}</button>
  </div>`;
}

function openPendenciasFromEntry() {
  state.pendenciasStatusFilter = "aberta";
  $all("#view-pendencias .settings-tab").forEach((t) => t.classList.toggle("active", t.dataset.pstatus === "aberta"));
  renderPendenciasView();
  showView("pendencias");
}

function renderPendenciasView() {
  const status = state.pendenciasStatusFilter;
  const resolved = status === "resolvida";
  let all = collectAllPendencias().filter((p) => (resolved ? p.status === "resolvida" : p.status !== "resolvida"));
  all.sort((a, b) => (a.prazo || "9999-99-99").localeCompare(b.prazo || "9999-99-99"));

  const container = $("#pendencias-list");
  const empty = $("#pendencias-empty");
  if (!all.length) {
    container.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  container.innerHTML = all.map((p) => pendenciaRowHTML(p, resolved)).join("");
  container.querySelectorAll(".pendencia-toggle").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await togglePendenciaStatus(btn.dataset.rondaId, btn.dataset.id);
      renderPendenciasView();
      renderHeroStats();
    });
  });
}

async function togglePendenciaStatus(rondaId, pendId) {
  const ronda = state.rondas.find((r) => r.id === rondaId);
  if (!ronda) return;
  const p = (ronda.pendencias || []).find((x) => x.id === pendId);
  if (!p) return;
  p.status = p.status === "resolvida" ? "aberta" : "resolvida";
  await DB.updateRonda(rondaId, { pendencias: ronda.pendencias });
}

// =====================================================================
// START / RESUME ROUND
// =====================================================================
async function startNewRound() {
  const sectorIds = activeSectorIds();
  if (!sectorIds.length) {
    toast("Ative pelo menos um setor em Configurações.");
    return;
  }
  const ronda = {
    dataInicio: new Date().toISOString(),
    dataFim: null,
    status: "em_andamento",
    setoresConcluidos: [],
    respostas: {},
    pendencias: [],
    stats: { conformes: 0, naoConformes: 0, totalPerguntas: 0, pontuacao: 0 },
  };
  const id = await DB.createRonda(ronda);
  ronda.id = id;
  state.activeRonda = ronda;
  state.rondas.unshift(ronda);
  DB.setActiveRoundId(id);
  openSectorsView();
}

function resumeRound() {
  openSectorsView();
}

// =====================================================================
// SECTORS VIEW (round in progress)
// =====================================================================
function openSectorsView() {
  renderSectorsGrid();
  showView("sectors");
}

function renderSectorsGrid() {
  const ronda = state.activeRonda;
  const sectors = state.config.sectors.filter((s) => s.ativo);
  const grid = $("#sectors-grid");

  grid.innerHTML = sectors
    .map((s) => {
      const done = ronda.setoresConcluidos.includes(s.id);
      const qCount = (state.config.questionsBySector[s.id] || []).length;
      return `
      <div class="sector-card ${done ? "done" : ""}" data-id="${s.id}">
        <span class="sector-icon"><i data-lucide="${s.icone}"></i></span>
        <div class="sector-text">
          <p class="sector-name">${s.nome}</p>
          <p class="sector-count">${qCount} ${qCount === 1 ? "item" : "itens"}</p>
        </div>
        ${
          done
            ? `<span class="done-badge"><svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
            : `<svg class="row-chevron" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        }
      </div>`;
    })
    .join("");

  grid.querySelectorAll(".sector-card").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      if (ronda.setoresConcluidos.includes(id)) {
        toast("Este setor já foi concluído nesta ronda.");
        return;
      }
      openQuestionsView(id);
    });
  });

  updateRoundProgress();
  refreshIcons();
}

function updateRoundProgress() {
  const ronda = state.activeRonda;
  const total = activeSectorIds().length;
  const done = ronda.setoresConcluidos.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $("#round-progress-fill").style.width = pct + "%";
  $("#round-progress-label").textContent = `${pct}% concluído · ${done} de ${total} setores`;

  const finishBtn = $("#btn-finish-round");
  if (done === total && total > 0) finishBtn.classList.remove("hidden");
  else finishBtn.classList.add("hidden");
}

// =====================================================================
// QUESTIONS VIEW
// =====================================================================
function openQuestionsView(sectorId) {
  state.currentSectorId = sectorId;
  const sector = state.config.sectors.find((s) => s.id === sectorId);
  $("#questions-sector-title").textContent = sector.nome;

  const ronda = state.activeRonda;
  if (!ronda.respostas[sectorId]) {
    const questions = state.config.questionsBySector[sectorId] || [];
    ronda.respostas[sectorId] = questions.map((q) => ({
      perguntaId: q.id,
      texto: q.texto,
      status: null, // 'ok' | 'bad'
      observacao: "",
      pendenciaId: null,
    }));
  }
  renderQuestionsList();
  showView("questions");
}

function renderQuestionsList() {
  const sectorId = state.currentSectorId;
  const respostas = state.activeRonda.respostas[sectorId];
  const list = $("#questions-list");

  list.innerHTML = respostas
    .map((r, idx) => {
      const cardState = r.status === "ok" ? "answered-ok" : r.status === "bad" ? "answered-bad" : "";
      return `
      <div class="question-card ${cardState}" data-idx="${idx}">
        <p class="question-text">${escapeHTML(r.texto)}</p>
        <div class="answer-row">
          <button class="answer-btn bad ${r.status === "bad" ? "selected bad" : ""}" data-idx="${idx}" data-val="bad">
            <span class="emoji"><i data-lucide="frown"></i></span><span>Não atingiu</span>
          </button>
          <button class="answer-btn ok ${r.status === "ok" ? "selected ok" : ""}" data-idx="${idx}" data-val="ok">
            <span class="emoji"><i data-lucide="smile"></i></span><span>Atingiu</span>
          </button>
        </div>
        <div class="question-actions">
          <button class="tag-btn obs-btn ${r.observacao ? "has-content" : ""}" data-idx="${idx}">
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            ${r.observacao ? "Observação ✓" : "Observação"}
          </button>
          <button class="tag-btn pend-btn ${r.pendenciaId ? "pendencia-active" : ""}" data-idx="${idx}">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 8v5m0 3h.01M10.3 3.86L1.82 18a1.5 1.5 0 001.3 2.25h17.76a1.5 1.5 0 001.3-2.25L14.7 3.86a1.5 1.5 0 00-2.6 0z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            ${r.pendenciaId ? "Pendência criada" : "Criar Pendência"}
          </button>
        </div>
      </div>`;
    })
    .join("");

  list.querySelectorAll(".answer-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = +btn.dataset.idx;
      const val = btn.dataset.val;
      const resp = respostas[idx];
      resp.status = resp.status === val ? null : val;
      renderQuestionsList();
      persistActiveRonda();
    });
  });
  list.querySelectorAll(".obs-btn").forEach((btn) => {
    btn.addEventListener("click", () => openObservacaoModal(+btn.dataset.idx));
  });
  list.querySelectorAll(".pend-btn").forEach((btn) => {
    btn.addEventListener("click", () => openPendenciaModal(+btn.dataset.idx));
  });

  updateSectorProgress();
  refreshIcons();
}

function updateSectorProgress() {
  const respostas = state.activeRonda.respostas[state.currentSectorId];
  const total = respostas.length;
  const answered = respostas.filter((r) => r.status).length;
  const pct = total ? Math.round((answered / total) * 100) : 0;
  $("#sector-progress-fill").style.width = pct + "%";
  $("#sector-progress-label").textContent = `${answered} de ${total} respondidas`;

  const finishBtn = $("#btn-finish-sector");
  finishBtn.disabled = answered < total;
}

function finishSector() {
  const sectorId = state.currentSectorId;
  const respostas = state.activeRonda.respostas[sectorId];
  if (respostas.some((r) => !r.status)) {
    toast("Responda todas as perguntas antes de concluir.");
    return;
  }
  if (!state.activeRonda.setoresConcluidos.includes(sectorId)) {
    state.activeRonda.setoresConcluidos.push(sectorId);
  }
  persistActiveRonda();
  toast("Setor concluído ✓");
  openSectorsView();
}

// =====================================================================
// OBSERVAÇÃO MODAL
// =====================================================================
function openObservacaoModal(idx) {
  const resp = state.activeRonda.respostas[state.currentSectorId][idx];
  state.observacaoTarget = { idx };
  $("#observacao-question-ref").textContent = resp.texto;
  $("#observacao-texto").value = resp.observacao || "";
  $("#modal-observacao").classList.remove("hidden");
  setTimeout(() => $("#observacao-texto").focus(), 200);
}
function saveObservacao() {
  const { idx } = state.observacaoTarget;
  const resp = state.activeRonda.respostas[state.currentSectorId][idx];
  resp.observacao = $("#observacao-texto").value.trim();
  persistActiveRonda();
  $("#modal-observacao").classList.add("hidden");
  renderQuestionsList();
}

// =====================================================================
// PENDÊNCIA MODAL
// =====================================================================
function openPendenciaModal(idx) {
  const resp = state.activeRonda.respostas[state.currentSectorId][idx];
  state.pendenciaTarget = { idx };
  state.selectedPriority = "media";
  $("#pendencia-question-ref").textContent = resp.texto;
  $("#pendencia-descricao").value = "";
  $("#pendencia-responsavel").value = "";
  $("#pendencia-prazo").value = "";
  $all(".priority-opt").forEach((b) => b.classList.toggle("selected", b.dataset.value === "media"));
  $("#modal-pendencia").classList.remove("hidden");
}

function savePendencia() {
  const { idx } = state.pendenciaTarget;
  const descricao = $("#pendencia-descricao").value.trim();
  if (!descricao) {
    toast("Descreva a pendência.");
    return;
  }
  const sectorId = state.currentSectorId;
  const sector = state.config.sectors.find((s) => s.id === sectorId);
  const resp = state.activeRonda.respostas[sectorId][idx];

  const pendencia = {
    id: uid(),
    setorId: sectorId,
    setorNome: sector.nome,
    perguntaId: resp.perguntaId,
    perguntaTexto: resp.texto,
    descricao,
    responsavel: $("#pendencia-responsavel").value.trim(),
    prazo: $("#pendencia-prazo").value || null,
    prioridade: state.selectedPriority || "media",
    status: "aberta",
    criadaEm: new Date().toISOString(),
  };
  state.activeRonda.pendencias.push(pendencia);
  resp.pendenciaId = pendencia.id;
  persistActiveRonda();
  $("#modal-pendencia").classList.add("hidden");
  renderQuestionsList();
  toast("Pendência criada ✓");
}

// =====================================================================
// PERSIST ACTIVE ROUND (debounced-ish, simple immediate write)
// =====================================================================
let saveTimer = null;
function persistActiveRonda() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!state.activeRonda) return;
    await DB.updateRonda(state.activeRonda.id, {
      respostas: state.activeRonda.respostas,
      pendencias: state.activeRonda.pendencias,
      setoresConcluidos: state.activeRonda.setoresConcluidos,
    });
  }, 250);
}

// =====================================================================
// FINISH ROUND -> SUMMARY
// =====================================================================
async function finishRound() {
  const ronda = state.activeRonda;
  let conformes = 0, naoConformes = 0;
  Object.values(ronda.respostas).forEach((list) => {
    list.forEach((r) => {
      if (r.status === "ok") conformes++;
      else if (r.status === "bad") naoConformes++;
    });
  });
  const total = conformes + naoConformes;
  const pontuacao = total ? Math.round((conformes / total) * 100) : 0;

  ronda.status = "concluida";
  ronda.dataFim = new Date().toISOString();
  ronda.stats = { conformes, naoConformes, totalPerguntas: total, pontuacao };

  await DB.updateRonda(ronda.id, {
    status: ronda.status,
    dataFim: ronda.dataFim,
    stats: ronda.stats,
    respostas: ronda.respostas,
    pendencias: ronda.pendencias,
    setoresConcluidos: ronda.setoresConcluidos,
  });

  const idx = state.rondas.findIndex((r) => r.id === ronda.id);
  if (idx >= 0) state.rondas[idx] = ronda;

  state.activeRonda = null;
  DB.setActiveRoundId(null);

  renderSummary(ronda);
  showView("summary");
}

function renderSummary(ronda) {
  const { conformes, naoConformes, pontuacao } = ronda.stats;
  const circumference = 2 * Math.PI * 72;
  const offset = circumference * (1 - pontuacao / 100);
  const ringColor = pontuacao >= 85 ? "var(--ok)" : pontuacao >= 60 ? "var(--warn)" : "var(--bad)";

  let html = `
    <div class="summary-hero">
      <div class="summary-ring-wrap">
        <svg viewBox="0 0 168 168">
          <circle class="summary-ring-bg" cx="84" cy="84" r="72" fill="none" stroke-width="12"/>
          <circle class="summary-ring-fill" cx="84" cy="84" r="72" fill="none" stroke-width="12"
            stroke="${ringColor}" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"/>
        </svg>
        <div class="summary-ring-score">
          <span class="num">${pontuacao}%</span>
          <span class="lbl">Pontuação</span>
        </div>
      </div>
      <p class="summary-title">Ronda concluída</p>
      <p class="summary-sub">${fmtDateShort(ronda.dataInicio)} · finalizada às ${fmtTime(ronda.dataFim)}</p>
    </div>

    <div class="summary-stats-row">
      <div class="summary-stat stat-ok"><p class="stat-num">${conformes}</p><p class="stat-lbl">Conformes</p></div>
      <div class="summary-stat stat-bad"><p class="stat-num">${naoConformes}</p><p class="stat-lbl">Não conformes</p></div>
      <div class="summary-stat"><p class="stat-num">${ronda.pendencias.length}</p><p class="stat-lbl">Pendências</p></div>
    </div>`;

  if (ronda.pendencias.length) {
    html += `<p class="summary-section-title">Pendências abertas</p>`;
    ronda.pendencias.forEach((p) => (html += pendenciaItemHTML(p)));
  }

  html += `
    <div class="summary-actions">
      <button class="btn-secondary" id="btn-summary-export">Exportar para Excel</button>
      <button class="btn-primary" id="btn-summary-close">Concluir</button>
    </div>`;

  $("#summary-content").innerHTML = html;

  requestAnimationFrame(() => {
    const fill = document.querySelector(".summary-ring-fill");
    if (fill) fill.style.strokeDashoffset = offset;
  });

  $("#btn-summary-export").addEventListener("click", () => exportRondaToExcel(ronda));
  $("#btn-summary-close").addEventListener("click", async () => {
    state.rondas = await DB.listRondas();
    renderHome();
    showView("home");
  });
}

// =====================================================================
// EXCEL EXPORT (SheetJS, loaded on demand)
// =====================================================================
let sheetJsPromise = null;
function loadSheetJS() {
  if (window.XLSX) return Promise.resolve();
  if (sheetJsPromise) return sheetJsPromise;
  sheetJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return sheetJsPromise;
}

async function exportRondaToExcel(ronda) {
  try {
    toast("Preparando arquivo...");
    await loadSheetJS();
    const wb = XLSX.utils.book_new();

    // Sheet 1: Resumo
    const resumoRows = [
      ["Ronda Pet — Relatório de Ronda"],
      [],
      ["Data", fmtDateShort(ronda.dataInicio)],
      ["Início", fmtTime(ronda.dataInicio)],
      ["Término", ronda.dataFim ? fmtTime(ronda.dataFim) : "—"],
      ["Pontuação Geral", (ronda.stats?.pontuacao ?? 0) + "%"],
      ["Itens Conformes", ronda.stats?.conformes ?? 0],
      ["Itens Não Conformes", ronda.stats?.naoConformes ?? 0],
      ["Total de Pendências", ronda.pendencias?.length ?? 0],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
    wsResumo["!cols"] = [{ wch: 22 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    // Sheet 2: Checklist detalhado
    const checklistRows = [["Setor", "Pergunta", "Resposta", "Observação"]];
    for (const sectorId of ronda.setoresConcluidos || []) {
      const sector = state.config.sectors.find((s) => s.id === sectorId);
      const respostas = ronda.respostas?.[sectorId] || [];
      respostas.forEach((r) => {
        checklistRows.push([
          sector ? sector.nome : sectorId,
          r.texto,
          r.status === "ok" ? "Atingiu" : "Não atingiu",
          r.observacao || "",
        ]);
      });
    }
    const wsChecklist = XLSX.utils.aoa_to_sheet(checklistRows);
    wsChecklist["!cols"] = [{ wch: 22 }, { wch: 45 }, { wch: 14 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, wsChecklist, "Checklist");

    // Sheet 3: Pendências
    const pendRows = [["Setor", "Pergunta", "Descrição", "Responsável", "Prazo", "Prioridade"]];
    (ronda.pendencias || []).forEach((p) => {
      pendRows.push([
        p.setorNome,
        p.perguntaTexto || "",
        p.descricao,
        p.responsavel || "",
        p.prazo ? fmtDateShort(p.prazo) : "",
        prioLabel(p.prioridade),
      ]);
    });
    const wsPend = XLSX.utils.aoa_to_sheet(pendRows);
    wsPend["!cols"] = [{ wch: 22 }, { wch: 40 }, { wch: 40 }, { wch: 20 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsPend, "Pendências");

    const filename = `ronda-pet-${ronda.dataInicio.slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  } catch (err) {
    console.error(err);
    toast("Não foi possível exportar. Verifique sua conexão.");
  }
}

// =====================================================================
// SETTINGS — SECTORS
// =====================================================================
function renderSettingsSectors() {
  const list = $("#settings-sectors-list");
  list.innerHTML = state.config.sectors
    .map(
      (s) => `
    <div class="settings-sector-row" data-id="${s.id}">
      <span class="sector-icon-sm"><i data-lucide="${s.icone}"></i></span>
      <div style="flex:1;min-width:0;">
        <p class="row-name">${s.nome}</p>
        <p class="row-count">${(state.config.questionsBySector[s.id] || []).length} perguntas</p>
      </div>
      <button class="row-edit" data-id="${s.id}">Perguntas</button>
      <label class="switch">
        <input type="checkbox" data-id="${s.id}" ${s.ativo ? "checked" : ""} />
        <span class="switch-track"></span>
      </label>
    </div>`
    )
    .join("");

  list.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", async () => {
      const sector = state.config.sectors.find((s) => s.id === cb.dataset.id);
      sector.ativo = cb.checked;
      await DB.saveConfig(state.config);
    });
  });
  list.querySelectorAll(".row-edit").forEach((btn) => {
    btn.addEventListener("click", () => openSectorEditor(btn.dataset.id));
  });
  refreshIcons();
}

// =====================================================================
// SECTOR QUESTION EDITOR
// =====================================================================
function openSectorEditor(sectorId) {
  state.editingSectorId = sectorId;
  const sector = state.config.sectors.find((s) => s.id === sectorId);
  $("#editor-sector-title").textContent = sector.nome;
  $("#new-question-input").value = "";
  renderEditorQuestions();
  showView("sectorEditor");
}

function renderEditorQuestions() {
  const sectorId = state.editingSectorId;
  const questions = state.config.questionsBySector[sectorId] || [];
  const list = $("#editor-questions-list");
  if (!questions.length) {
    list.innerHTML = `<p class="empty-state">Nenhuma pergunta cadastrada ainda.</p>`;
    return;
  }
  list.innerHTML = questions
    .map(
      (q) => `
    <div class="editor-question-row" data-id="${q.id}">
      <p class="eq-text">${escapeHTML(q.texto)}</p>
      <button class="eq-remove" data-id="${q.id}" aria-label="Remover">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
      </button>
    </div>`
    )
    .join("");

  list.querySelectorAll(".eq-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmDialog(
        "Remover pergunta",
        "Tem certeza que deseja remover esta pergunta do checklist?",
        async () => {
          const arr = state.config.questionsBySector[sectorId];
          state.config.questionsBySector[sectorId] = arr.filter((q) => q.id !== btn.dataset.id);
          await DB.saveConfig(state.config);
          renderEditorQuestions();
        }
      );
    });
  });
}

async function addQuestion() {
  const input = $("#new-question-input");
  const texto = input.value.trim();
  if (!texto) return;
  const sectorId = state.editingSectorId;
  if (!state.config.questionsBySector[sectorId]) state.config.questionsBySector[sectorId] = [];
  state.config.questionsBySector[sectorId].push({ id: uid(), texto });
  await DB.saveConfig(state.config);
  input.value = "";
  renderEditorQuestions();
}

// =====================================================================
// CONFIRM DIALOG (generic)
// =====================================================================
let confirmCallback = null;
function confirmDialog(title, message, onConfirm) {
  $("#confirm-title").textContent = title;
  $("#confirm-message").textContent = message;
  confirmCallback = onConfirm;
  $("#modal-confirm").classList.remove("hidden");
}

// =====================================================================
// SERVICE WORKER
// =====================================================================
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

// =====================================================================
// EVENT BINDINGS
// =====================================================================
function bindEvents() {
  // Hero quick actions
  $("#qa-start").addEventListener("click", () => {
    if (state.activeRonda) resumeRound();
    else startNewRound();
  });
  $("#qa-history").addEventListener("click", () => openHistoryFull());
  $("#qa-settings").addEventListener("click", () => openSettings());
  $("#qa-pendencias").addEventListener("click", () => openPendenciasFromEntry());
  $("#hero-expand-toggle").addEventListener("click", (e) => {
    const extra = $("#hero-extra");
    const btn = e.currentTarget;
    extra.classList.toggle("hidden");
    btn.classList.toggle("open");
  });
  $("#active-round-banner").addEventListener("click", () => resumeRound());

  $("#btn-open-config").addEventListener("click", () => openSettings());
  $("#btn-settings-back").addEventListener("click", () => showView("home"));

  $("#btn-pendencias-back").addEventListener("click", () => showView("home"));
  $all("#view-pendencias .settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $all("#view-pendencias .settings-tab").forEach((t) => t.classList.toggle("active", t === tab));
      state.pendenciasStatusFilter = tab.dataset.pstatus;
      renderPendenciasView();
    });
  });

  $("#btn-see-all-history").addEventListener("click", () => openHistoryFull());
  $("#btn-history-back").addEventListener("click", () => showView("home"));

  // Bottom navigation (FAB style)
  $("#bn-home").addEventListener("click", () => { renderHome(); showView("home"); });
  $("#bn-history").addEventListener("click", () => openHistoryFull());
  $("#bn-pendencias").addEventListener("click", () => openPendenciasFromEntry());
  $("#bn-settings").addEventListener("click", () => openSettings());
  $("#bn-fab").addEventListener("click", () => {
    if (state.activeRonda) resumeRound();
    else startNewRound();
  });

  $all("#period-tabs .settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchPeriodTab(tab.dataset.period));
  });
  $("#filter-date-from").addEventListener("change", (e) => {
    state.historyFilter.from = e.target.value;
    renderHistoryFull();
  });
  $("#filter-date-to").addEventListener("change", (e) => {
    state.historyFilter.to = e.target.value;
    renderHistoryFull();
  });
  $("#btn-clear-filters").addEventListener("click", () => {
    state.historyFilter = { from: "", to: "" };
    $("#filter-date-from").value = "";
    $("#filter-date-to").value = "";
    renderHistoryFull();
  });

  $("#btn-detail-back").addEventListener("click", () => showView("history"));
  $("#btn-detail-export").addEventListener("click", () => {
    if (currentDetailRonda) exportRondaToExcel(currentDetailRonda);
  });

  $("#btn-sectors-back").addEventListener("click", () => showView("home"));
  $("#btn-finish-round").addEventListener("click", () => {
    confirmDialog(
      "Finalizar ronda",
      "Todos os setores foram concluídos. Deseja finalizar e gerar o resumo da ronda?",
      finishRound
    );
  });

  $("#btn-questions-back").addEventListener("click", () => openSectorsView());
  $("#btn-finish-sector").addEventListener("click", finishSector);

  // Observação modal
  $("#btn-cancel-observacao").addEventListener("click", () => $("#modal-observacao").classList.add("hidden"));
  $("#btn-save-observacao").addEventListener("click", saveObservacao);

  // Pendência modal
  $("#btn-cancel-pendencia").addEventListener("click", () => $("#modal-pendencia").classList.add("hidden"));
  $("#btn-save-pendencia").addEventListener("click", savePendencia);
  $all(".priority-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedPriority = btn.dataset.value;
      $all(".priority-opt").forEach((b) => b.classList.toggle("selected", b === btn));
    });
  });

  // Confirm dialog
  $("#btn-confirm-no").addEventListener("click", () => $("#modal-confirm").classList.add("hidden"));
  $("#btn-confirm-yes").addEventListener("click", () => {
    $("#modal-confirm").classList.add("hidden");
    if (confirmCallback) confirmCallback();
  });

  // Settings tabs
  $all(".settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $all(".settings-tab").forEach((t) => t.classList.toggle("active", t === tab));
      $("#settings-panel-setores").classList.toggle("hidden", tab.dataset.tab !== "setores");
      $("#settings-panel-conexao").classList.toggle("hidden", tab.dataset.tab !== "conexao");
    });
  });

  // Sector editor
  $("#btn-editor-back").addEventListener("click", () => {
    renderSettingsSectors();
    showView("settings");
  });
  $("#btn-add-question").addEventListener("click", addQuestion);
  $("#new-question-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addQuestion();
  });

  // Close modals on overlay click
  $all(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.add("hidden");
    });
  });
}

function checkConnectionStatus() {
  const dot = document.querySelector(".connection-dot");
  const text = $("#connection-status-text");
  if (DB.isOnline()) {
    dot.className = "connection-dot on";
    text.textContent = "Conectado ao Firestore";
  } else {
    dot.className = "connection-dot off";
    text.textContent = "Modo local (Firestore não configurado)";
  }
}

// =====================================================================
init();
