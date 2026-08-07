// Setores padrão da loja pet e ícone (emoji) de cada um.
// Perguntas padrão são aplicadas a todos na primeira execução — tudo é
// editável depois em Configurações.

export const DEFAULT_QUESTIONS = [
  "Etiquetas de preço estão corretas, completas e visíveis?",
  "Prateleiras/gôndolas estão abastecidas e organizadas?",
  "Produtos dentro da validade e sem avarias?",
  "Limpeza, organização e sinalização do setor estão adequadas?"
];

export const DEFAULT_SECTORS = [
  { nome: "Promoções e Trade", icone: "🏷️" },
  { nome: "Processos Gerais", icone: "📋" },
  { nome: "Cães Pet Food", icone: "🐕" },
  { nome: "Cães Snacks", icone: "🦴" },
  { nome: "Gatos Pet Food", icone: "🐈" },
  { nome: "Gatos Snacks", icone: "🐟" },
  { nome: "Farmácia", icone: "💊" },
  { nome: "Higiene e Beleza", icone: "🧴" },
  { nome: "Acessórios", icone: "🎾" },
  { nome: "Camas", icone: "🛏️" },
  { nome: "Tapetes Higiênicos", icone: "🧻" },
  { nome: "Granulados", icone: "🪨" },
  { nome: "Aves, Roedores e Peixes", icone: "🐦" }
].map((s, i) => ({
  ...s,
  ordem: i,
  perguntas: DEFAULT_QUESTIONS.map((texto, qi) => ({ id: `q${i}_${qi}`, texto }))
}));
