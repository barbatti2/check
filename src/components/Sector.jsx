import React, { useState, useRef } from "react";
import { FileText, Camera, X, AlertTriangle } from "lucide-react";
import { C, STATUS_META } from "../theme";
import { ScreenHeader, EmptyState } from "./ui";

export default function Sector({ sector, questions, answers, onAnswer, onPendencia, onBack }) {
  if (!sector) return null;
  return (
    <div className="anim-fadeUp">
      <ScreenHeader title={sector.name} onBack={onBack} />
      {questions.length === 0 && <EmptyState text="Nenhuma pergunta cadastrada para este setor ainda. Adicione em Configurações." />}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 60 }}>
        {questions.map((q) => (
          <QuestionCard key={q.id} question={q} answer={answers[q.id] || {}}
            onChange={(patch) => onAnswer(q.id, patch)}
            onPendencia={() => onPendencia(q.id)} />
        ))}
      </div>
    </div>
  );
}

function QuestionCard({ question, answer, onChange, onPendencia }) {
  const [showObs, setShowObs] = useState(!!answer.obs);
  const fileRef = useRef(null);

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ photo: reader.result });
    reader.readAsDataURL(file);
  }

  const statusColor = answer.status ? STATUS_META[answer.status].color : C.line;

  return (
    <div style={{ background: C.surface, borderRadius: 20, padding: 16, boxShadow: C.shadowCard, borderLeft: `3px solid ${statusColor}` }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, marginBottom: 12, lineHeight: 1.4 }}>{question.text}</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {Object.entries(STATUS_META).map(([key, meta]) => {
          const active = answer.status === key;
          return (
            <button key={key} onClick={() => onChange({ status: key })} style={{
              flex: 1, padding: "10px 6px", borderRadius: 14, border: "none", cursor: "pointer",
              background: active ? meta.soft : C.surfaceSunken,
              boxShadow: active ? `inset 0 0 0 1.5px ${meta.color}` : "none",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              transition: "all 0.15s ease",
            }}>
              <span style={{ fontSize: 20 }}>{meta.emoji}</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: active ? meta.color : C.inkFaint }}>{meta.label}</span>
            </button>
          );
        })}
      </div>

      {showObs && (
        <textarea
          value={answer.obs || ""}
          onChange={(e) => onChange({ obs: e.target.value })}
          placeholder="Observações…"
          style={{
            width: "100%", minHeight: 60, borderRadius: 14, border: `1px solid ${C.line}`,
            padding: 10, fontSize: 13, color: C.ink, resize: "none", marginBottom: 10, background: C.bg,
          }}
        />
      )}

      {answer.photo && (
        <div style={{ position: "relative", marginBottom: 10, width: 72, height: 72 }}>
          <img src={answer.photo} alt="foto" style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover" }} />
          <button onClick={() => onChange({ photo: null })} style={{
            position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
            background: C.ink, border: "none", color: "#fff", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer",
          }}>
            <X size={12} />
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SmallAction icon={FileText} label={showObs ? "Ocultar nota" : "Observação"} onClick={() => setShowObs((v) => !v)} />
        <SmallAction icon={Camera} label={answer.photo ? "Trocar foto" : "Foto"} onClick={() => fileRef.current?.click()} />
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handlePhoto} />
        <SmallAction icon={AlertTriangle} label={answer.pendencia ? "Pendência criada" : "Criar pendência"} onClick={onPendencia} active={!!answer.pendencia} />
      </div>
    </div>
  );
}

function SmallAction({ icon: Icon, label, onClick, active }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 12,
      border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
      background: active ? C.redSoft : C.surfaceSunken, color: active ? C.red : C.inkSoft,
    }}>
      <Icon size={13} /> {label}
    </button>
  );
}
