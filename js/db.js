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
  "Aves, Roedores e Peixes"
];

export const DEFAULT_DAILY_QUESTIONS = [
  "Todos os itens estão precificados?",
  "O setor está devidamente abastecido?",
  "O setor está organizado?"
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function makeDefaultDailyQuestions() {
  return DEFAULT_DAILY_QUESTIONS.map(text => ({ id: uid(), text }));
}

function questionsField(type) {
  return type === "daily" ? "dailyQuestions" : "questions";
}

function isSameDay(dateLike, ref = new Date()) {
  if (!dateLike) return false;
  const d = dateLike.toDate ? dateLike.toDate() : new Date(dateLike);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function startOfWeek(dateLike) {
  const d = dateLike.toDate ? dateLike.toDate() : new Date(dateLike);
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0=domingo..6=sábado
  const diff = (day === 0 ? -6 : 1) - day; // volta até a segunda-feira
  date.setDate(date.getDate() + diff);
  return date;
}

function isSameWeek(dateLike, ref = new Date()) {
  if (!dateLike) return false;
  return startOfWeek(dateLike).getTime() === startOfWeek(ref).getTime();
}

/* ---------------------------- SETORES ---------------------------- */

export async function ensureDefaultSectors() {
  const snap = await getDocs(collection(db, "sectors"));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  DEFAULT_SECTORS.forEach((name, i) => {
    const ref = doc(collection(db, "sectors"));
    batch.set(ref, { name, order: i, questions: [], dailyQuestions: makeDefaultDailyQuestions() });
  });
  await batch.commit();
}

export async function getSectors() {
  const snap = await getDocs(query(collection(db, "sectors"), orderBy("order", "asc")));
  const sectors = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Migração leve: setores criados antes do checklist diário existir não
  // têm "dailyQuestions" — semeia com as perguntas padrão automaticamente.
  const missing = sectors.filter(s => !Array.isArray(s.dailyQuestions));
  if (missing.length) {
    const batch = writeBatch(db);
    missing.forEach(s => {
      s.dailyQuestions = makeDefaultDailyQuestions();
      batch.update(doc(db, "sectors", s.id), { dailyQuestions: s.dailyQuestions });
    });
    await batch.commit();
  }

  return sectors;
}

export async function addSector(name) {
  const sectors = await getSectors();
  const order = sectors.length;
  const ref = await addDoc(collection(db, "sectors"), {
    name, order, questions: [], dailyQuestions: makeDefaultDailyQuestions()
  });
  return ref.id;
}

export async function updateSectorName(sectorId, name) {
  await updateDoc(doc(db, "sectors", sectorId), { name });
}

export async function deleteSector(sectorId) {
  await deleteDoc(doc(db, "sectors", sectorId));
}

export async function addQuestion(sectorId, text, type = "weekly") {
  const field = questionsField(type);
  const ref = doc(db, "sectors", sectorId);
  const snap = await getDoc(ref);
  const data = snap.data();
  const questions = Array.isArray(data[field]) ? [...data[field]] : [];
  questions.push({ id: uid(), text });
  await updateDoc(ref, { [field]: questions });
  return questions;
}

export async function updateQuestion(sectorId, questionId, text, type = "weekly") {
  const field = questionsField(type);
  const ref = doc(db, "sectors", sectorId);
  const snap = await getDoc(ref);
  const data = snap.data();
  const questions = (data[field] || []).map(q => q.id === questionId ? { ...q, text } : q);
  await updateDoc(ref, { [field]: questions });
  return questions;
}

export async function deleteQuestion(sectorId, questionId, type = "weekly") {
  const field = questionsField(type);
  const ref = doc(db, "sectors", sectorId);
  const snap = await getDoc(ref);
  const data = snap.data();
  const questions = (data[field] || []).filter(q => q.id !== questionId);
  await updateDoc(ref, { [field]: questions });
  return questions;
}

/* ---------------------------- RONDAS ---------------------------- */

export async function getInProgressRonda(type) {
  // Filtro simples (sem orderBy) para não exigir índice composto no Firestore.
  const q = query(collection(db, "rondas"), where("status", "==", "in_progress"));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (type) items = items.filter(r => (r.type || "weekly") === type);
  if (!items.length) return null;
  items.sort((a, b) => (b.startedAt?.toMillis?.() || 0) - (a.startedAt?.toMillis?.() || 0));
  return items[0];
}

export async function createRonda(sectors, type = "weekly") {
  const field = questionsField(type);
  const sectorsData = {};
  sectors.forEach(s => {
    // Congela as perguntas do setor no momento da criação: assim, se as
    // perguntas forem editadas/excluídas depois nas Configurações, o
    // checklist já em andamento não fica com dados incompatíveis (ids
    // "órfãos") que travavam a tela de setores.
    const questions = (s[field] || []).map(q => ({ id: q.id, text: q.text }));
    sectorsData[s.id] = {
      name: s.name,
      completed: false,
      totalQuestions: questions.length,
      questions,
      answers: {}
    };
  });
  const ref = await addDoc(collection(db, "rondas"), {
    type,
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
  // Na primeira finalização grava finishedAt; em edições posteriores do
  // checklist do mesmo período, preserva finishedAt original e grava editedAt.
  if (opts.isEdit) payload.editedAt = serverTimestamp();
  else payload.finishedAt = serverTimestamp();
  await updateDoc(doc(db, "rondas", rondaId), payload);
}

// Retorna o checklist do período atual (dia, para "daily"; semana, para
// "weekly"), esteja ele em andamento ou já concluído — usado para permitir
// apenas 1 checklist por período de cada tipo, com opção de editar.
export async function getPeriodRonda(type = "weekly") {
  const sameFn = type === "daily" ? isSameDay : isSameWeek;
  const [inProgress, completedSnap] = await Promise.all([
    getInProgressRonda(type),
    getDocs(query(collection(db, "rondas"), where("status", "==", "completed")))
  ]);
  if (inProgress && sameFn(inProgress.startedAt)) return inProgress;

  let items = completedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  items = items.filter(r => (r.type || "weekly") === type);
  if (!items.length) return null;
  items.sort((a, b) => (b.startedAt?.toMillis?.() || 0) - (a.startedAt?.toMillis?.() || 0));
  const last = items[0];
  return last && sameFn(last.startedAt) ? last : null;
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
