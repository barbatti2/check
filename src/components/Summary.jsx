import React from "react";
import { FileText, Download, Share2, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { C, PRIORITY_META } from "../theme";
import { calcStats, fmtDate, fmtDuration } from "../lib/helpers";
import { ScreenHeader, ScoreRing, GhostButton, PrimaryButton } from "./ui";

export default function Summary({ ronda, sectors, onPrint, onExcel, onWhatsapp, onDone, onBack, readOnly, printMode }) {
  const stats = ronda.stats || calcStats(ronda, {});
  const duration = ronda.endTime ? fmtDuration(ronda.endTime - ronda.startTime) : "—";

  return (
    <div className={printMode ? "print-only" : "anim-fadeUp"}>
      <div className="no-print">
        <ScreenHeader title="Resumo da ronda" onBack={onBack} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 18, background: C.surface, borderRadius: 22, padding: 20, marginBottom: 16, boxShadow: C.shadowCard }}>
        <ScoreRing score={stats.score} size={72} />
        <div>
          <div style={{ fontSize: 12.5, color: C.inkFaint, fontWeight: 600 }}>Pontuação geral</div>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>
            {stats.score >= 80 ? "Excelente ronda" : stats.score >= 50 ? "Ronda regular" : "Atenção necessária"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, color: C.inkSoft, fontSize: 12.5 }}>
            <Clock size={13} /> {duration} · {fmtDate(ronda.date)}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <StatBox icon={CheckCircle2} value={stats.conformes} label="Conformes" color={C.accent} soft={C.accentSoft} />
        <StatBox icon={XCircle} value={stats.nao} label="Não conf." color={C.red} soft={C.redSoft} />
        <StatBox icon={AlertTriangle} value={stats.pendencias.length} label="Pendências" color={C.gold} soft={C.goldSoft} />
      </div>

      {stats.pendencias.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.inkFaint, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>
            Lista de pendências
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.pendencias.map((p, i) => {
              const sector = sectors.find((s) => s.id === p.sectorId);
              const meta = PRIORITY_META[p.prioridade] || PRIORITY_META.media;
              return (
                <div key={i} style={{ background: C.surface, borderRadius: 16, padding: 13, boxShadow: C.shadowCard }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.inkFaint }}>{sector?.name}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: meta.color, background: meta.soft, padding: "2px 8px", borderRadius: 8 }}>{meta.label}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 500, marginBottom: 6 }}>{p.desc}</div>
                  <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: C.inkSoft }}>
                    {p.responsavel && <span>👤 {p.responsavel}</span>}
                    {p.prazo && <span>📅 {fmtDate(p.prazo)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 70 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <GhostButton icon={FileText} onClick={onPrint} style={{ flex: 1 }}>PDF</GhostButton>
          <GhostButton icon={Download} onClick={onExcel} style={{ flex: 1 }}>Excel</GhostButton>
          <GhostButton icon={Share2} onClick={onWhatsapp} style={{ flex: 1 }}>WhatsApp</GhostButton>
        </div>
        {!readOnly && <PrimaryButton onClick={onDone}>Concluir</PrimaryButton>}
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, value, label, color, soft }) {
  return (
    <div style={{ background: C.surface, borderRadius: 18, padding: "14px 8px", textAlign: "center", boxShadow: C.shadowCard }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: soft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
        <Icon size={16} color={color} />
      </div>
      <div className="font-display" style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{value}</div>
      <div style={{ fontSize: 10, color: C.inkFaint, fontWeight: 600 }}>{label}</div>
    </div>
  );
}
