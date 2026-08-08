import * as XLSX from "xlsx";
import { PRIORITY_META } from "../theme";
import { calcStats, fmtDate } from "./helpers";

export function exportExcel(ronda, sectors, showToast) {
  const stats = ronda.stats || calcStats(ronda, {});
  const resumo = [
    { Campo: "Data", Valor: fmtDate(ronda.date) },
    { Campo: "Pontuação", Valor: `${stats.score}%` },
    { Campo: "Conformes", Valor: stats.conformes },
    { Campo: "Não conformidades", Valor: stats.nao },
    { Campo: "Pendências", Valor: stats.pendencias.length },
  ];
  const pendencias = stats.pendencias.map((p) => ({
    Setor: sectors.find((s) => s.id === p.sectorId)?.name || "",
    Descricao: p.desc,
    Responsavel: p.responsavel,
    Prazo: p.prazo,
    Prioridade: PRIORITY_META[p.prioridade]?.label || "",
  }));
  try {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pendencias.length ? pendencias : [{ Info: "Sem pendências" }]), "Pendencias");
    XLSX.writeFile(wb, `ronda-${ronda.date.slice(0, 10)}.xlsx`);
  } catch (e) {
    showToast && showToast("Não foi possível gerar o Excel.");
  }
}

export function shareWhatsapp(ronda, sectors) {
  const stats = ronda.stats || calcStats(ronda, {});
  let text = `*Relatório de Ronda — ${fmtDate(ronda.date)}*\n`;
  text += `Pontuação: ${stats.score}%\n`;
  text += `Conformes: ${stats.conformes} | Não conf.: ${stats.nao}\n`;
  text += `Pendências: ${stats.pendencias.length}\n`;
  if (stats.pendencias.length) {
    text += `\n*Pendências:*\n`;
    stats.pendencias.forEach((p) => {
      const sector = sectors.find((s) => s.id === p.sectorId)?.name || "";
      text += `• [${sector}] ${p.desc} (${p.responsavel || "sem responsável"})\n`;
    });
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}
