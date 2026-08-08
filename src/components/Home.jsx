import React from "react";
import { ChevronRight, PawPrint, CheckCircle2, Clock3 } from "lucide-react";
import { C } from "../theme";
import { todayLabel, greeting, fmtDate, avgScore, avgScoreDelta } from "../lib/helpers";
import { ScoreRing } from "./ui";

export default function Home({ userName, petPhoto, rondas, currentRonda, sectors, sectorProgressAll, onOpenRonda, onOpenHistory }) {
  const avg = avgScore(rondas, 7);
  const delta = avgScoreDelta(rondas, 7);
  const recent = rondas.slice(0, 4);

  return (
    <div className="anim-fadeUp">
      {/* Header */}
      <div style={{
        background: `linear-gradient(150deg, ${C.blueStart}, ${C.blueEnd})`,
        borderRadius: 28, padding: "20px 20px 24px", marginBottom: 18, position: "relative", overflow: "hidden",
        boxShadow: "0 16px 36px rgba(47,95,166,0.28)",
      }}>
        <div style={{ position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 13, background: "rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <PawPrint size={19} color="#fff" />
            </div>
            <span className="font-display" style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>Ronda Pet</span>
          </div>

          {petPhoto ? (
            <img src={petPhoto} alt="pet" style={{
              width: 52, height: 52, borderRadius: "50%", objectFit: "cover",
              border: "2.5px solid rgba(255,255,255,0.55)",
            }} />
          ) : (
            <div style={{
              width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.16)",
              display: "flex", alignItems: "center", justifyContent: "center", border: "2.5px solid rgba(255,255,255,0.4)",
            }}>
              <PawPrint size={22} color="#fff" />
            </div>
          )}
        </div>

        <h1 className="font-display" style={{ color: "#fff", fontSize: 25, fontWeight: 700, margin: "18px 0 2px" }}>
          {greeting()}, {userName}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.82)", fontSize: 13.5, margin: 0, textTransform: "capitalize" }}>{todayLabel()}</p>

        <div style={{ marginTop: 20 }}>
          <span style={{ color: "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: 500 }}>Pontuação média · 7 dias</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2 }}>
            <span className="font-display" style={{ color: "#fff", fontSize: 34, fontWeight: 800 }}>
              {avg === null ? "—" : `${avg}%`}
            </span>
            {delta !== null && (
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: delta >= 0 ? "#BFF0D6" : "#F6C9C2",
              }}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ronda ativa / CTA */}
      {currentRonda ? (
        <button onClick={onOpenRonda} style={{
          width: "100%", textAlign: "left", background: C.surface, border: "none", borderRadius: 22,
          padding: 18, marginBottom: 20, boxShadow: C.shadowCard, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 15, background: C.goldSoft,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Clock3 size={21} color={C.gold} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>Ronda em andamento</div>
            <div style={{ fontSize: 12, color: C.inkFaint, margin: "3px 0 8px" }}>
              {sectorProgressAll.done} de {sectorProgressAll.totalSectors} setores concluídos
            </div>
            <div style={{ width: "100%", height: 7, borderRadius: 7, background: C.surfaceSunken, overflow: "hidden" }}>
              <div style={{
                width: `${sectorProgressAll.pct}%`, height: "100%", background: C.accent, borderRadius: 7,
                transition: "width 0.4s ease",
              }} />
            </div>
          </div>
          <ChevronRight size={18} color={C.inkFaint} />
        </button>
      ) : (
        <div style={{
          background: C.surface, borderRadius: 22, padding: 18, marginBottom: 20, boxShadow: C.shadowCard,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 15, background: C.accentSoft,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <PawPrint size={21} color={C.accent} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>Nenhuma ronda hoje</div>
            <div style={{ fontSize: 12, color: C.inkFaint, marginTop: 2 }}>Use o botão no canto inferior para começar.</div>
          </div>
        </div>
      )}

      {/* Atividades recentes */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span className="font-display" style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>Atividades recentes</span>
        {rondas.length > 0 && (
          <button onClick={onOpenHistory} style={{ background: "none", border: "none", color: C.blueEnd, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Ver tudo
          </button>
        )}
      </div>

      {recent.length === 0 && (
        <div style={{ textAlign: "center", padding: "30px 10px", color: C.inkFaint, fontSize: 13 }}>
          Suas rondas concluídas vão aparecer aqui.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {recent.map((r) => {
          const good = (r.stats?.score ?? 0) >= 70;
          return (
            <button key={r.id} onClick={onOpenHistory} style={{
              display: "flex", alignItems: "center", gap: 12, background: C.surface, border: "none",
              borderRadius: 18, padding: 13, boxShadow: C.shadowCard, cursor: "pointer", textAlign: "left", width: "100%",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: good ? C.accentSoft : C.redSoft,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {good ? <CheckCircle2 size={17} color={C.accent} /> : <Clock3 size={17} color={C.red} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>Ronda de {fmtDate(r.date)}</div>
                <div style={{ fontSize: 11.5, color: C.inkFaint, marginTop: 1 }}>
                  {good ? "Concluída com sucesso" : "Pontos de atenção identificados"}
                </div>
              </div>
              <span className="font-display" style={{ fontSize: 13, fontWeight: 700, color: good ? C.accent : C.red }}>
                {r.stats?.score ?? 0}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
