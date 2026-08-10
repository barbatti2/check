import { db } from "./firebase-init.js";
import {
  collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, writeBatch, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export const DEFAULT_SECTORS = [
  "Promoções e Trade",
  "Processos Gerais",
  "Cães Pet Food",
  "Cães Snacks",
  "Gatos Pet Food",
  "Gatos Snacks",
  "Farmácia",
  "Higiene e Beleza",
  "Acessórios",
  "Camas",
  "Tapetes Higiênicos",
  "Granulados",
  "Aves, Roedores e Peixes",
  "Brinquedos"
];

// Perguntas padrão que devem ser exatamente as mesmas em todos os setores
// de STANDARD_QUESTION_SECTORS (ver syncStandardSectors).
export const STANDARD_QUESTIONS = [
  "Prateleiras em perfeitas condições?",
  "Porta etiquetas em perfeita condições, sem réguas promocionais e sem \"cola\"?",
  "Todos os itens estão precificados?",
  "O controle de validade (FIFO) é realizado durante a reposição de produtos? (FISCALIZAR)",
  "Produtos próximos dos vencimentos (4 meses) foram identificados, registrados e destacados no ponto de venda?",
  "O setor está devidamente abastecido? Há produto para ser abastecido e não está no ponto de venda?",
  "O setor está com LAYOUT adequado?",
  "Os corredores estão desobstruídos?",
  "O aéreo está abastecido e identificado com cartaz ou etiqueta de preço?"
];

export const STANDARD_QUESTION_SECTORS = [
  "Cães Pet Food",
  "Cães Snacks",
  "Gatos Pet Food",
  "Gatos Snacks",
  "Aves, Roedores e Peixes",
  "Higiene e Beleza",
  "Tapetes Higiênicos",
  "Granulados",
  "Acessórios",
  "Brinquedos",
  "Camas",
  "Farmácia"
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function isSameDay(dateLike, ref = new Date()) {
  if (!dateLike) return false;
  const d = dateLike.toDate ? dateLike.toDate() : new Date(dateLike);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

/* ---------------------------- SETORES ---------------------------- */

export async function ensureDefaultSectors() {
  const snap = await getDocs(collection(db, "sectors"));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  DEFAULT_SECTORS.forEach((name, i) => {
    const ref = doc(collection(db, "sectors"));
    batch.set(ref, { name, order: i, questions: [] });
  });
  await batch.commit();
}

// Garante que os setores de STANDARD_QUESTION_SECTORS existam e estejam
// todos com exatamente as mesmas STANDARD_QUESTIONS. Roda apenas uma vez
// (marca em meta/std_sectors_v1) para não sobrescrever edições futuras
// feitas pelo usuário em Configurações.
export async function syncStandardSectors() {
  const metaRef = doc(db, "meta", "std_sectors_v1");
  const metaSnap = await getDoc(metaRef);
  if (metaSnap.exists()) return;

  const snap = await getDocs(collection(db, "sectors"));
  const existing = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const norm = (s) => s.trim().toLowerCase();

  const batch = writeBatch(db);
  let nextOrder = existing.reduce((max, s) => Math.max(max, s.order ?? 0), -1) + 1;

  STANDARD_QUESTION_SECTORS.forEach(name => {
    const match = existing.find(s => norm(s.name) === norm(name));
    // Cada setor recebe sua própria cópia dos ids das perguntas (mesmo
    // texto, "exatamente iguais", mas ids independentes por setor).
    const questions = STANDARD_QUESTIONS.map(text => ({ id: uid(), text }));
    if (match) {
      batch.update(doc(db, "sectors", match.id), { questions });
    } else {
      const ref = doc(collection(db, "sectors"));
      batch.set(ref, { name, order: nextOrder++, questions });
    }
  });

  batch.set(metaRef, { appliedAt: serverTimestamp() });
  await batch.commit();
}

export async function getSectors() {
  const snap = await getDocs(query(collection(db, "sectors"), orderBy("order", "asc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addSector(name) {
  const sectors = await getSectors();
  const order = sectors.length;
  const ref = await addDoc(collection(db, "sectors"), { name, order, questions: [] });
  return ref.id;
}

export async function updateSectorName(sectorId, name) {
  await updateDoc(doc(db, "sectors", sectorId), { name });
}

export async function deleteSector(sectorId) {
  await deleteDoc(doc(db, "sectors", sectorId));
}

export async function addQuestion(sectorId, text) {
  const ref = doc(db, "sectors", sectorId);
  const snap = await getDoc(ref);
  const data = snap.data();
  const questions = Array.isArray(data.questions) ? [...data.questions] : [];
  questions.push({ id: uid(), text });
  await updateDoc(ref, { questions });
  return questions;
}

export async function updateQuestion(sectorId, questionId, text) {
  const ref = doc(db, "sectors", sectorId);
  const snap = await getDoc(ref);
  const data = snap.data();
  const questions = (data.questions || []).map(q => q.id === questionId ? { ...q, text } : q);
  await updateDoc(ref, { questions });
  return questions;
}

export async function deleteQuestion(sectorId, questionId) {
  const ref = doc(db, "sectors", sectorId);
  const snap = await getDoc(ref);
  const data = snap.data();
  const questions = (data.questions || []).filter(q => q.id !== questionId);
  await updateDoc(ref, { questions });
  return questions;
}

/* ---------------------------- RONDAS ---------------------------- */

export async function getInProgressRonda() {
  // Filtro simples (sem orderBy) para não exigir índice composto no Firestore.
  const q = query(collection(db, "rondas"), where("status", "==", "in_progress"));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => (b.startedAt?.toMillis?.() || 0) - (a.startedAt?.toMillis?.() || 0));
  return items[0];
}

export async function createRonda(sectors) {
  const sectorsData = {};
  sectors.forEach(s => {
    sectorsData[s.id] = {
      name: s.name,
      completed: false,
      totalQuestions: (s.questions || []).length,
      answers: {}
    };
  });
  const ref = await addDoc(collection(db, "rondas"), {
    startedAt: serverTimestamp(),
    finishedAt: null,
    status: "in_progress",
    sectorsData,
    pendencias: [],
    score: 0,
    conformCount: 0,
    nonConformCount: 0
  });
  const snap = await getDoc(ref);
  return { id: ref.id, ...snap.data(), startedAt: new Date() };
}

export async function saveRondaSector(rondaId, sectorId, sectorObj) {
  await updateDoc(doc(db, "rondas", rondaId), {
    [`sectorsData.${sectorId}`]: sectorObj
  });
}

export async function saveRondaPendencias(rondaId, pendencias) {
  await updateDoc(doc(db, "rondas", rondaId), { pendencias });
}

export async function finishRonda(rondaId, { score, conformCount, nonConformCount }, opts = {}) {
  const payload = { status: "completed", score, conformCount, nonConformCount };
  // Na primeira finalização grava finishedAt; em edições posteriores da
  // ronda do mesmo dia, preserva finishedAt original e grava editedAt.
  if (opts.isEdit) payload.editedAt = serverTimestamp();
  else payload.finishedAt = serverTimestamp();
  await updateDoc(doc(db, "rondas", rondaId), payload);
}

// Retorna a ronda de hoje, esteja ela em andamento ou já concluída
// (usado para permitir apenas 1 ronda por dia, com opção de editar).
export async function getTodayRonda() {
  const inProgress = await getInProgressRonda();
  if (inProgress && isSameDay(inProgress.startedAt)) return inProgress;

  const q = query(collection(db, "rondas"), where("status", "==", "completed"));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => (b.startedAt?.toMillis?.() || 0) - (a.startedAt?.toMillis?.() || 0));
  const last = items[0];
  return last && isSameDay(last.startedAt) ? last : null;
}

export async function getRonda(rondaId) {
  const snap = await getDoc(doc(db, "rondas", rondaId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function deleteRonda(rondaId) {
  await deleteDoc(doc(db, "rondas", rondaId));
}

export async function getHistory(dateFrom, dateTo) {
  // Filtro simples (sem orderBy) para não exigir índice composto no Firestore;
  // ordenação e filtro de datas são feitos no cliente.
  const q = query(collection(db, "rondas"), where("status", "==", "completed"));
  const snap = await getDocs(q);
  let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (dateFrom) {
    const from = new Date(dateFrom + "T00:00:00");
    items = items.filter(r => r.startedAt && r.startedAt.toDate() >= from);
  }
  if (dateTo) {
    const to = new Date(dateTo + "T23:59:59");
    items = items.filter(r => r.startedAt && r.startedAt.toDate() <= to);
  }
  items.sort((a, b) => (b.startedAt?.toMillis?.() || 0) - (a.startedAt?.toMillis?.() || 0));
  return items;
}
