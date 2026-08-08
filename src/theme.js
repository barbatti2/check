export const C = {
  bg: "#F4F3EF",
  surface: "#FFFFFF",
  surfaceSunken: "#EEEDE8",
  ink: "#22262B",
  inkSoft: "#6E7379",
  inkFaint: "#A6ABB0",
  line: "#E6E4DE",
  accent: "#3B7563",
  accentSoft: "#E3EEE9",
  accentDeep: "#295044",
  blueStart: "#2F5FA6",
  blueEnd: "#4A7FD1",
  gold: "#C79A4B",
  goldSoft: "#F5EDDD",
  red: "#C15B52",
  redSoft: "#F6E7E4",
  shadowCard: "0 2px 10px rgba(34,38,43,0.05), 0 1px 2px rgba(34,38,43,0.04)",
  shadowInset: "inset 3px 3px 8px rgba(34,38,43,0.06), inset -3px -3px 8px rgba(255,255,255,0.6)",
};

export const STATUS_META = {
  nao: { emoji: "😞", label: "Não atingiu", points: 0, color: C.red, soft: C.redSoft },
  atingiu: { emoji: "🙂", label: "Atingiu", points: 1, color: C.accent, soft: C.accentSoft },
  superou: { emoji: "🤩", label: "Superou", points: 2, color: C.gold, soft: C.goldSoft },
};

export const PRIORITY_META = {
  baixa: { label: "Baixa", color: C.accent, soft: C.accentSoft },
  media: { label: "Média", color: C.gold, soft: C.goldSoft },
  alta: { label: "Alta", color: C.red, soft: C.redSoft },
};
