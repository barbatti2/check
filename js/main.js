import { isFirebaseConfigured } from "./firebase-init.js";
import * as store from "./db.js";
import { exportRondaToExcel } from "./export.js";

/* ============================================================
   Estado global
============================================================ */
const state = {
  sectors: [],
  currentRonda: null,
  activeSectorId: null,
  historyItems: [],
  settingsSectorId: null,
  editingQuestionId: null,
  pendenciaCtx: null,      // { sectorId, questionId, questionText, editingId }
  selectedPriority: null,
  confirmAction: null,
  deletePendingSectorId: null,
  editingCompletedRonda: false,
  editingFromHistory: false,
  historyRange: "all"
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
function showToast(msg, ms = 2400) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.toggle("toast--wrap", msg.length > 40);
  t.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-visible"), ms);
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
   Swipe actions (arrastar card para revelar ações)
============================================================ */
let openSwipeEl = null;
const swipeRegistry = new Map();

function closeAllSwipes(except) {
  if (openSwipeEl && openSwipeEl !== except) {
    const fn = swipeRegistry.get(openSwipeEl);
    if (fn) fn();
  }
}

function attachSwipe(wrapEl, contentEl, actionsWidth) {
  let startX = 0, startY = 0, baseX = 0, dragging = false, decided = null, suppressClick = false;

  const setX = (x, animate) => {
    contentEl.style.transition = animate ? "" : "none";
    contentEl.style.transform = `translateX(${x}px)`;
  };
  const openIt = () => {
    closeAllSwipes(contentEl);
    setX(-actionsWidth, true);
    contentEl.classList.add("is-open");
    openSwipeEl = contentEl;
  };
  const closeIt = () => {
    setX(0, true);
    contentEl.classList.remove("is-open");
    if (openSwipeEl === contentEl) openSwipeEl = null;
  };
  swipeRegistry.set(contentEl, closeIt);

  contentEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX = e.clientX; startY = e.clientY; dragging = true; decided = null;
    baseX = contentEl.classList.contains("is-open") ? -actionsWidth : 0;
  });
  contentEl.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (decided === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      decided = Math.abs(dx) > Math.abs(dy) ? "x" : "n";
      if (decided === "x") { try { contentEl.setPointerCapture(e.pointerId); } catch (_) {} }
      else { dragging = false; return; }
    }
    e.preventDefault();
    let next = baseX + dx;
    next = Math.min(0, Math.max(-actionsWidth, next));
    setX(next, false);
  });
  const finish = (e) => {
    if (!dragging) return;
    dragging = false;
    if (decided === "x") {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 60);
      const dx = e.clientX - startX;
      const finalX = baseX + dx;
      if (finalX < -actionsWidth / 2) openIt(); else closeIt();
    }
    decided = null;
  };
  contentEl.addEventListener("pointerup", finish);
  contentEl.addEventListener("pointercancel", finish);

  contentEl.addEventListener("click", (e) => {
    if (suppressClick || contentEl.classList.contains("is-open")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (contentEl.classList.contains("is-open") && !suppressClick) closeIt();
    }
  }, true);

  return { close: closeIt };
}

/* ============================================================
   HOME
============================================================ */
async function initHome() {
  const card = $("#home-resume-card");
  if (!isFirebaseConfigured) { card.classList.add("hidden"); return; }
  try {
    const today = await store.getTodayRonda();
    if (today && today.status === "in_progress") {
      state.currentRonda = today;
      card.querySelector(".resume-title").textContent = "Ronda em andamento";
      $("#resume-icon-wrap").innerHTML = '<i data-lucide="play-circle"></i>';
      $("#resume-sub-text").textContent = `Iniciada às ${fmtTime(today.startedAt)}`;
      $("#btn-resume-ronda").textContent = "Continuar";
      card.classList.remove("hidden");
    } else if (today && today.status === "completed") {
      state.currentRonda = today;
      card.querySelector(".resume-title").textContent = "Ronda de hoje concluída";
      $("#resume-icon-wrap").innerHTML = '<i data-lucide="check-circle-2"></i>';
      $("#resume-sub-text").textContent = `Pontuação ${today.score ?? 0}% · toque para editar`;
      $("#btn-resume-ronda").textContent = "Editar";
      card.classList.remove("hidden");
    } else {
      state.currentRonda = null;
      card.classList.add("hidden");
    }
    refreshIcons();
  } catch (e) {
    console.error(e);
  }
}

async function loadSectors() {
  state.sectors = await store.getSectors();
}

async function startOrResumeRonda() {
  if (!requireDb()) return;
  try {
    await loadSectors();
    if (!state.sectors.some(s => (s.questions || []).length > 0)) {
      showToast("Cadastre perguntas nos setores em Configurações antes de iniciar.");
      return;
    }

    // Apenas 1 ronda por dia: se já existe uma (em andamento ou concluída)
    // reaproveita, permitindo continuar ou editar em vez de criar outra.
    const today = await store.getTodayRonda();
    if (today) {
      state.currentRonda = today;
      state.editingCompletedRonda = today.status === "completed";
      if (state.editingCompletedRonda) {
        showToast("Ronda de hoje já concluída. Abrindo para edição.");
      }
    } else {
      state.currentRonda = await store.createRonda(state.sectors);
      state.editingCompletedRonda = false;
    }
    renderRondaSectors();
    showScreen("screen-ronda-sectors");
  } catch (e) {
    console.error(e);
    showToast("Não foi possível iniciar a ronda.");
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
  $("#ronda-date-label").textContent = fmtDateLabel(ronda.startedAt);

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
    const sd = ronda.sectorsData[sector.id] || { completed: false, answers: {}, totalQuestions: (sector.questions || []).length };
    const total = sector.questions ? sector.questions.length : 0;
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

  const allDone = totals.sectorsWithContent > 0 && totals.sectorsDone === totals.sectorsWithContent;
  $("#ronda-finish-bar").classList.toggle("hidden", !allDone);
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

  const questions = sector.questions || [];
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
  const question = sector.questions.find(q => q.id === questionId);
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
  const questions = sector.questions || [];
  const allAnswered = questions.length > 0 && questions.every(q => sd.answers[q.id] && sd.answers[q.id].status);
  $("#btn-finish-sector").disabled = !allAnswered;
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
  $("#pendencia-responsavel").value = existing ? existing.responsavel : "";
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

function historyBadgesHtml(ronda) {
  const sec = rondaSectorStats(ronda);
  const pend = rondaPendStats(ronda);
  const secOk = sec.total > 0 && sec.done === sec.total;
  const pendOk = pend.total === 0 || pend.resolved === pend.total;
  return `
    <span class="hist-badge ${secOk ? "is-ok" : ""}"><i data-lucide="layers"></i>${sec.done}/${sec.total} setores</span>
    <span class="hist-badge ${pendOk ? "is-ok" : "is-warn"}"><i data-lucide="${pend.total === 0 ? "check-circle-2" : "flag"}"></i>${pend.total === 0 ? "Sem pendências" : `${pend.resolved}/${pend.total} resolvidas`}</span>
  `;
}

function renderHistory() {
  const list = $("#history-list");
  list.innerHTML = "";
  $("#history-empty").classList.toggle("hidden", state.historyItems.length > 0);

  state.historyItems.forEach(r => {
    const wrap = document.createElement("div");
    wrap.className = "swipe-wrap";
    wrap.innerHTML = `
      <div class="swipe-actions">
        <button type="button" class="swipe-action swipe-action--edit" data-action="edit">
          <i data-lucide="pencil"></i><span>Editar</span>
        </button>
        <button type="button" class="swipe-action swipe-action--delete" data-action="delete">
          <i data-lucide="trash-2"></i><span>Excluir</span>
        </button>
      </div>
      <div class="swipe-content history-card">
        <div class="history-score ${scoreClass(r.score || 0)}">${r.score ?? 0}%</div>
        <div class="history-body">
          <p class="history-date">${fmtDateShort(r.startedAt)}</p>
          <p class="history-sub">${r.conformCount ?? 0} conformes · ${r.nonConformCount ?? 0} não conformes</p>
          <div class="history-badges">${historyBadgesHtml(r)}</div>
        </div>
        <div class="swipe-hint-icon"><i data-lucide="chevrons-left"></i></div>
      </div>
    `;
    const content = wrap.querySelector(".swipe-content");
    attachSwipe(wrap, content, 144);

    content.addEventListener("click", () => openHistoryDetail(r));
    wrap.querySelector('[data-action="edit"]').addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllSwipes();
      editHistoryRondaFlow(r);
    });
    wrap.querySelector('[data-action="delete"]').addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllSwipes();
      deleteHistoryRondaFlow(r);
    });
    list.appendChild(wrap);
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
    await loadSectors();
    state.currentRonda = ronda;
    state.editingCompletedRonda = true;
    state.editingFromHistory = true;
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
    await loadSectors();
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
    const count = (sector.questions || []).length;
    const card = document.createElement("div");
    card.className = "settings-sector-card";
    card.innerHTML = `
      <div class="sector-status"><i data-lucide="layers"></i></div>
      <div class="sector-body">
        <p class="sector-name">${sector.name}</p>
        <p class="sector-meta">${count} pergunta${count === 1 ? "" : "s"}</p>
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
  renderSettingsQuestions();
  showScreen("screen-settings-questions");
}

function renderSettingsQuestions() {
  const sector = state.sectors.find(s => s.id === state.settingsSectorId);
  $("#settings-sector-title").textContent = sector.name;
  const list = $("#settings-question-list");
  list.innerHTML = "";
  const questions = sector.questions || [];
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
          await store.updateQuestion(sector.id, q.id, newText);
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
            await store.deleteQuestion(sector.id, q.id);
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
    await store.addQuestion(state.settingsSectorId, text);
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
      if (target === "screen-home") { state.editingCompletedRonda = false; initHome(); }
      if (target === "screen-history") {
        state.editingCompletedRonda = false;
        state.editingFromHistory = false;
        state.currentRonda = null;
        loadHistory();
      }
    });
  });

  $("#btn-start-ronda").addEventListener("click", startOrResumeRonda);
  $("#btn-resume-ronda").addEventListener("click", startOrResumeRonda);
  $("#btn-history").addEventListener("click", () => {
    state.historyRange = "all";
    $all(".filter-chip").forEach(c => c.classList.toggle("is-selected", c.dataset.range === "all"));
    $("#filter-custom-dates").classList.add("hidden");
    $("#filter-date-from").value = "";
    $("#filter-date-to").value = "";
    showScreen("screen-history");
    loadHistory();
  });
  $("#btn-settings").addEventListener("click", openSettings);

  $("#btn-finish-sector").addEventListener("click", finishSector);
  $("#btn-finish-ronda").addEventListener("click", finishRondaFlow);
  $("#btn-finish-summary").addEventListener("click", () => {
    const returnToHistory = state.editingFromHistory;
    state.currentRonda = null;
    state.editingCompletedRonda = false;
    state.editingFromHistory = false;
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

  // histórico
  $all(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const range = chip.dataset.range;
      $all(".filter-chip").forEach(c => c.classList.toggle("is-selected", c === chip));
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

  // swipe do card de retomada na home
  attachSwipe($("#home-resume-card"), $("#home-resume-card .resume-card"), 116);
}

/* ============================================================
   Init
============================================================ */
async function init() {
  refreshIcons();
  wireEvents();

  if (!isFirebaseConfigured) {
    showToast("Configure suas credenciais em js/firebase-init.js", 5000);
    return;
  }

  try {
    await store.ensureDefaultSectors();
    await loadSectors();
    await initHome();
  } catch (e) {
    console.error(e);
    showToast("Erro ao conectar ao Firestore.");
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
