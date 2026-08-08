import React, { useState } from "react";
import { Plus, Check, Pencil, Trash2 } from "lucide-react";
import { C } from "../theme";
import { uid } from "../lib/helpers";
import { ScreenHeader, EmptyState } from "./ui";

export default function SettingsSector({ sector, questions, onChange, onBack }) {
  const [newQ, setNewQ] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  function addQuestion() {
    if (!newQ.trim()) return;
    onChange([...questions, { id: uid(), text: newQ.trim() }]);
    setNewQ("");
  }
  function removeQuestion(id) { onChange(questions.filter((q) => q.id !== id)); }
  function saveEdit(id) {
    onChange(questions.map((q) => (q.id === id ? { ...q, text: editText } : q)));
    setEditingId(null);
  }

  if (!sector) return null;
  return (
    <div className="anim-fadeUp">
      <ScreenHeader title={sector.name} onBack={onBack} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {questions.map((q) => (
          <div key={q.id} style={{ background: C.surface, borderRadius: 14, padding: 12, boxShadow: C.shadowCard }}>
            {editingId === q.id ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus
                  style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 10, padding: 8, fontSize: 13 }} />
                <button onClick={() => saveEdit(q.id)} style={{ background: C.accent, border: "none", borderRadius: 10, padding: "0 12px", color: "#fff" }}><Check size={14} /></button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, fontSize: 13.5, color: C.ink }}>{q.text}</div>
                <button onClick={() => { setEditingId(q.id); setEditText(q.text); }} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <Pencil size={14} color={C.inkFaint} />
                </button>
                <button onClick={() => removeQuestion(q.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <Trash2 size={14} color={C.red} />
                </button>
              </div>
            )}
          </div>
        ))}
        {questions.length === 0 && <EmptyState text="Nenhuma pergunta ainda. Adicione a primeira abaixo." />}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 70 }}>
        <input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="Nova pergunta…"
          onKeyDown={(e) => e.key === "Enter" && addQuestion()}
          style={{ flex: 1, borderRadius: 14, border: `1px solid ${C.line}`, padding: 12, fontSize: 13.5 }} />
        <button onClick={addQuestion} style={{ background: C.accent, border: "none", borderRadius: 14, padding: "0 16px", color: "#fff", cursor: "pointer" }}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
