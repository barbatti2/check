// Depende do SheetJS carregado globalmente (window.XLSX) via <script> no index.html

export function exportarRondaExcel(ronda, respostas, pendencias) {
  if (!window.XLSX) {
    alert("Biblioteca de exportação não carregada. Verifique sua conexão e tente novamente.");
    return;
  }

  const fmtData = (d) => {
    if (!d) return "";
    const dt = d.toDate ? d.toDate() : new Date(d);
    return dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const resumoRows = [
    ["Ronda Pet — Resumo da Ronda"],
    [],
    ["Início", fmtData(ronda.inicio)],
    ["Fim", fmtData(ronda.fim)],
    ["Pontuação geral (%)", ronda.pontuacao ?? ""],
    ["Itens conformes", ronda.conformes ?? 0],
    ["Não conformidades", ronda.naoConformes ?? 0],
    ["Pendências criadas", pendencias.length]
  ];

  const respostaRows = [
    ["Setor", "Pergunta", "Resultado", "Observação"],
    ...respostas.map((r) => [
      r.setorNome,
      r.perguntaTexto,
      r.resposta === "atingiu" ? "Atingiu" : "Não atingiu",
      r.observacao || ""
    ])
  ];

  const pendRows = [
    ["Setor", "Pergunta", "Descrição", "Responsável", "Prazo", "Prioridade", "Status"],
    ...pendencias.map((p) => [
      p.setorNome,
      p.perguntaTexto || "",
      p.descricao,
      p.responsavel,
      p.prazo ? new Date(p.prazo).toLocaleDateString("pt-BR") : "",
      p.prioridade,
      p.status === "concluida" ? "Concluída" : "Aberta"
    ])
  ];

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(resumoRows), "Resumo");
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(respostaRows), "Respostas");
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(pendRows), "Pendências");

  const dt = ronda.inicio?.toDate ? ronda.inicio.toDate() : new Date();
  const nomeArquivo = `ronda-pet_${dt.toISOString().slice(0, 10)}.xlsx`;
  window.XLSX.writeFile(wb, nomeArquivo);
}
