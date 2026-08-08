import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { C, PRIORITY_META } from "../theme";
import { Field, PrimaryButton, GhostButton } from "./ui";

export default function PendenciaModal({ initial, onClose, onSave, onRemove }) {
  const [desc, setDesc] = useState(initial?.desc || "");
  const [responsavel, setResponsavel] = useState(initial?.responsavel || "");
  const [prazo, setPrazo] = useState(initial?.prazo || "");
  const [prioridade, setPrioridade] = useState(initial?.prioridade || "media");

  return (
    <div className="no-print" style={{
      position: "fixed", inset: 0, background: "rgba(34,38,43,0.45)", display: "flex",
      alignItems: "flex-end", justifyContent: "center", zIndex: 200,
    }} onClick={onClose}>
      <div className="anim-pop" onClick={(e) => e.stopPropagation()} style={{
        background: C.surface, borderRadius: "26px 26px 0 0", padding: 22, width: "100%", maxWidth: 430,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.line, margin: "0 auto 18px" }} />
        <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: "0 0 16px" }}>Criar pendência</h3>

        <Field label="Descrição">
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="O que precisa ser resolvido?"
            style={{ width: "100%", borderRadius: 14, border: `1px solid ${C.line}`, padding: 10, fontSize: 13.5, resize: "none" }} />
        </Field>
        <Field label="Responsável">
          <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome do responsável"
            style={{ width: "100%", borderRadius: 14, border: `1px solid ${C.line}`, padding: 12, fontSize: 13.5 }} />
        </Field>
        <Field label="Prazo">
          <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)}
            style={{ width: "100%", borderRadius: 14, border: `1px solid ${C.line}`, padding: 12, fontSize: 13.5 }} />
        </Field>
        <Field label="Prioridade">
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(PRIORITY_META).map(([key, meta]) => (
              <button key={key} onClick={() => setPrioridade(key)} style={{
                flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer",
                background: prioridade === key ? meta.soft : C.surfaceSunken,
                boxShadow: prioridade === key ? `inset 0 0 0 1.5px ${meta.color}` : "none",
                fontSize: 12.5, fontWeight: 700, color: prioridade === key ? meta.color : C.inkFaint,
              }}>{meta.label}</button>
            ))}
          </div>
        </Field>

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          {initial && <GhostButton icon={Trash2} onClick={onRemove} style={{ flex: 1, color: C.red }}>Remover</GhostButton>}
          <PrimaryButton
            onClick={() => onSave({ desc, responsavel, prazo, prioridade, resolved: initial?.resolved || false })}
            disabled={!desc.trim()} style={{ flex: 2 }}
          >
            Salvar pendência
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
