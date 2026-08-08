function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("pt-BR");
}

export function exportRondaToExcel(ronda) {
  const wb = XLSX.utils.book_new();

  /* --- Resumo --- */
  const resumoRows = [
    ["Ronda", ronda.id],
    ["Início", fmtDate(ronda.startedAt)],
    ["Fim", fmtDate(ronda.finishedAt)],
    ["Pontuação (%)", ronda.score ?? 0],
    ["Itens conformes", ronda.conformCount ?? 0],
    ["Não conformidades", ronda.nonConformCount ?? 0],
    ["Pendências abertas", (ronda.pendencias || []).length]
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
  wsResumo["!cols"] = [{ wch: 22 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  /* --- Respostas detalhadas --- */
  const respostasRows = [["Setor", "Pergunta", "Resultado", "Observação"]];
  Object.values(ronda.sectorsData || {}).forEach(sector => {
    Object.values(sector.answers || {}).forEach(ans => {
      respostasRows.push([
        sector.name,
        ans.text,
        ans.status === "ok" ? "Atingiu" : "Não atingiu",
        ans.observation || ""
      ]);
    });
  });
  const wsRespostas = XLSX.utils.aoa_to_sheet(respostasRows);
  wsRespostas["!cols"] = [{ wch: 22 }, { wch: 50 }, { wch: 14 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsRespostas, "Respostas");

  /* --- Pendências --- */
  const pendRows = [["Setor", "Pergunta", "Descrição", "Responsável", "Prazo", "Prioridade"]];
  (ronda.pendencias || []).forEach(p => {
    pendRows.push([
      p.sectorName, p.questionText, p.descricao, p.responsavel || "", p.prazo || "", p.prioridade
    ]);
  });
  const wsPend = XLSX.utils.aoa_to_sheet(pendRows);
  wsPend["!cols"] = [{ wch: 20 }, { wch: 40 }, { wch: 40 }, { wch: 18 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsPend, "Pendências");

  const dateTag = ronda.startedAt
    ? (ronda.startedAt.toDate ? ronda.startedAt.toDate() : new Date(ronda.startedAt)).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  XLSX.writeFile(wb, `ronda_${dateTag}.xlsx`);
}
