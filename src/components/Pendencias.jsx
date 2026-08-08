import React, { useState } from "react";
import { C, PRIORITY_META } from "../theme";
import { fmtDate } from "../lib/helpers";
import { ScreenHeader, EmptyState } from "./ui";
import { Check } from "lucide-react";

export default function Pendencias({ rondas, sectors, onBack, onResolve }) {
  const [showResolved, setShowResolved] = useState(false);

  const all = [];
  rondas.forEach((r) => {
    (r.stats?.pendencias || []).forEach((p) => {
      all.push({ ...p, sector: sectors.find((s) => s.id === p.sectorId)?.name || "" });
    });
  });
  const list = all.filter((p) => (showResolved ? true : !p.resolved))
    .sort((a, b) => (a.prazo || "").localeCompare(b.prazo || ""));

  return (
    <div className="anim-fadeUp">
      <ScreenHeader title="Pendências" onBack={onBack} />

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Chip active={!showResolved} label="Em aberto" onClick={() => setShowResolved(false)} />
        <Chip active={showResolved} label="Todas" onClick={() => setShowResolved(true)} />
      </div>

      {list.length === 0 && <EmptyState text="Nenhuma pendência por aqui. 🎉" />}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 70 }}>
        {list.map((p, i) => {
          const meta = PRIORITY_META[p.prioridade] || PRIORITY_META.media;
          return (
            <div key={i} style={{
              background: C.surface, borderRadius: 18, padding: 14, boxShadow: C.shadowCard,
              opacity: p.resolved ? 0.55 : 1,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.inkFaint }}>{p.sector}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: meta.color, background: meta.soft, padding: "2px 8px", borderRadius: 8 }}>{meta.label}</span>
              </div>
              <div style={{
                fontSize: 13.5, color: C.ink, fontWeight: 500, marginBottom: 8,
                textDecoration: p.resolved ? "line-through" : "none",
              }}>{p.desc}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: C.inkSoft }}>
                  {p.responsavel && <span>👤 {p.responsavel}</span>}
                  {p.prazo && <span>📅 {fmtDate(p.prazo)}</span>}
                </div>
                {!p.resolved && (
                  <button onClick={() => onResolve(p)} style={{
                    display: "flex", alignItems: "center", gap: 5, background: C.accentSoft, color: C.accent,
                    border: "none", borderRadius: 10, padding: "6px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                  }}>
                    <Check size={12} /> Concluir
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ active, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 16px", borderRadius: 12, border: "none", cursor: "pointer",
      fontSize: 12.5, fontWeight: 700, background: active ? C.accent : C.surface,
      color: active ? "#fff" : C.inkSoft, boxShadow: C.shadowCard,
    }}>{label}</button>
  );
}
