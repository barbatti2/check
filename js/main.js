import { isFirebaseConfigured } from "./firebase-init.js";
import * as store from "./db.js";
import { exportRondaToExcel } from "./export.js";

/* ============================================================
   Estado global
============================================================ */
const CHECKLIST_LABELS = {
  daily: {
    menuSub: "Comece o checklist diário",
    screenTitle: "Checklist diário",
    inProgress: "Em andamento · toque para continuar",
    done: "Concluído hoje · toque para editar"
  },
  weekly: {
    menuSub: "Comece o checklist semanal",
    screenTitle: "Checklist semanal",
    inProgress: "Em andamento · toque para continuar",
    done: "Concluído nesta semana · toque para editar"
  }
};

const state = {
  sectors: [],
  currentRonda: null,
  checklistType: null,               // "daily" | "weekly"
  periodRondas: { daily: null, weekly: null },
  periodRondasLoaded: false,         // true assim que a Home já buscou os checklists do período
  activeSectorId: null,
  historyItems: [],
  settingsSectorId: null,
  settingsQuestionType: "weekly",    // aba ativa na tela de perguntas das configurações
  editingQuestionId: null,
  pendenciaCtx: null,      // { sectorId, questionId, questionText, editingId }
  selectedPriority: null,
  confirmAction: null,
  deletePendingSectorId: null,
  editingCompletedRonda: false,
  editingFromHistory: false,
  historyRange: "all",
  editSnapshot: null,   // "foto" do checklist ao entrar em modo edição, para detectar alterações
  isDirty: false
};

const saveTimers = {};

/* ============================================================
   Helpers de UI
============================================================ */
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return document.querySelectorAll(sel); }

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function showScreen(id) {
  $all(".screen").forEach(s => s.classList.remove("is-active"));
  const el = document.getElementById(id);
  el.classList.add("is-active");
  el.scrollTop = 0;
  window.scrollTo(0, 0);
}

let toastTimer;
function showToast(msg, ms = 2400, variant) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.toggle("toast--error", variant === "error");
  t.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-visible"), ms);
}

function shakeElement(el) {
  if (!el) return;
  el.classList.remove("is-shaking");
  void el.offsetWidth; // força reflow para poder reiniciar a animação
  el.classList.add("is-shaking");
  setTimeout(() => el.classList.remove("is-shaking"), 500);
}

// Loading usado apenas em ações de escrita rápidas (salvar, excluir, etc.),
// que já respondem em instantes — sem watchdog, para não disparar um aviso
// de "problema de conexão" que não reflete a realidade.
function showLoading(v) {
  $("#loading-overlay").classList.toggle("hidden", !v);
}

function fmtDateLabel(date) {
  if (!date) return "";
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}
function fmtDateShort(date) {
  if (!date) return "";
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTime(date) {
  if (!date) return "";
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function setRing(circleEl, percent) {
  const circumference = 326.7; // 2 * PI * 52
  const offset = circumference * (1 - Math.min(Math.max(percent, 0), 100) / 100);
  circleEl.style.strokeDashoffset = offset;
}

function debounce(key, fn, wait = 500) {
  clearTimeout(saveTimers[key]);
  saveTimers[key] = setTimeout(fn, wait);
}

// "Foto" do conteúdo relevante do checklist (respostas + pendências),
// usada para saber se algo mudou durante uma edição.
function snapshotRondaState(ronda) {
  return JSON.stringify({ sectorsData: ronda.sectorsData, pendencias: ronda.pendencias || [] });
}

function markDirtyCheck() {
  if (!state.editingCompletedRonda || !state.editSnapshot || !state.currentRonda) {
    state.isDirty = false;
    return;
  }
  state.isDirty = snapshotRondaState(state.currentRonda) !== state.editSnapshot;
}

function getSectorQuestions(sector, type) {
  return (type === "daily" ? sector.dailyQuestions : sector.questions) || [];
}

// Perguntas efetivas de um setor DENTRO de um checklist já criado: usa a
// lista congelada em sd.questions (checklists novos) e, se não existir
// (checklists antigos, criados antes desta trava), cai para a lista viva
// do setor — mantém compatibilidade sem quebrar dados existentes.
function getRondaSectorQuestions(sector, sd, type) {
  if (sd && Array.isArray(sd.questions)) return sd.questions;
  return getSectorQuestions(sector, type);
}

function fmtWeekLabel(dateLike) {
  if (!dateLike) return "";
  const d = dateLike.toDate ? dateLike.toDate() : new Date(dateLike);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (x) => x.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `Semana de ${fmt(start)} a ${fmt(end)}`;
}

function requireDb() {
  if (!isFirebaseConfigured) {
    showToast("Configure o Firebase em js/firebase-init.js");
    return false;
  }
  return true;
}

/* ============================================================
   Confirm modal genérico
============================================================ */
function openConfirm(title, body, onConfirm, opts = {}) {
  $("#confirm-title").textContent = title;
  $("#confirm-body").textContent = body;
  state.confirmAction = onConfirm;
  $("#btn-confirm-ok").textContent = opts.confirmLabel || "Confirmar";
  $("#btn-confirm-ok").classList.toggle("btn-danger", !!opts.danger);
  $("#modal-confirm").classList.remove("hidden");
}
function closeConfirm() {
  $("#modal-confirm").classList.add("hidden");
  state.confirmAction = null;
}

/* ============================================================
   HOME
============================================================ */
async function initHome() {
  if (!isFirebaseConfigured) return;
  try {
    const [daily, weekly] = await Promise.all([
      store.getPeriodRonda("daily"),
      store.getPeriodRonda("weekly")
    ]);
    state.periodRondas = { daily, weekly };
    state.periodRondasLoaded = true;
    updateChecklistCardStatus("daily", daily);
    updateChecklistCardStatus("weekly", weekly);
    refreshIcons();
  } catch (e) {
    console.error(e);
  }
}

function updateChecklistCardStatus(type, ronda) {
  const sub = document.querySelector(`#btn-start-${type} .menu-card-sub`);
  if (!sub) return;
  const labels = CHECKLIST_LABELS[type];
  if (!ronda) sub.textContent = labels.menuSub;
  else if (ronda.status === "in_progress") sub.textContent = labels.inProgress;
  else sub.textContent = labels.done;
}

async function loadSectors() {
  state.sectors = await store.getSectors();
}

async function ensureSectorsLoaded() {
  if (!state.sectors.length) await loadSectors();
}

// Abre o checklist do tipo informado ("daily" ou "weekly"): retoma o que já
// estiver em andamento, reabre para edição o que já tiver sido concluído
// no período atual (dia ou semana), ou cria um novo quando não houver nenhum.
let checklistOpenInFlight = false;
async function openChecklistFlow(type) {
  if (!requireDb()) return;
  if (checklistOpenInFlight) return;
  checklistOpenInFlight = true;
  const btn = $(`#btn-start-${type}`);
  if (btn) btn.classList.add("is-loading");
  try {
    await ensureSectorsLoaded();
    if (!state.sectors.some(s => getSectorQuestions(s, type).length > 0)) {
      showToast(`Cadastre perguntas ${type === "daily" ? "diárias" : "semanais"} nos setores em Configurações antes de iniciar.`);
      return;
    }

    // A Home já buscou o checklist do período (inclusive quando é "nenhum
    // ainda") — reaproveita esse resultado em vez de refazer a consulta ao
    // Firestore, que era a causa do delay ao clicar para iniciar.
    let ronda = state.periodRondasLoaded ? state.periodRondas[type] : await store.getPeriodRonda(type);
    if (!ronda) ronda = await store.createRonda(state.sectors, type);

    state.currentRonda = ronda;
    state.checklistType = type;
    state.editingCompletedRonda = ronda.status === "completed";
    state.editSnapshot = state.editingCompletedRonda ? snapshotRondaState(ronda) : null;
    state.isDirty = false;
    renderRondaSectors();
    showScreen("screen-ronda-sectors");
  } catch (e) {
    console.error(e);
    showToast("Não foi possível abrir o checklist.");
  } finally {
    checklistOpenInFlight = false;
    if (btn) btn.classList.remove("is-loading");
  }
}

/* ============================================================
   RONDA · lista de setores
============================================================ */
function computeRondaTotals() {
  let totalQuestions = 0, answered = 0, conform = 0, nonConform = 0, sectorsWithContent = 0, sectorsDone = 0;
  Object.values(state.currentRonda.sectorsData).forEach(sd => {
    if (sd.totalQuestions > 0) sectorsWithContent++;
    if (sd.completed) sectorsDone++;
    totalQuestions += sd.totalQuestions;
    Object.values(sd.answers || {}).forEach(a => {
      answered++;
      if (a.status === "ok") conform++;
      else if (a.status === "not_ok") nonConform++;
    });
  });
  return { totalQuestions, answered, conform, nonConform, sectorsWithContent, sectorsDone };
}

function renderRondaSectors() {
  const ronda = state.currentRonda;
  const type = state.checklistType;
  $("#ronda-screen-title").textContent = CHECKLIST_LABELS[type].screenTitle;
  $("#ronda-date-label").textContent = type === "daily" ? fmtDateLabel(ronda.startedAt) : fmtWeekLabel(ronda.startedAt);

  const totals = computeRondaTotals();
  const percent = totals.totalQuestions ? Math.round((totals.answered / totals.totalQuestions) * 100) : 0;
  $("#progress-percent").textContent = `${percent}%`;
  setRing($("#progress-ring-fill"), percent);
  $("#stat-conform").textContent = totals.conform;
  $("#stat-nonconform").textContent = totals.nonConform;
  $("#stat-pending").textContent = totals.sectorsWithContent - totals.sectorsDone;

  const list = $("#sector-list");
  list.innerHTML = "";
  state.sectors.forEach(sector => {
    const sd = ronda.sectorsData[sector.id] || { completed: false, answers: {}, totalQuestions: getSectorQuestions(sector, type).length };
    const total = getRondaSectorQuestions(sector, sd, type).length;
    const answered = Object.keys(sd.answers || {}).length;
    const isEmpty = total === 0;
    const isDone = sd.completed;

    const card = document.createElement("div");
    card.className = "sector-card" + (isDone ? " is-done" : "") + (isEmpty ? " is-empty" : "");
    card.innerHTML = `
      <div class="sector-status">
        <i data-lucide="${isDone ? "circle-check" : "circle"}"></i>
      </div>
      <div class="sector-body">
        <p class="sector-name">${sector.name}</p>
        <p class="sector-meta">${isEmpty ? "Sem perguntas cadastradas" : isDone ? "Setor concluído" : `${answered}/${total} perguntas`}</p>
      </div>
      <div class="sector-chevron"><i data-lucide="chevron-right"></i></div>
    `;
    if (!isEmpty && (!isDone || state.editingCompletedRonda)) {
      card.addEventListener("click", () => openSectorQuestions(sector.id));
    } else if (isDone) {
      card.addEventListener("click", () => showToast("Setor já finalizado nesta ronda."));
    }
    list.appendChild(card);
  });

  markDirtyCheck();

  const allDone = totals.sectorsWithContent > 0 && totals.sectorsDone === totals.sectorsWithContent;
  const showFinishBar = state.editingCompletedRonda ? (allDone && state.isDirty) : allDone;
  $("#ronda-finish-bar").classList.toggle("hidden", !showFinishBar);
  $("#btn-finish-ronda span").textContent = state.editingCompletedRonda ? "Salvar alterações" : "Ver resultado da ronda";

  refreshIcons();
}

/* ============================================================
   RONDA · perguntas do setor
============================================================ */
function openSectorQuestions(sectorId) {
  state.activeSectorId = sectorId;
  renderSectorQuestions();
  showScreen("screen-sector-questions");
}

function renderSectorQuestions() {
  const sector = state.sectors.find(s => s.id === state.activeSectorId);
  const sd = state.currentRonda.sectorsData[sector.id];
  $("#sector-questions-title").textContent = sector.name;

  const questions = getRondaSectorQuestions(sector, sd, state.checklistType);
  const answered = questions.filter(q => sd.answers[q.id] && sd.answers[q.id].status).length;
  $("#sector-questions-progress").textContent = `${answered} de ${questions.length} respondidas`;
  $("#mini-progress-fill").style.width = questions.length ? `${(answered / questions.length) * 100}%` : "0%";

  const list = $("#question-list");
  list.innerHTML = "";
  questions.forEach((q, idx) => {
    const ans = sd.answers[q.id] || { status: null, observation: "" };
    const pend = (state.currentRonda.pendencias || []).find(p => p.questionId === q.id && p.sectorId === sector.id);

    const card = document.createElement("div");
    card.className = "question-card" + (ans.status ? " is-answered" : "");
    card.innerHTML = `
      <p class="question-index">Pergunta ${idx + 1} de ${questions.length}</p>
      <p class="question-text">${q.text}</p>
      <div class="answer-row">
        <button type="button" class="answer-btn answer-btn--bad ${ans.status === "not_ok" ? "is-selected" : ""}" data-q="${q.id}" data-status="not_ok">
          <i data-lucide="circle-x"></i><span>Não atingiu</span>
        </button>
        <button type="button" class="answer-btn answer-btn--ok ${ans.status === "ok" ? "is-selected" : ""}" data-q="${q.id}" data-status="ok">
          <i data-lucide="circle-check"></i><span>Atingiu</span>
        </button>
      </div>
      <div class="obs-field">
        <textarea rows="2" placeholder="Observação (opcional)" data-q="${q.id}">${ans.observation || ""}</textarea>
      </div>
      <div class="pendencia-row">
        <button type="button" class="btn-pendencia ${pend ? "has-pendencia" : ""}" data-q="${q.id}">
          <i data-lucide="flag"></i>
          <span>${pend ? "Editar pendência" : "Criar pendência"}</span>
        </button>
      </div>
    `;
    list.appendChild(card);
  });

  // eventos
  list.querySelectorAll(".answer-btn").forEach(btn => {
    btn.addEventListener("click", () => setAnswer(btn.dataset.q, btn.dataset.status));
  });
  list.querySelectorAll(".obs-field textarea").forEach(ta => {
    ta.addEventListener("input", () => {
      const qid = ta.dataset.q;
      sd.answers[qid] = sd.answers[qid] || { status: null, observation: "" };
      sd.answers[qid].observation = ta.value;
      debounce("sector-" + sector.id, () => store.saveRondaSector(state.currentRonda.id, sector.id, sd), 600);
    });
  });
  list.querySelectorAll(".btn-pendencia").forEach(btn => {
    btn.addEventListener("click", () => openPendenciaModal(sector, questions.find(q => q.id === btn.dataset.q)));
  });

  updateFinishSectorButton();
  refreshIcons();
}

function setAnswer(questionId, status) {
  const sector = state.sectors.find(s => s.id === state.activeSectorId);
  const sd = state.currentRonda.sectorsData[sector.id];
  const question = getRondaSectorQuestions(sector, sd, state.checklistType).find(q => q.id === questionId);
  sd.answers[questionId] = {
    text: question.text,
    status,
    observation: (sd.answers[questionId] && sd.answers[questionId].observation) || ""
  };
  store.saveRondaSector(state.currentRonda.id, sector.id, sd).catch(console.error);
  renderSectorQuestions();
}

function updateFinishSectorButton() {
  const sector = state.sectors.find(s => s.id === state.activeSectorId);
  const sd = state.currentRonda.sectorsData[sector.id];
  const questions = getRondaSectorQuestions(sector, sd, state.checklistType);
  const allAnswered = questions.length > 0 && questions.every(q => sd.answers[q.id] && sd.answers[q.id].status);
  $("#btn-finish-sector").disabled = !allAnswered;
}

// Permite excluir o checklist atual (em andamento ou já concluído) direto
// da tela de setores — útil para descartar um checklist iniciado por engano
// ou que ficou com dados inconsistentes após mudanças nas perguntas.
function deleteCurrentRondaFlow() {
  const ronda = state.currentRonda;
  if (!ronda) return;
  const label = CHECKLIST_LABELS[state.checklistType]?.screenTitle || "checklist";
  openConfirm(
    "Excluir checklist",
    `Este ${label.toLowerCase()} e todo o progresso registrado nele serão excluídos permanentemente.`,
    async () => {
      showLoading(true);
      try {
        await store.deleteRonda(ronda.id);
        const returnToHistory = state.editingFromHistory;
        state.currentRonda = null;
        state.checklistType = null;
        state.editingCompletedRonda = false;
        state.editingFromHistory = false;
        state.editSnapshot = null;
        state.isDirty = false;
        showToast("Checklist excluído.");
        if (returnToHistory) {
          await loadHistory();
          showScreen("screen-history");
        } else {
          await initHome();
          showScreen("screen-home");
        }
      } catch (e) {
        console.error(e);
        showToast("Erro ao excluir checklist.");
      } finally {
        showLoading(false);
      }
    },
    { confirmLabel: "Excluir", danger: true }
  );
}

async function finishSector() {
  const sector = state.sectors.find(s => s.id === state.activeSectorId);
  const sd = state.currentRonda.sectorsData[sector.id];
  sd.completed = true;
  showLoading(true);
  try {
    await store.saveRondaSector(state.currentRonda.id, sector.id, sd);
    showToast(`${sector.name} concluído.`);
    renderRondaSectors();
    showScreen("screen-ronda-sectors");
  } catch (e) {
    console.error(e);
    showToast("Erro ao salvar setor.");
  } finally {
    showLoading(false);
  }
}

/* ============================================================
   PENDÊNCIA (modal)
============================================================ */
function openPendenciaModal(sector, question) {
  const existing = (state.currentRonda.pendencias || []).find(p => p.sectorId === sector.id && p.questionId === question.id);
  state.pendenciaCtx = { sectorId: sector.id, sectorName: sector.name, questionId: question.id, questionText: question.text, editingId: existing ? existing.id : null };

  $("#pendencia-question-ref").textContent = `${sector.name} · ${question.text}`;
  $("#pendencia-descricao").value = existing ? existing.descricao : "";
  $("#pendencia-responsavel").value = existing ? existing.responsavel : (sector.responsavel || "");
  $("#pendencia-prazo").value = existing ? existing.prazo : "";
  state.selectedPriority = existing ? existing.prioridade : null;
  $all("#pendencia-prioridade .priority-chip").forEach(chip => {
    chip.classList.toggle("is-selected", chip.dataset.value === state.selectedPriority);
  });
  $("#btn-remove-pendencia").classList.toggle("hidden", !existing);

  $("#modal-pendencia").classList.remove("hidden");
}

function closePendenciaModal() {
  $("#modal-pendencia").classList.add("hidden");
  state.pendenciaCtx = null;
}

async function savePendencia() {
  const descricao = $("#pendencia-descricao").value.trim();
  if (!descricao) { showToast("Descreva a pendência."); return; }
  if (!state.selectedPriority) { showToast("Selecione a prioridade."); return; }

  const ctx = state.pendenciaCtx;
  const pendencias = [...(state.currentRonda.pendencias || [])];
  const payload = {
    id: ctx.editingId || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    sectorId: ctx.sectorId,
    sectorName: ctx.sectorName,
    questionId: ctx.questionId,
    questionText: ctx.questionText,
    descricao,
    responsavel: $("#pendencia-responsavel").value.trim(),
    prazo: $("#pendencia-prazo").value,
    prioridade: state.selectedPriority,
    createdAt: Date.now()
  };

  const idx = pendencias.findIndex(p => p.id === payload.id);
  if (idx >= 0) pendencias[idx] = payload; else pendencias.push(payload);

  state.currentRonda.pendencias = pendencias;
  showLoading(true);
  try {
    await store.saveRondaPendencias(state.currentRonda.id, pendencias);
    showToast("Pendência salva.");
    closePendenciaModal();
    renderSectorQuestions();
  } catch (e) {
    console.error(e);
    showToast("Erro ao salvar pendência.");
  } finally {
    showLoading(false);
  }
}

async function removePendencia() {
  const ctx = state.pendenciaCtx;
  const pendencias = (state.currentRonda.pendencias || []).filter(p => p.id !== ctx.editingId);
  state.currentRonda.pendencias = pendencias;
  showLoading(true);
  try {
    await store.saveRondaPendencias(state.currentRonda.id, pendencias);
    showToast("Pendência removida.");
    closePendenciaModal();
    renderSectorQuestions();
  } catch (e) {
    console.error(e);
  } finally {
    showLoading(false);
  }
}

/* ============================================================
   RESUMO DA RONDA
============================================================ */
async function finishRondaFlow() {
  const totals = computeRondaTotals();
  const total = totals.conform + totals.nonConform;
  const score = total ? Math.round((totals.conform / total) * 100) : 0;

  showLoading(true);
  try {
    await store.finishRonda(state.currentRonda.id, {
      score, conformCount: totals.conform, nonConformCount: totals.nonConform
    }, { isEdit: state.editingCompletedRonda });
    state.currentRonda.status = "completed";
    state.currentRonda.score = score;
    state.currentRonda.conformCount = totals.conform;
    state.currentRonda.nonConformCount = totals.nonConform;
    state.currentRonda.finishedAt = new Date();
    state.editSnapshot = snapshotRondaState(state.currentRonda);
    state.isDirty = false;
    renderSummary(state.currentRonda, { back: "screen-home" });
    showScreen("screen-summary");
  } catch (e) {
    console.error(e);
    showToast("Erro ao concluir ronda.");
  } finally {
    showLoading(false);
  }
}

function priorityBadgeHtml(p) {
  return `<span class="priority-badge ${p}">${p}</span>`;
}

function renderSummary(ronda, opts = {}) {
  $("#summary-date-label").textContent = fmtDateShort(ronda.startedAt);
  $("#score-percent").textContent = `${ronda.score ?? 0}%`;
  setRing($("#score-ring-fill"), ronda.score ?? 0);
  $("#summary-conform").textContent = ronda.conformCount ?? 0;
  $("#summary-nonconform").textContent = ronda.nonConformCount ?? 0;
  $("#summary-pendencias-count").textContent = (ronda.pendencias || []).length;

  const list = $("#summary-pendencias-list");
  list.innerHTML = "";
  if (!(ronda.pendencias || []).length) {
    list.innerHTML = `<div class="empty-state"><i data-lucide="check-circle-2"></i><p>Nenhuma pendência registrada.</p></div>`;
  } else {
    ronda.pendencias.forEach(p => {
      const card = document.createElement("div");
      card.className = "pendencia-card";
      card.innerHTML = `
        <div class="pendencia-head">
          <span class="pendencia-sector">${p.sectorName}</span>
          ${priorityBadgeHtml(p.prioridade)}
        </div>
        <p class="pendencia-desc">${p.descricao}</p>
        <div class="pendencia-meta">
          <span><i data-lucide="user"></i>${p.responsavel || "—"}</span>
          <span><i data-lucide="calendar"></i>${p.prazo || "sem prazo"}</span>
        </div>
      `;
      list.appendChild(card);
    });
  }
  refreshIcons();
}

/* ============================================================
   HISTÓRICO
============================================================ */
function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(range) {
  const now = new Date();
  if (range === "7" || range === "30") {
    const from = new Date(now);
    from.setDate(from.getDate() - (Number(range) - 1));
    return { from: toISODate(from), to: toISODate(now) };
  }
  if (range === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toISODate(from), to: toISODate(now) };
  }
  return { from: "", to: "" };
}

async function loadHistory() {
  if (!requireDb()) return;
  const customVisible = !$("#filter-custom-dates").classList.contains("hidden");
  let from, to;
  if (customVisible) {
    from = $("#filter-date-from").value;
    to = $("#filter-date-to").value;
  } else {
    ({ from, to } = rangeForPreset(state.historyRange));
  }
  try {
    state.historyItems = await store.getHistory(from, to);
    renderHistory();
  } catch (e) {
    console.error(e);
    showToast("Erro ao carregar histórico.");
  }
}

function scoreClass(score) {
  if (score >= 80) return "";
  if (score >= 50) return "score-mid";
  return "score-low";
}

function rondaSectorStats(ronda) {
  const entries = Object.values(ronda.sectorsData || {}).filter(sd => sd.totalQuestions > 0);
  const done = entries.filter(sd => sd.completed).length;
  return { total: entries.length, done };
}

function rondaPendStats(ronda) {
  const list = ronda.pendencias || [];
  const resolved = list.filter(p => p.resolvida).length;
  return { total: list.length, resolved };
}

function checklistTypeLabel(ronda) {
  return (ronda.type || "weekly") === "daily" ? "Diário" : "Semanal";
}

function historyBadgesHtml(ronda) {
  const sec = rondaSectorStats(ronda);
  const pend = rondaPendStats(ronda);
  const secOk = sec.total > 0 && sec.done === sec.total;
  const pendOk = pend.total === 0 || pend.resolved === pend.total;
  return `
    <span class="hist-badge"><i data-lucide="${(ronda.type || "weekly") === "daily" ? "sun" : "calendar-days"}"></i>${checklistTypeLabel(ronda)}</span>
    <span class="hist-badge ${secOk ? "is-ok" : ""}"><i data-lucide="layers"></i>${sec.done}/${sec.total} setores</span>
    <span class="hist-badge ${pendOk ? "is-ok" : "is-warn"}"><i data-lucide="${pend.total === 0 ? "check-circle-2" : "flag"}"></i>${pend.total === 0 ? "Sem pendências" : `${pend.resolved}/${pend.total} resolvidas`}</span>
  `;
}

function renderHistory() {
  const list = $("#history-list");
  list.innerHTML = "";
  $("#history-empty").classList.toggle("hidden", state.historyItems.length > 0);

  state.historyItems.forEach(r => {
    const card = document.createElement("div");
    card.className = "history-card";
    card.innerHTML = `
      <div class="history-score ${scoreClass(r.score || 0)}">${r.score ?? 0}%</div>
      <div class="history-body">
        <p class="history-date">${fmtDateShort(r.startedAt)}</p>
        <p class="history-sub">${r.conformCount ?? 0} conformes · ${r.nonConformCount ?? 0} não conformes</p>
        <div class="history-badges">${historyBadgesHtml(r)}</div>
      </div>
      <div class="sector-chevron"><i data-lucide="chevron-right"></i></div>
    `;
    card.addEventListener("click", () => openHistoryDetail(r));
    list.appendChild(card);
  });
  refreshIcons();
}

/* -------- Editar checklist já finalizado (via histórico) -------- */
function editHistoryRondaFlow(ronda) {
  openConfirm(
    "Editar checklist",
    `Você vai reabrir o checklist de ${fmtDateShort(ronda.startedAt)} para edição.`,
    () => startEditHistoryRonda(ronda),
    { confirmLabel: "Editar" }
  );
}

async function startEditHistoryRonda(ronda) {
  if (!requireDb()) return;
  try {
    await ensureSectorsLoaded();
    state.currentRonda = ronda;
    state.checklistType = ronda.type || "weekly";
    state.editingCompletedRonda = true;
    state.editingFromHistory = true;
    state.editSnapshot = snapshotRondaState(ronda);
    state.isDirty = false;
    renderRondaSectors();
    showScreen("screen-ronda-sectors");
  } catch (e) {
    console.error(e);
    showToast("Não foi possível abrir o checklist.");
  }
}

/* -------- Excluir checklist já finalizado (via histórico) -------- */
function deleteHistoryRondaFlow(ronda) {
  openConfirm(
    "Excluir checklist",
    `O checklist de ${fmtDateShort(ronda.startedAt)} será excluído permanentemente, junto com suas pendências.`,
    async () => {
      showLoading(true);
      try {
        await store.deleteRonda(ronda.id);
        state.historyItems = state.historyItems.filter(r => r.id !== ronda.id);
        renderHistory();
        showToast("Checklist excluído.");
      } catch (e) {
        console.error(e);
        showToast("Erro ao excluir checklist.");
      } finally {
        showLoading(false);
      }
    },
    { confirmLabel: "Excluir", danger: true }
  );
}

function openHistoryDetail(ronda) {
  $("#history-detail-title").textContent = fmtDateLabel(ronda.startedAt);
  const body = $("#history-detail-body");
  body.innerHTML = `
    <div class="score-card" style="margin-bottom:14px;">
      <div class="score-ring-block">
        <svg class="progress-ring progress-ring--score" viewBox="0 0 120 120">
          <circle class="progress-ring-track" cx="60" cy="60" r="52"></circle>
          <circle id="hist-score-ring" class="progress-ring-fill" cx="60" cy="60" r="52"></circle>
        </svg>
        <div class="progress-ring-label"><span>${ronda.score ?? 0}%</span><small>pontuação</small></div>
      </div>
      <div class="score-breakdown">
        <div class="score-row"><i data-lucide="check-circle-2" class="ic-ok"></i><span>Conformes</span><b>${ronda.conformCount ?? 0}</b></div>
        <div class="score-row"><i data-lucide="x-circle" class="ic-bad"></i><span>Não conformidades</span><b>${ronda.nonConformCount ?? 0}</b></div>
        <div class="score-row"><i data-lucide="flag" class="ic-warn"></i><span>Pendências</span><b>${(ronda.pendencias || []).length}</b></div>
      </div>
    </div>
    <div class="hist-status-row">${historyBadgesHtml(ronda)}</div>
    <div class="section-header" style="padding:14px 2px 10px;"><h3>Pendências</h3></div>
    <div class="card-list" id="hist-pend-list"></div>
  `;
  const pendList = body.querySelector("#hist-pend-list");
  const pendencias = ronda.pendencias || [];
  if (!pendencias.length) {
    pendList.innerHTML = `<div class="empty-state"><i data-lucide="check-circle-2"></i><p>Nenhuma pendência registrada.</p></div>`;
  }
  pendencias.forEach(p => {
    const card = document.createElement("div");
    card.className = "pendencia-card" + (p.resolvida ? " is-resolved" : "");
    card.innerHTML = `
      <div class="pendencia-head"><span class="pendencia-sector">${p.sectorName}</span>${priorityBadgeHtml(p.prioridade)}</div>
      <p class="pendencia-desc">${p.descricao}</p>
      <div class="pendencia-meta"><span><i data-lucide="user"></i>${p.responsavel || "—"}</span><span><i data-lucide="calendar"></i>${p.prazo || "sem prazo"}</span></div>
      <button type="button" class="btn-resolve ${p.resolvida ? "is-resolved" : ""}" data-id="${p.id}">
        <i data-lucide="${p.resolvida ? "check-circle-2" : "circle"}"></i>
        <span>${p.resolvida ? "Resolvida" : "Marcar como resolvida"}</span>
      </button>
    `;
    card.querySelector(".btn-resolve").addEventListener("click", () => {
      const willResolve = !p.resolvida;
      openConfirm(
        willResolve ? "Marcar como resolvida" : "Reabrir pendência",
        willResolve
          ? `Confirma que a pendência "${p.descricao}" foi resolvida?`
          : `Deseja reabrir a pendência "${p.descricao}"?`,
        () => toggleResolvePendencia(ronda, p.id),
        { confirmLabel: willResolve ? "Marcar como resolvida" : "Reabrir" }
      );
    });
    pendList.appendChild(card);
  });
  refreshIcons();
  setTimeout(() => setRing($("#hist-score-ring"), ronda.score ?? 0), 30);

  $("#btn-export-history-excel").onclick = () => exportRondaToExcel(ronda);
  $("#btn-edit-history").onclick = () => {
    $("#modal-history-detail").classList.add("hidden");
    editHistoryRondaFlow(ronda);
  };
  $("#btn-delete-history").onclick = () => {
    $("#modal-history-detail").classList.add("hidden");
    deleteHistoryRondaFlow(ronda);
  };
  $("#modal-history-detail").classList.remove("hidden");
}

async function toggleResolvePendencia(ronda, pendId) {
  const pendencias = (ronda.pendencias || []).map(p =>
    p.id === pendId ? { ...p, resolvida: !p.resolvida, resolvedAt: !p.resolvida ? Date.now() : null } : p
  );
  ronda.pendencias = pendencias;
  showLoading(true);
  try {
    await store.saveRondaPendencias(ronda.id, pendencias);
    const idx = state.historyItems.findIndex(r => r.id === ronda.id);
    if (idx >= 0) state.historyItems[idx].pendencias = pendencias;
    renderHistory();
    openHistoryDetail(ronda);
  } catch (e) {
    console.error(e);
    showToast("Erro ao atualizar pendência.");
  } finally {
    showLoading(false);
  }
}

/* ============================================================
   CONFIGURAÇÕES
============================================================ */
async function openSettings() {
  if (!requireDb()) { showScreen("screen-settings"); return; }
  showScreen("screen-settings");
  try {
    await ensureSectorsLoaded();
    renderSettingsSectors();
  } catch (e) {
    console.error(e);
    showToast("Erro ao carregar setores.");
  }
}

function renderSettingsSectors() {
  const list = $("#settings-sector-list");
  list.innerHTML = "";
  state.sectors.forEach(sector => {
    const weeklyCount = getSectorQuestions(sector, "weekly").length;
    const dailyCount = getSectorQuestions(sector, "daily").length;
    const card = document.createElement("div");
    card.className = "settings-sector-card";
    card.innerHTML = `
      <div class="sector-status"><i data-lucide="layers"></i></div>
      <div class="sector-body">
        <p class="sector-name">${sector.name}</p>
        <p class="sector-meta">${dailyCount} diária${dailyCount === 1 ? "" : "s"} · ${weeklyCount} semanal${weeklyCount === 1 ? "" : "s"}${sector.responsavel ? ` · <span class="meta-responsavel">Responsável: ${sector.responsavel}</span>` : ""}</p>
      </div>
      <div class="sector-chevron"><i data-lucide="chevron-right"></i></div>
    `;
    card.addEventListener("click", () => openSettingsQuestions(sector.id));
    list.appendChild(card);
  });
  refreshIcons();
}

async function addSectorFlow() {
  const input = $("#input-new-sector");
  const name = input.value.trim();
  if (!name) return;
  showLoading(true);
  try {
    await store.addSector(name);
    input.value = "";
    await loadSectors();
    renderSettingsSectors();
    showToast("Setor adicionado.");
  } catch (e) {
    console.error(e);
    showToast("Erro ao adicionar setor.");
  } finally {
    showLoading(false);
  }
}

function openSettingsQuestions(sectorId) {
  state.settingsSectorId = sectorId;
  state.settingsQuestionType = "weekly";
  $all("#settings-question-type-toggle .filter-chip").forEach(c => c.classList.toggle("is-selected", c.dataset.qtype === "weekly"));
  const sector = state.sectors.find(s => s.id === sectorId);
  renderResponsavelBlock(sector);
  renderSettingsQuestions();
  showScreen("screen-settings-questions");
}

// Mostra o responsável como card (toque para editar). Sai do modo edição
// e volta a exibir só o card com o nome, tanto ao salvar quanto ao abrir.
function renderResponsavelBlock(sector) {
  const name = (sector && sector.responsavel) || "";
  $("#responsavel-name-text").textContent = name || "Toque para definir";
  $("#responsavel-name-text").classList.toggle("is-empty", !name);
  $("#responsavel-display").classList.remove("hidden");
  $("#responsavel-edit").classList.add("hidden");
}

function openResponsavelEdit() {
  const sector = state.sectors.find(s => s.id === state.settingsSectorId);
  $("#input-sector-responsavel").value = (sector && sector.responsavel) || "";
  $("#responsavel-display").classList.add("hidden");
  $("#responsavel-edit").classList.remove("hidden");
  const input = $("#input-sector-responsavel");
  input.focus();
  input.select();
}

async function saveSectorResponsavelFlow() {
  const sector = state.sectors.find(s => s.id === state.settingsSectorId);
  if (!sector) return;
  const value = $("#input-sector-responsavel").value.trim();
  if (value !== (sector.responsavel || "")) {
    try {
      await store.updateSectorResponsavel(sector.id, value);
      sector.responsavel = value;
      showToast("Responsável atualizado.");
    } catch (e) {
      console.error(e);
      showToast("Erro ao salvar responsável.");
    }
  }
  renderResponsavelBlock(sector);
}

function renderSettingsQuestions() {
  const sector = state.sectors.find(s => s.id === state.settingsSectorId);
  const type = state.settingsQuestionType;
  $("#settings-sector-title").textContent = sector.name;
  const list = $("#settings-question-list");
  list.innerHTML = "";
  const questions = getSectorQuestions(sector, type);
  $("#settings-question-empty").classList.toggle("hidden", questions.length > 0);

  questions.forEach(q => {
    const card = document.createElement("div");
    card.className = "settings-question-card";
    if (state.editingQuestionId === q.id) {
      card.innerHTML = `
        <textarea class="edit-question-input" rows="2" style="flex:1;border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:14px;">${q.text}</textarea>
        <div class="q-actions">
          <button class="icon-btn btn-save-q"><i data-lucide="check"></i></button>
        </div>
      `;
      card.querySelector(".btn-save-q").addEventListener("click", async () => {
        const newText = card.querySelector(".edit-question-input").value.trim();
        if (!newText) return;
        showLoading(true);
        try {
          await store.updateQuestion(sector.id, q.id, newText, type);
          await loadSectors();
          state.editingQuestionId = null;
          renderSettingsQuestions();
        } finally { showLoading(false); }
      });
    } else {
      card.innerHTML = `
        <p class="q-text">${q.text}</p>
        <div class="q-actions">
          <button class="icon-btn btn-edit-q"><i data-lucide="pencil"></i></button>
          <button class="icon-btn btn-del-q"><i data-lucide="trash-2"></i></button>
        </div>
      `;
      card.querySelector(".btn-edit-q").addEventListener("click", () => {
        state.editingQuestionId = q.id;
        renderSettingsQuestions();
      });
      card.querySelector(".btn-del-q").addEventListener("click", () => {
        openConfirm("Remover pergunta", "Esta pergunta será removida do setor.", async () => {
          showLoading(true);
          try {
            await store.deleteQuestion(sector.id, q.id, type);
            await loadSectors();
            renderSettingsQuestions();
            showToast("Pergunta removida.");
          } finally { showLoading(false); }
        }, { confirmLabel: "Remover", danger: true });
      });
    }
    list.appendChild(card);
  });
  refreshIcons();
}

async function addQuestionFlow() {
  const input = $("#input-new-question");
  const text = input.value.trim();
  if (!text) return;
  showLoading(true);
  try {
    await store.addQuestion(state.settingsSectorId, text, state.settingsQuestionType);
    input.value = "";
    await loadSectors();
    renderSettingsQuestions();
  } catch (e) {
    console.error(e);
    showToast("Erro ao adicionar pergunta.");
  } finally {
    showLoading(false);
  }
}

function deleteSectorFlow() {
  const sector = state.sectors.find(s => s.id === state.settingsSectorId);
  openConfirm("Excluir setor", `"${sector.name}" e todas as suas perguntas serão excluídos permanentemente.`, async () => {
    showLoading(true);
    try {
      await store.deleteSector(sector.id);
      await loadSectors();
      renderSettingsSectors();
      showScreen("screen-settings");
      showToast("Setor excluído.");
    } finally { showLoading(false); }
  }, { confirmLabel: "Excluir", danger: true });
}

/* ============================================================
   Wiring de eventos
============================================================ */
function wireEvents() {
  $all("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      let target = btn.dataset.nav;
      if (target === "screen-home" && state.editingFromHistory) target = "screen-history";
      showScreen(target);
      if (target === "screen-ronda-sectors" && state.currentRonda) renderRondaSectors();
      if (target === "screen-home") {
        state.editingCompletedRonda = false;
        state.editSnapshot = null;
        state.isDirty = false;
        state.checklistType = null;
        initHome();
      }
      if (target === "screen-history") {
        state.editingCompletedRonda = false;
        state.editingFromHistory = false;
        state.editSnapshot = null;
        state.isDirty = false;
        state.currentRonda = null;
        loadHistory();
      }
    });
  });

  $("#btn-start-daily").addEventListener("click", () => openChecklistFlow("daily"));
  $("#btn-start-weekly").addEventListener("click", () => openChecklistFlow("weekly"));
  $("#btn-history").addEventListener("click", () => {
    state.historyRange = "all";
    $all("#history-filter-chips .filter-chip").forEach(c => c.classList.toggle("is-selected", c.dataset.range === "all"));
    $("#filter-custom-dates").classList.add("hidden");
    $("#filter-date-from").value = "";
    $("#filter-date-to").value = "";
    showScreen("screen-history");
    loadHistory();
  });
  $("#btn-settings").addEventListener("click", openSettings);

  $("#btn-finish-sector").addEventListener("click", finishSector);
  $("#btn-finish-ronda").addEventListener("click", finishRondaFlow);
  $("#btn-delete-ronda").addEventListener("click", deleteCurrentRondaFlow);
  $("#btn-finish-summary").addEventListener("click", () => {
    const returnToHistory = state.editingFromHistory;
    state.currentRonda = null;
    state.checklistType = null;
    state.editingCompletedRonda = false;
    state.editingFromHistory = false;
    state.editSnapshot = null;
    state.isDirty = false;
    if (returnToHistory) {
      loadHistory();
      showScreen("screen-history");
    } else {
      initHome();
      showScreen("screen-home");
    }
  });
  $("#btn-export-excel").addEventListener("click", () => exportRondaToExcel(state.currentRonda));

  // pendência modal
  $("#btn-save-pendencia").addEventListener("click", savePendencia);
  $("#btn-remove-pendencia").addEventListener("click", removePendencia);
  $all("#pendencia-prioridade .priority-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      state.selectedPriority = chip.dataset.value;
      $all("#pendencia-prioridade .priority-chip").forEach(c => c.classList.toggle("is-selected", c === chip));
    });
  });

  // modais fechar
  $all("[data-close-modal]").forEach(btn => {
    btn.addEventListener("click", () => {
      $("#modal-pendencia").classList.add("hidden");
      $("#modal-history-detail").classList.add("hidden");
    });
  });
  $all(".modal-overlay").forEach(ov => {
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.classList.add("hidden"); });
  });

  // confirm modal
  $("#btn-confirm-cancel").addEventListener("click", closeConfirm);
  $("#btn-confirm-ok").addEventListener("click", async () => {
    const action = state.confirmAction;
    closeConfirm();
    if (action) await action();
  });

  // histórico — seletor escopado ao grupo de período: usar ".filter-chip"
  // sem escopo aqui pegava também os chips "Semanal"/"Diário" das
  // Configurações (mesma classe visual), causando estados cruzados entre
  // as duas telas (chip errado marcado como selecionado, filtro resetado
  // sozinho, etc.)
  $all("#history-filter-chips .filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const range = chip.dataset.range;
      $all("#history-filter-chips .filter-chip").forEach(c => c.classList.toggle("is-selected", c === chip));
      if (range === "custom") {
        $("#filter-custom-dates").classList.toggle("hidden");
        return;
      }
      $("#filter-custom-dates").classList.add("hidden");
      $("#filter-date-from").value = "";
      $("#filter-date-to").value = "";
      state.historyRange = range;
      loadHistory();
    });
  });
  $("#filter-date-from").addEventListener("change", loadHistory);
  $("#filter-date-to").addEventListener("change", loadHistory);
  $("#btn-clear-filter").addEventListener("click", () => {
    $("#filter-date-from").value = "";
    $("#filter-date-to").value = "";
    loadHistory();
  });

  // configurações
  $("#btn-add-sector").addEventListener("click", addSectorFlow);
  $("#input-new-sector").addEventListener("keydown", e => { if (e.key === "Enter") addSectorFlow(); });
  $("#btn-add-question").addEventListener("click", addQuestionFlow);
  $("#btn-delete-sector").addEventListener("click", deleteSectorFlow);
  $("#input-sector-responsavel").addEventListener("blur", saveSectorResponsavelFlow);
  $("#input-sector-responsavel").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); $("#input-sector-responsavel").blur(); }
  });
  $("#responsavel-display").addEventListener("click", openResponsavelEdit);

  $all("#settings-question-type-toggle .filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      state.settingsQuestionType = chip.dataset.qtype;
      $all("#settings-question-type-toggle .filter-chip").forEach(c => c.classList.toggle("is-selected", c === chip));
      state.editingQuestionId = null;
      renderSettingsQuestions();
    });
  });
}

/* ============================================================
   Gesto de voltar (arrastar da borda esquerda), estilo iOS
============================================================ */
function initEdgeSwipeBack() {
  const EDGE_ZONE = 24;   // faixa sensível a partir da borda esquerda da tela
  const THRESHOLD = 70;   // distância mínima de arrasto para considerar "voltar"
  let startX = null, startY = null, tracking = false;

  document.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    tracking = t.clientX <= EDGE_ZONE;
    startX = t.clientX;
    startY = t.clientY;
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    if (!tracking || startX === null) { tracking = false; return; }
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = Math.abs(t.clientY - startY);
    tracking = false;
    if (dx > THRESHOLD && dy < 60) triggerBackGesture();
  }, { passive: true });
}

function triggerBackGesture() {
  // Se houver um modal aberto, o gesto fecha ele primeiro.
  const openModal = document.querySelector(".modal-overlay:not(.hidden)");
  if (openModal) {
    openModal.classList.add("hidden");
    return;
  }
  // Caso contrário, aciona o mesmo botão de voltar do topo da tela atual.
  const activeScreen = document.querySelector(".screen.is-active");
  const backBtn = activeScreen && activeScreen.querySelector(".topbar [data-nav]");
  if (backBtn) backBtn.click();
}

/* ============================================================
   Init
============================================================ */
async function init() {
  refreshIcons();
  wireEvents();
  initEdgeSwipeBack();

  if (!isFirebaseConfigured) {
    showToast("Configure suas credenciais em js/firebase-init.js", 5000);
    return;
  }

  try {
    // A ronda de hoje (card da home) não depende dos setores estarem
    // carregados — busca as duas coisas em paralelo, em vez de enfileirar,
    // pra o card aparecer assim que possível ao reabrir o app.
    await Promise.all([
      (async () => { await store.ensureDefaultSectors(); await loadSectors(); })(),
      initHome()
    ]);
  } catch (e) {
    console.error(e);
    showToast("Erro ao conectar ao Firestore.");
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
