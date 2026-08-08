import React from "react";
import { ChevronRight } from "lucide-react";
import { C } from "../theme";
import { fmtDate } from "../lib/helpers";
import { ScreenHeader, ScoreRing, EmptyState } from "./ui";

export default function History({ rondas, filter, setFilter, onOpen, onBack }) {
  const filtered = rondas.filter((r) => {
    const d = r.date.slice(0, 10);
    if (filter.from && d < filter.from) return false;
    if (filter.to && d > filter.to) return false;
    return true;
  });

  return (
    <div className="anim-fadeUp">
      <ScreenHeader title="Histórico de rondas" onBack={onBack} />

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: C.inkFaint, fontWeight: 700, marginBottom: 5 }}>DE</div>
          <input type="date" value={filter.from} onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))}
            style={{ width: "100%", borderRadius: 12, border: `1px solid ${C.line}`, padding: 10, fontSize: 12.5 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: C.inkFaint, fontWeight: 700, marginBottom: 5 }}>ATÉ</div>
          <input type="date" value={filter.to} onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))}
            style={{ width: "100%", borderRadius: 12, border: `1px solid ${C.line}`, padding: 10, fontSize: 12.5 }} />
        </div>
      </div>

      {filtered.length === 0 && <EmptyState text="Nenhuma ronda encontrada para o período." />}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 70 }}>
        {filtered.map((r) => (
          <button key={r.id} onClick={() => onOpen(r)} style={{
            background: C.surface, border: "none", borderRadius: 18, padding: 14, display: "flex",
            alignItems: "center", gap: 14, cursor: "pointer", boxShadow: C.shadowCard, textAlign: "left", width: "100%",
          }}>
            <ScoreRing score={r.stats?.score ?? 0} size={46} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{fmtDate(r.date)}</div>
              <div style={{ fontSize: 11.5, color: C.inkFaint, marginTop: 2 }}>
                {r.stats?.conformes ?? 0} conformes · {r.stats?.nao ?? 0} não conf. · {r.stats?.pendencias?.length ?? 0} pendências
              </div>
            </div>
            <ChevronRight size={16} color={C.inkFaint} />
          </button>
        ))}
      </div>
    </div>
  );
}
