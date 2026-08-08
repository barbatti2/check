import React from "react";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import { C } from "../theme";
import { ScreenHeader, ProgressBar, IconBadge, PrimaryButton } from "./ui";

export default function Ronda({ sectors, progress, sectorProgress, onOpenSector, onFinish, onBack }) {
  return (
    <div className="anim-fadeUp">
      <ScreenHeader title="Ronda em andamento" onBack={onBack} />
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>Progresso geral</span>
          <span className="font-display" style={{ fontSize: 13, color: C.accent, fontWeight: 700 }}>{progress}%</span>
        </div>
        <ProgressBar pct={progress} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sectors.map((s, i) => {
          const p = sectorProgress(s.id);
          const complete = p.total > 0 && p.done === p.total;
          return (
            <button key={s.id} onClick={() => onOpenSector(s.id)} className="anim-slide" style={{
              animationDelay: `${i * 30}ms`, background: C.surface, border: "none", borderRadius: 20,
              padding: 14, display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
              boxShadow: C.shadowCard, textAlign: "left", width: "100%",
            }}>
              <IconBadge name={s.icon} bg={complete ? C.accentSoft : C.surfaceSunken} color={complete ? C.accent : C.inkSoft} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink }}>{s.name}</div>
                <div style={{ fontSize: 12, color: C.inkFaint, marginTop: 2 }}>{p.done}/{p.total} itens verificados</div>
              </div>
              {complete ? <CheckCircle2 size={20} color={C.accent} /> : <ChevronRight size={18} color={C.inkFaint} />}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 26, marginBottom: 70 }}>
        <PrimaryButton onClick={onFinish}>Finalizar ronda</PrimaryButton>
      </div>
    </div>
  );
}
