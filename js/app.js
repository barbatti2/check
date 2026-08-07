import {
  db, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, writeBatch, Timestamp
} from "./firebase.js";
import { DEFAULT_SECTORS } from "./seed-data.js";
import { exportarRondaExcel } from "./export.js";

const root = document.getElementById("app");

const PRIORIDADES = ["baixa", "media", "alta"];
const PRIORIDADE_LABEL = { baixa: "Baixa", media: "Média", alta: "Alta" };

const state = {
  screen: "loading",       // loading | home | ronda | setor | resumo | historico | config
  stack: [],
  setores: [],
  rondaAtual: null,        // doc data + id da ronda em andamento
  buffer: {},              // { setorId: { perguntaId: {resposta, observacao, pendencia} } }
  resumo: null,            // { ronda, respostas, pendencias, naoConformidades }
  historico: { rondas: [], de: "", ate: "" },
  configOpen: {},          // setorId -> bool (accordion)
  activeSetorId: null,
  toastTimer: null
};

// ---------------------------------------------------------------- utils
const $ = (sel, node = document) => node.querySelector(sel);
const $$ = (sel, node = document) => [...node.querySelectorAll(sel)];
const uid = () => Math.random().toString(36).slice(2, 10);

function toast(msg) {
  $(".toast")?.remove();
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => t.remove(), 2400);
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}
function fmtDateFull(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}
function fmtTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function navigate(screen, opts = {}) {
  if (!opts.replace) state.stack.push(state.screen);
  state.screen = screen;
  render();
}
function back() {
  state.screen = state.stack.pop() || "home";
  render();
}

// ---------------------------------------------------------------- data layer
async function ensureSetores() {
  const snap = await getDocs(collection(db, "setores"));
  if (snap.empty) {
    const batch = writeBatch(db);
    DEFAULT_SECTORS.forEach((s) => {
      const ref = doc(collection(db, "setores"));
      batch.set(ref, s);
    });
    await batch.commit();
    return loadSetoresFromDb();
  }
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}
async function loadSetoresFromDb() {
  const snap = await getDocs(collection(db, "setores"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

async function findRondaEmAndamento() {
  const q = query(collection(db, "rondas"), where("status", "==", "em_andamento"));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function init() {
  try {
    state.setores = await ensureSetores();
    state.rondaAtual = await findRondaEmAndamento();
    if (state.rondaAtual) await hydrateBufferFromSaved(state.rondaAtual.id);
    state.screen = "home";
  } catch (e) {
    console.error(e);
    state.screen = "error";
  }
  render();
}

async function hydrateBufferFromSaved(rondaId) {
  // Recarrega respostas já salvas dos setores concluídos (modo leitura ao reabrir)
  const snap = await getDocs(collection(db, "rondas", rondaId, "respostas"));
  snap.docs.forEach((d) => {
    const r = d.data();
    state.buffer[r.setorId] = state.buffer[r.setorId] || {};
    state.buffer[r.setorId][r.perguntaId] = {
      resposta: r.resposta, observacao: r.observacao || "", pendencia: r.pendencia || null
    };
  });
}

// ---------------------------------------------------------------- ações: ronda
async function iniciarRonda() {
  if (state.rondaAtual) return navigate("ronda");
  const ref = await addDoc(collection(db, "rondas"), {
    inicio: serverTimestamp(),
    fim: null,
    status: "em_andamento",
    setoresConcluidos: [],
    pontuacao: null, conformes: 0, naoConformes: 0, pendenciasCount: 0
  });
  state.rondaAtual = { id: ref.id, setoresConcluidos: [], status: "em_andamento" };
  state.buffer = {};
  navigate("ronda");
}

function setorStatus(setorId) {
  return state.rondaAtual?.setoresConcluidos?.includes(setorId) ? "done" : "pending";
}

function bufferFor(setorId) {
  state.buffer[setorId] = state.buffer[setorId] || {};
  return state.buffer[setorId];
}

function abrirSetor(setorId) {
  state.activeSetorId = setorId;
  const setor = state.setores.find((s) => s.id === setorId);
  const buf = bufferFor(setorId);
  setor.perguntas.forEach((p) => { if (!buf[p.id]) buf[p.id] = { resposta: null, observacao: "", pendencia: null }; });
  navigate("setor");
}

function responder(perguntaId, valor) {
  const buf = bufferFor(state.activeSetorId);
  buf[perguntaId].resposta = valor;
  render();
}

function toggleObsBox(perguntaId) {
  const buf = bufferFor(state.activeSetorId);
  buf[perguntaId]._showObs = !buf[perguntaId]._showObs;
  render();
}

function abrirPendenciaSheet(perguntaId) {
  state.pendSheet = { perguntaId, descricao: "", responsavel: "", prazo: "", prioridade: "media" };
  render();
}
function fecharSheet() { state.pendSheet = null; render(); }

function salvarPendencia() {
  const p = state.pendSheet;
  if (!p.descricao.trim() || !p.responsavel.trim() || !p.prazo) {
    toast("Preencha descrição, responsável e prazo.");
    return;
  }
  const buf = bufferFor(state.activeSetorId);
  buf[p.perguntaId].pendencia = {
    descricao: p.descricao.trim(), responsavel: p.responsavel.trim(),
    prazo: p.prazo, prioridade: p.prioridade
  };
  state.pendSheet = null;
  render();
}
function removerPendencia(perguntaId) {
  const buf = bufferFor(state.activeSetorId);
  buf[perguntaId].pendencia = null;
  render();
}

function setorCompleto(setorId) {
  const setor = state.setores.find((s) => s.id === setorId);
  const buf = bufferFor(setorId);
  return setor.perguntas.every((p) => buf[p.id]?.resposta);
}

async function concluirSetor() {
  const setorId = state.activeSetorId;
  const setor = state.setores.find((s) => s.id === setorId);
  if (!setorCompleto(setorId)) { toast("Responda todas as perguntas do setor."); return; }

  const buf = bufferFor(setorId);
  const batch = writeBatch(db);
  setor.perguntas.forEach((p) => {
    const r = buf[p.id];
    const ref = doc(collection(db, "rondas", state.rondaAtual.id, "respostas"));
    batch.set(ref, {
      setorId, setorNome: setor.nome, perguntaId: p.id, perguntaTexto: p.texto,
      resposta: r.resposta, observacao: r.observacao || "", timestamp: serverTimestamp()
    });
    if (r.pendencia) {
      const pref = doc(collection(db, "pendencias"));
      batch.set(pref, {
        rondaId: state.rondaAtual.id, setorId, setorNome: setor.nome,
        perguntaId: p.id, perguntaTexto: p.texto, ...r.pendencia,
        status: "aberta", criadoEm: serverTimestamp()
      });
    }
  });
  const novosConcluidos = [...(state.rondaAtual.setoresConcluidos || []), setorId];
  batch.update(doc(db, "rondas", state.rondaAtual.id), { setoresConcluidos: novosConcluidos });
  await batch.commit();

  state.rondaAtual.setoresConcluidos = novosConcluidos;
  toast(`${setor.nome} concluído ✓`);
  back();
}

async function finalizarRonda() {
  const rondaId = state.rondaAtual.id;
  const respSnap = await getDocs(collection(db, "rondas", rondaId, "respostas"));
  const respostas = respSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const conformes = respostas.filter((r) => r.resposta === "atingiu").length;
  const naoConformes = respostas.filter((r) => r.resposta === "nao_atingiu").length;
  const pontuacao = respostas.length ? Math.round((conformes / respostas.length) * 100) : 0;

  const pendSnap = await getDocs(query(collection(db, "pendencias"), where("rondaId", "==", rondaId)));
  const pendencias = pendSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  await updateDoc(doc(db, "rondas", rondaId), {
    fim: serverTimestamp(), status: "concluida",
    pontuacao, conformes, naoConformes, pendenciasCount: pendencias.length
  });

  const rondaSnap = await getDoc(doc(db, "rondas", rondaId));
  state.resumo = { ronda: { id: rondaId, ...rondaSnap.data() }, respostas, pendencias };
  state.rondaAtual = null;
  state.buffer = {};
  state.stack = [];
  navigate("resumo", { replace: true });
}

async function abrirResumoHistorico(rondaId) {
  const rondaSnap = await getDoc(doc(db, "rondas", rondaId));
  const respSnap = await getDocs(collection(db, "rondas", rondaId, "respostas"));
  const pendSnap = await getDocs(query(collection(db, "pendencias"), where("rondaId", "==", rondaId)));
  state.resumo = {
    ronda: { id: rondaId, ...rondaSnap.data() },
    respostas: respSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    pendencias: pendSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  };
  navigate("resumo");
}

// ---------------------------------------------------------------- histórico
async function loadHistorico() {
  const q = query(collection(db, "rondas"), where("status", "==", "concluida"), orderBy("inicio", "desc"));
  const snap = await getDocs(q);
  state.historico.rondas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
function historicoFiltrado() {
  const { rondas, de, ate } = state.historico;
  return rondas.filter((r) => {
    if (!r.inicio) return true;
    const dt = r.inicio.toDate ? r.inicio.toDate() : new Date(r.inicio);
    const iso = dt.toISOString().slice(0, 10);
    if (de && iso < de) return false;
    if (ate && iso > ate) return false;
    return true;
  });
}

// ---------------------------------------------------------------- config
async function addSetor() {
  const nome = prompt("Nome do novo setor:");
  if (!nome || !nome.trim()) return;
  const icone = prompt("Emoji para representar o setor (ex: 🐾):", "🐾") || "🐾";
  await addDoc(collection(db, "setores"), {
    nome: nome.trim(), icone, ordem: state.setores.length, perguntas: []
  });
  state.setores = await loadSetoresFromDb();
  render();
}
async function removerSetor(setorId) {
  const setor = state.setores.find((s) => s.id === setorId);
  if (!confirm(`Remover o setor "${setor.nome}"? Isso não afeta rondas já registradas.`)) return;
  await deleteDoc(doc(db, "setores", setorId));
  state.setores = await loadSetoresFromDb();
  render();
}
async function addPergunta(setorId) {
  const setor = state.setores.find((s) => s.id === setorId);
  const texto = prompt("Nova pergunta:");
  if (!texto || !texto.trim()) return;
  const perguntas = [...setor.perguntas, { id: `q_${uid()}`, texto: texto.trim() }];
  await updateDoc(doc(db, "setores", setorId), { perguntas });
  state.setores = await loadSetoresFromDb();
  render();
}
async function removerPergunta(setorId, perguntaId) {
  const setor = state.setores.find((s) => s.id === setorId);
  const perguntas = setor.perguntas.filter((p) => p.id !== perguntaId);
  await updateDoc(doc(db, "setores", setorId), { perguntas });
  state.setores = await loadSetoresFromDb();
  render();
}
async function editarPerguntaTexto(setorId, perguntaId, novoTexto) {
  const setor = state.setores.find((s) => s.id === setorId);
  const perguntas = setor.perguntas.map((p) => (p.id === perguntaId ? { ...p, texto: novoTexto } : p));
  setor.perguntas = perguntas; // reflete localmente sem esperar round-trip
  await updateDoc(doc(db, "setores", setorId), { perguntas });
}

// ================================================================== RENDER
function render() {
  root.innerHTML = "";
  const map = {
    loading: renderLoading, error: renderError, home: renderHome, ronda: renderRonda,
    setor: renderSetorScreen, resumo: renderResumo, historico: renderHistoricoScreen, config: renderConfigScreen
  };
  (map[state.screen] || renderHome)();
  if (["home", "historico", "config"].includes(state.screen)) renderBottomNav();
  if (state.pendSheet) renderPendenciaSheet();
  bindEvents();
}

function renderLoading() {
  root.innerHTML = `<div class="screen" style="padding-top:120px;text-align:center">
    <div class="spinner"></div>
    <p style="color:var(--ink-soft);font-size:13px">Carregando sua loja…</p>
  </div>`;
}
function renderError() {
  root.innerHTML = `<div class="screen" style="padding-top:80px">
    <div class="empty-state">
      <div class="ic">⚠️</div>
      <div class="t">Não foi possível conectar ao Firebase</div>
      <div class="d">Configure suas credenciais em <code>js/firebase.js</code> e recarregue a página.</div>
    </div>
  </div>`;
}

function renderBottomNav() {
  const items = [
    { id: "home", ic: "🏠", label: "Início" },
    { id: "historico", ic: "🗂️", label: "Histórico" },
    { id: "config", ic: "⚙️", label: "Config" }
  ];
  const nav = document.createElement("div");
  nav.className = "bottom-nav";
  nav.innerHTML = items.map((i) => `
    <button class="nav-item ${state.screen === i.id ? "active" : ""}" data-nav="${i.id}">
      <span class="ic">${i.ic}</span>${i.label}
    </button>`).join("");
  root.appendChild(nav);
}

function renderHome() {
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const emAndamento = !!state.rondaAtual;
  const feitos = state.rondaAtual?.setoresConcluidos?.length || 0;

  const screen = document.createElement("div");
  screen.className = "screen";
  screen.style.paddingTop = "18px";
  screen.innerHTML = `
    <p style="color:var(--ink-soft);font-size:13px;font-weight:600;text-transform:capitalize">${hoje}</p>
    <h1 style="font-size:26px;margin-top:2px">Ronda Pet 🐾</h1>

    <div class="hero-card" style="margin-top:18px" data-action="iniciar-ronda">
      <div class="hero-eyebrow">${emAndamento ? "Ronda em andamento" : "Checklist diário"}</div>
      <div class="hero-title">${emAndamento ? `Continuar ronda (${feitos}/${state.setores.length})` : "Iniciar ronda de hoje"}</div>
      <div class="hero-desc">${emAndamento ? "Você tem setores pendentes de avaliação nesta ronda." : "Percorra os 13 setores da loja antes do checklist oficial."}</div>
    </div>

    <div class="action-grid">
      <button class="action-card" data-nav="historico">
        <div class="tile">🗂️</div>
        <div class="body">
          <div class="title">Histórico</div>
          <div class="desc">Consulte rondas anteriores e exporte relatórios</div>
        </div>
        <div class="chev">›</div>
      </button>
      <button class="action-card alt" data-nav="config">
        <div class="tile">⚙️</div>
        <div class="body">
          <div class="title">Configurações</div>
          <div class="desc">Cadastre setores e personalize as perguntas</div>
        </div>
        <div class="chev">›</div>
      </button>
    </div>
  `;
  root.appendChild(screen);
}

function renderRonda() {
  const total = state.setores.length;
  const feitos = state.rondaAtual?.setoresConcluidos?.length || 0;
  const pct = total ? Math.round((feitos / total) * 100) : 0;
  const todosFeitos = feitos === total && total > 0;

  const screen = document.createElement("div");
  screen.innerHTML = `
    <div class="topbar">
      <button class="back" data-nav="home">←</button>
      <div>
        <h1>Ronda de hoje</h1>
        <div class="sub">${feitos} de ${total} setores concluídos</div>
      </div>
    </div>
    <div class="screen" style="padding-top:10px">
      <div class="progress-bar-wrap">
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="progress-bar-label"><span>Progresso</span><span>${pct}%</span></div>
      </div>

      <div class="sector-grid">
        ${state.setores.map((s) => {
          const done = setorStatus(s.id) === "done";
          const buf = state.buffer[s.id] || {};
          const respondidas = s.perguntas.filter((p) => buf[p.id]?.resposta).length;
          const temNaoConforme = s.perguntas.some((p) => buf[p.id]?.resposta === "nao_atingiu");
          return `
          <button class="sector-card ${done ? "done" : ""}" data-open-setor="${s.id}">
            <div class="check">✓</div>
            <div class="ic">${s.icone || "🐾"}</div>
            <div class="name">${s.nome}</div>
            <div class="meta">
              ${done ? "Concluído" : `${respondidas}/${s.perguntas.length} respondidas`}
              ${temNaoConforme ? '<span class="dot-pend"></span>' : ""}
            </div>
          </button>`;
        }).join("")}
      </div>

      <div class="fab-bar">
        <button class="btn btn-primary" data-action="finalizar-ronda" ${todosFeitos ? "" : "disabled"}>
          ${todosFeitos ? "Finalizar ronda e ver resumo" : `Finalize todos os setores (${feitos}/${total})`}
        </button>
      </div>
    </div>
  `;
  root.appendChild(screen);
}

function renderSetorScreen() {
  const setor = state.setores.find((s) => s.id === state.activeSetorId);
  const buf = bufferFor(setor.id);
  const done = setorStatus(setor.id) === "done";
  const respondidas = setor.perguntas.filter((p) => buf[p.id]?.resposta).length;

  const screen = document.createElement("div");
  screen.innerHTML = `
    <div class="topbar">
      <button class="back" data-nav="ronda">←</button>
      <div>
        <h1>${setor.icone || "🐾"} ${setor.nome}</h1>
        <div class="sub">${done ? "Setor já concluído" : `${respondidas}/${setor.perguntas.length} respondidas`}</div>
      </div>
    </div>
    <div class="screen" style="padding-top:10px">
      ${setor.perguntas.length === 0 ? `
        <div class="empty-state">
          <div class="ic">📝</div>
          <div class="t">Nenhuma pergunta cadastrada</div>
          <div class="d">Vá em Configurações para adicionar perguntas a este setor.</div>
        </div>` : setor.perguntas.map((p, i) => {
          const r = buf[p.id] || {};
          return `
          <div class="q-card">
            <div class="q-idx">Pergunta ${i + 1}</div>
            <div class="q-text">${p.texto}</div>
            <div class="q-answers">
              <button class="q-btn ${r.resposta === "nao_atingiu" ? "sel-bad" : ""}" data-answer="${p.id}" data-value="nao_atingiu" ${done ? "disabled" : ""}>
                <span class="emo">😞</span>Não atingiu
              </button>
              <button class="q-btn ${r.resposta === "atingiu" ? "sel-ok" : ""}" data-answer="${p.id}" data-value="atingiu" ${done ? "disabled" : ""}>
                <span class="emo">🙂</span>Atingiu
              </button>
            </div>
            <div class="q-extra">
              ${!done ? `<button class="link-btn neutral" data-toggle-obs="${p.id}">💬 ${r._showObs || r.observacao ? "Observação" : "Adicionar observação"}</button>` : (r.observacao ? `<div class="q-obs" style="background:var(--surface-sunken)">${r.observacao}</div>` : "")}
              ${!done && (r._showObs || r.observacao) ? `<textarea class="q-obs" placeholder="Descreva o que foi observado…" data-obs="${p.id}">${r.observacao || ""}</textarea>` : ""}

              ${r.pendencia ? `
                <div class="pend-chip">
                  <span>⚠️ Pendência: ${r.pendencia.descricao} — ${PRIORIDADE_LABEL[r.pendencia.prioridade]}</span>
                  ${!done ? `<span class="x" data-remove-pend="${p.id}">✕</span>` : ""}
                </div>` : (!done ? `<button class="link-btn" data-open-pend="${p.id}">➕ Criar pendência</button>` : "")}
            </div>
          </div>`;
        }).join("")}

      ${!done ? `
      <div class="fab-bar">
        <button class="btn btn-primary" data-action="concluir-setor">Concluir setor</button>
      </div>` : ""}
    </div>
  `;
  root.appendChild(screen);
}

function renderPendenciaSheet() {
  const p = state.pendSheet;
  const wrap = document.createElement("div");
  wrap.className = "overlay";
  wrap.dataset.closeSheet = "1";
  wrap.innerHTML = `
    <div class="sheet" data-stop="1">
      <div class="grabber"></div>
      <h2>⚠️ Nova pendência</h2>
      <div class="field">
        <label>Descrição</label>
        <textarea rows="3" data-pend-field="descricao" placeholder="O que precisa ser corrigido?">${p.descricao}</textarea>
      </div>
      <div class="field">
        <label>Responsável</label>
        <input type="text" data-pend-field="responsavel" value="${p.responsavel}" placeholder="Nome do colaborador">
      </div>
      <div class="field">
        <label>Prazo</label>
        <input type="date" data-pend-field="prazo" value="${p.prazo}">
      </div>
      <div class="field">
        <label>Prioridade</label>
        <div class="priority-row">
          ${PRIORIDADES.map((pr) => `<div class="priority-opt p-${pr} ${p.prioridade === pr ? "sel" : ""}" data-pend-priority="${pr}">${PRIORIDADE_LABEL[pr]}</div>`).join("")}
        </div>
      </div>
      <button class="btn btn-primary" data-action="salvar-pendencia">Salvar pendência</button>
    </div>
  `;
  root.appendChild(wrap);
}

function renderResumo() {
  const { ronda, respostas, pendencias } = state.resumo;
  const naoConformidades = respostas.filter((r) => r.resposta === "nao_atingiu");
  const pct = ronda.pontuacao ?? 0;
  const tone = pct >= 85 ? "tone-ok" : pct >= 60 ? "tone-warn" : "tone-danger";

  const screen = document.createElement("div");
  screen.innerHTML = `
    <div class="topbar">
      <button class="back" data-nav="home">←</button>
      <div>
        <h1>Resumo da ronda</h1>
        <div class="sub">${fmtDateFull(ronda.inicio)}</div>
      </div>
    </div>
    <div class="screen" style="padding-top:0">
      <div class="summary-hero">
        <div class="ring big ${tone}" style="--pct:${pct}">
          <div class="ring-inner"><span class="num">${pct}%</span><span class="lbl">Pontuação</span></div>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-box ok"><div class="n">${ronda.conformes ?? 0}</div><div class="l">Conformes</div></div>
        <div class="stat-box bad"><div class="n">${ronda.naoConformes ?? 0}</div><div class="l">Não conf.</div></div>
        <div class="stat-box pend"><div class="n">${pendencias.length}</div><div class="l">Pendências</div></div>
      </div>

      <button class="btn btn-secondary" style="margin-top:20px" data-action="exportar-excel">📊 Exportar para Excel</button>

      ${naoConformidades.length ? `
        <div class="section-title">Não conformidades</div>
        ${naoConformidades.map((r) => `
          <div class="list-item">
            <div class="setor-tag">${r.setorNome}</div>
            <div class="q">${r.perguntaTexto}</div>
            ${r.observacao ? `<div class="obs">"${r.observacao}"</div>` : ""}
          </div>`).join("")}
      ` : ""}

      ${pendencias.length ? `
        <div class="section-title">Pendências criadas</div>
        ${pendencias.map((p) => `
          <div class="list-item">
            <div class="top-row">
              <div>
                <div class="setor-tag">${p.setorNome}</div>
                <div class="q">${p.descricao}</div>
              </div>
              <span class="badge p-${p.prioridade}">${PRIORIDADE_LABEL[p.prioridade]}</span>
            </div>
            <div class="pend-meta">
              <span>👤 ${p.responsavel}</span>
              <span>📅 ${new Date(p.prazo).toLocaleDateString("pt-BR")}</span>
            </div>
          </div>`).join("")}
      ` : ""}

      ${!naoConformidades.length && !pendencias.length ? `
        <div class="empty-state">
          <div class="ic">🎉</div>
          <div class="t">Ronda 100% conforme!</div>
          <div class="d">Nenhuma pendência ou não conformidade registrada.</div>
        </div>` : ""}

      <button class="btn btn-ghost" style="margin-top:16px" data-nav="home">Voltar ao início</button>
    </div>
  `;
  root.appendChild(screen);
}

function renderHistoricoScreen() {
  loadHistorico().then(render);
  const rondas = historicoFiltrado();
  const screen = document.createElement("div");
  screen.innerHTML = `
    <div class="topbar with-line">
      <div><h1>Histórico</h1><div class="sub">${rondas.length} ronda(s) registrada(s)</div></div>
    </div>
    <div class="screen" style="padding-top:10px">
      <div class="filter-row">
        <div class="field"><label>De</label><input type="date" data-filter="de" value="${state.historico.de}"></div>
        <div class="field"><label>Até</label><input type="date" data-filter="ate" value="${state.historico.ate}"></div>
      </div>
      <div style="margin-top:16px">
        ${rondas.length === 0 ? `
          <div class="empty-state">
            <div class="ic">🗂️</div>
            <div class="t">Nenhuma ronda encontrada</div>
            <div class="d">Rondas finalizadas aparecem aqui.</div>
          </div>` : rondas.map((r) => {
            const d = r.inicio?.toDate ? r.inicio.toDate() : new Date();
            return `
            <div class="history-item" data-open-resumo="${r.id}">
              <div class="date-tile">
                <div class="d">${d.getDate()}</div>
                <div class="m">${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</div>
              </div>
              <div class="body">
                <div class="title">Ronda das ${fmtTime(r.inicio)}</div>
                <div class="meta">${r.conformes ?? 0} conformes · ${r.naoConformes ?? 0} não conf. · ${r.pendenciasCount ?? 0} pend.</div>
              </div>
              <div class="score">${r.pontuacao ?? 0}%</div>
            </div>`;
          }).join("")}
      </div>
    </div>
  `;
  root.appendChild(screen);
}

function renderConfigScreen() {
  const screen = document.createElement("div");
  screen.innerHTML = `
    <div class="topbar with-line">
      <div><h1>Configurações</h1><div class="sub">Setores e perguntas da ronda</div></div>
    </div>
    <div class="screen" style="padding-top:10px">
      ${state.setores.map((s) => {
        const open = !!state.configOpen[s.id];
        return `
        <div class="config-sector">
          <div class="head" data-toggle-config="${s.id}">
            <div class="ic">${s.icone || "🐾"}</div>
            <div class="name">${s.nome}</div>
            <div class="qty">${s.perguntas.length} perg. ${open ? "▲" : "▼"}</div>
          </div>
          ${open ? `
          <div class="body">
            ${s.perguntas.map((p) => `
              <div class="config-q-row">
                <input type="text" value="${p.texto.replace(/"/g, "&quot;")}" data-edit-q="${s.id}|${p.id}">
                <span class="icon-x" data-del-q="${s.id}|${p.id}">✕</span>
              </div>`).join("")}
            <button class="add-q-btn" data-add-q="${s.id}">➕ Adicionar pergunta</button>
            <button class="link-btn" style="margin-top:10px" data-del-setor="${s.id}">🗑️ Remover setor</button>
          </div>` : ""}
        </div>`;
      }).join("")}
      <button class="btn btn-secondary" style="margin-top:6px" data-action="add-setor">➕ Adicionar novo setor</button>
    </div>
  `;
  root.appendChild(screen);
}

// ---------------------------------------------------------------- events
function bindEvents() {
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onInput);
}

function onClick(e) {
  const t = e.target;

  if (t.closest("[data-nav]")) return navigate(t.closest("[data-nav]").dataset.nav, { replace: true });
  if (t.closest(".back")) return back();
  if (t.closest("[data-action='iniciar-ronda']")) return iniciarRonda();
  if (t.closest("[data-open-setor]")) return abrirSetor(t.closest("[data-open-setor]").dataset.openSetor);
  if (t.closest("[data-answer]")) {
    const el = t.closest("[data-answer]");
    return responder(el.dataset.answer, el.dataset.value);
  }
  if (t.closest("[data-toggle-obs]")) return toggleObsBox(t.closest("[data-toggle-obs]").dataset.toggleObs);
  if (t.closest("[data-open-pend]")) return abrirPendenciaSheet(t.closest("[data-open-pend]").dataset.openPend);
  if (t.closest("[data-remove-pend]")) return removerPendencia(t.closest("[data-remove-pend]").dataset.removePend);
  if (t.closest("[data-action='concluir-setor']")) return concluirSetor();
  if (t.closest("[data-action='finalizar-ronda']") && !t.closest("[data-action='finalizar-ronda']").disabled) return finalizarRonda();
  if (t.closest("[data-action='exportar-excel']")) {
    const { ronda, respostas, pendencias } = state.resumo;
    return exportarRondaExcel(ronda, respostas, pendencias);
  }
  if (t.closest("[data-open-resumo]")) return abrirResumoHistorico(t.closest("[data-open-resumo]").dataset.openResumo);
  if (t.dataset.closeSheet) return fecharSheet();
  if (t.closest("[data-stop]") && t === t.closest("[data-stop]")) return;
  if (t.closest("[data-pend-priority]")) {
    state.pendSheet.prioridade = t.closest("[data-pend-priority]").dataset.pendPriority;
    return render();
  }
  if (t.closest("[data-action='salvar-pendencia']")) return salvarPendencia();
  if (t.closest("[data-toggle-config]")) {
    const id = t.closest("[data-toggle-config]").dataset.toggleConfig;
    state.configOpen[id] = !state.configOpen[id];
    return render();
  }
  if (t.closest("[data-add-q]")) return addPergunta(t.closest("[data-add-q]").dataset.addQ);
  if (t.closest("[data-del-q]")) {
    const [setorId, perguntaId] = t.closest("[data-del-q]").dataset.delQ.split("|");
    return removerPergunta(setorId, perguntaId);
  }
  if (t.closest("[data-del-setor]")) return removerSetor(t.closest("[data-del-setor]").dataset.delSetor);
  if (t.closest("[data-action='add-setor']")) return addSetor();
}

function onInput(e) {
  const t = e.target;
  if (t.dataset.obs) {
    bufferFor(state.activeSetorId)[t.dataset.obs].observacao = t.value;
  }
  if (t.dataset.pendField) {
    state.pendSheet[t.dataset.pendField] = t.value;
  }
  if (t.dataset.editQ) {
    const [setorId, perguntaId] = t.dataset.editQ.split("|");
    clearTimeout(t._debounce);
    t._debounce = setTimeout(() => editarPerguntaTexto(setorId, perguntaId, t.value), 500);
  }
  if (t.dataset.filter) {
    state.historico[t.dataset.filter] = t.value;
    render();
  }
}

init();
