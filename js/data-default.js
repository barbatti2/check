// Setores padrão da ronda + perguntas iniciais (o usuário pode editar
// tudo depois em Configurações).

export const DEFAULT_SECTORS = [
  { id: "promocoes_trade", nome: "Promoções e Trade", icone: "🏷️", ativo: true },
  { id: "processos_gerais", nome: "Processos Gerais", icone: "📋", ativo: true },
  { id: "caes_petfood", nome: "Cães Pet Food", icone: "🍖", ativo: true },
  { id: "caes_snacks", nome: "Cães Snacks", icone: "🦴", ativo: true },
  { id: "gatos_petfood", nome: "Gatos Pet Food", icone: "🐟", ativo: true },
  { id: "gatos_snacks", nome: "Gatos Snacks", icone: "🐾", ativo: true },
  { id: "farmacia", nome: "Farmácia", icone: "💊", ativo: true },
  { id: "higiene_beleza", nome: "Higiene e Beleza", icone: "🧴", ativo: true },
  { id: "acessorios", nome: "Acessórios", icone: "🎾", ativo: true },
  { id: "camas", nome: "Camas", icone: "🛏️", ativo: true },
  { id: "tapetes_higienicos", nome: "Tapetes Higiênicos", icone: "🧻", ativo: true },
  { id: "granulados", nome: "Granulados", icone: "🪨", ativo: true },
  { id: "aves_roedores_peixes", nome: "Aves, Roedores e Peixes", icone: "🐦", ativo: true },
];

export const DEFAULT_QUESTIONS = {
  promocoes_trade: [
    "As promoções vigentes estão sinalizadas corretamente?",
    "Os preços nas etiquetas conferem com o sistema?",
    "Materiais de trade marketing estão bem posicionados?",
  ],
  processos_gerais: [
    "A loja está limpa e organizada na entrada?",
    "Iluminação geral funcionando normalmente?",
    "Corredores livres de obstáculos?",
  ],
  caes_petfood: [
    "Gôndolas de ração para cães abastecidas?",
    "Datas de validade dentro do prazo?",
    "Preços e etiquetas corretos?",
  ],
  caes_snacks: [
    "Setor de petiscos para cães abastecido?",
    "Embalagens sem avarias?",
  ],
  gatos_petfood: [
    "Gôndolas de ração para gatos abastecidas?",
    "Datas de validade dentro do prazo?",
  ],
  gatos_snacks: [
    "Setor de petiscos para gatos abastecido?",
    "Embalagens sem avarias?",
  ],
  farmacia: [
    "Medicamentos armazenados corretamente?",
    "Controle de validade em dia?",
    "Antipulgas e vermífugos em estoque?",
  ],
  higiene_beleza: [
    "Shampoos e produtos de higiene abastecidos?",
    "Setor organizado por categoria?",
  ],
  acessorios: [
    "Coleiras, guias e brinquedos organizados?",
    "Etiquetas de preço visíveis?",
  ],
  camas: [
    "Camas expostas em bom estado?",
    "Variedade de tamanhos disponível?",
  ],
  tapetes_higienicos: [
    "Estoque de tapetes higiênicos abastecido?",
    "Embalagens sem avarias?",
  ],
  granulados: [
    "Areias e granulados sanitários abastecidos?",
    "Sacos sem rasgos ou vazamentos?",
  ],
  aves_roedores_peixes: [
    "Aquários e viveiros limpos e funcionando?",
    "Alimentação dos animais em dia?",
    "Temperatura da água dentro do padrão?",
  ],
};
