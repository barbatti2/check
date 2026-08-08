import React, { useState, useRef } from "react";
import { Check, ChevronRight, Camera } from "lucide-react";
import { C } from "../theme";
import { ScreenHeader, Field, IconBadge } from "./ui";

export default function Settings({ userName, petPhoto, sectors, questionsConfig, onSaveProfile, onOpenSector, onBack }) {
  const [name, setName] = useState(userName);
  const fileRef = useRef(null);

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onSaveProfile({ userName: name, petPhoto: reader.result });
    reader.readAsDataURL(file);
  }

  return (
    <div className="anim-fadeUp">
      <ScreenHeader title="Configurações" onBack={onBack} />

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <button onClick={() => fileRef.current?.click()} style={{ border: "none", background: "none", cursor: "pointer", position: "relative" }}>
          {petPhoto ? (
            <img src={petPhoto} alt="pet" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Camera size={22} color={C.accent} />
            </div>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
        <div style={{ fontSize: 12.5, color: C.inkFaint }}>Toque na foto para trocar a imagem do pet exibida no início.</div>
      </div>

      <Field label="Seu nome">
        <div style={{ display: "flex", gap: 8 }}>
          <input value={name} onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, borderRadius: 14, border: `1px solid ${C.line}`, padding: 12, fontSize: 13.5 }} />
          <button onClick={() => onSaveProfile({ userName: name })} style={{
            background: C.accent, border: "none", borderRadius: 14, padding: "0 16px", color: "#fff", cursor: "pointer",
          }}><Check size={16} /></button>
        </div>
      </Field>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.inkFaint, textTransform: "uppercase", letterSpacing: 0.4, margin: "20px 0 10px" }}>
        Perguntas por setor
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 70 }}>
        {sectors.map((s) => (
          <button key={s.id} onClick={() => onOpenSector(s.id)} style={{
            background: C.surface, border: "none", borderRadius: 16, padding: 12, display: "flex",
            alignItems: "center", gap: 12, cursor: "pointer", boxShadow: C.shadowCard, textAlign: "left",
          }}>
            <IconBadge name={s.icon} box={34} size={16} />
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{s.name}</div>
            <span style={{ fontSize: 11.5, color: C.inkFaint, fontWeight: 600 }}>{(questionsConfig[s.id] || []).length} perg.</span>
            <ChevronRight size={15} color={C.inkFaint} />
          </button>
        ))}
      </div>

      <div style={{ padding: 14, background: C.accentSoft, borderRadius: 16, fontSize: 12, color: C.accentDeep, lineHeight: 1.5, marginBottom: 70 }}>
        Os dados ficam salvos no Firebase (Firestore) associados a este dispositivo e sincronizam automaticamente
        assim que houver internet. Enquanto offline, tudo continua funcionando normalmente graças ao cache local.
      </div>
    </div>
  );
}
