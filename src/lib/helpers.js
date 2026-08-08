import { STATUS_META } from "../theme";

export const uid = () => Math.random().toString(36).slice(2, 10);

export function todayLabel() {
  const d = new Date();
  const dias = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtDuration(ms) {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

export function calcStats(ronda, questionsConfig) {
  let total = 0, answered = 0, points = 0, maxPoints = 0;
  let nao = 0, atingiu = 0, superou = 0;
  const pendencias = [];
  Object.keys(questionsConfig || {}).forEach((sectorId) => {
    (questionsConfig[sectorId] || []).forEach((q) => {
      total += 1;
      maxPoints += 2;
      const ans = ronda.answers?.[sectorId]?.[q.id];
      if (ans?.status) {
        answered += 1;
        points += STATUS_META[ans.status].points;
        if (ans.status === "nao") nao += 1;
        if (ans.status === "atingiu") atingiu += 1;
        if (ans.status === "superou") superou += 1;
      }
      if (ans?.pendencia) {
        pendencias.push({ ...ans.pendencia, sectorId, questionId: q.id, rondaId: ronda.id, rondaDate: ronda.date });
      }
    });
  });
  const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;
  return { total, answered, points, maxPoints, nao, atingiu, superou, pendencias, score, conformes: atingiu + superou };
}

export function avgScore(rondas, days = 7) {
  const cutoff = Date.now() - days * 86400000;
  const recent = rondas.filter((r) => new Date(r.date).getTime() >= cutoff && r.stats);
  if (recent.length === 0) return null;
  const sum = recent.reduce((acc, r) => acc + (r.stats?.score ?? 0), 0);
  return Math.round(sum / recent.length);
}

export function avgScoreDelta(rondas, days = 7) {
  const now = avgScore(rondas, days);
  const cutoff1 = Date.now() - days * 86400000;
  const cutoff2 = Date.now() - days * 2 * 86400000;
  const prevSet = rondas.filter((r) => {
    const t = new Date(r.date).getTime();
    return t >= cutoff2 && t < cutoff1 && r.stats;
  });
  if (now === null || prevSet.length === 0) return null;
  const prevAvg = Math.round(prevSet.reduce((acc, r) => acc + (r.stats?.score ?? 0), 0) / prevSet.length);
  return now - prevAvg;
}

export function allOpenPendencias(rondas, sectors) {
  const list = [];
  rondas.forEach((r) => {
    (r.stats?.pendencias || []).forEach((p) => {
      if (!p.resolved) {
        list.push({ ...p, sector: sectors.find((s) => s.id === p.sectorId)?.name || "" });
      }
    });
  });
  return list;
}
