import React, { useState } from "react";
import { X, PlayCircle, History, AlertTriangle, Settings, PawPrint } from "lucide-react";
import { C } from "../theme";

export default function Fab({ hasActiveRonda, pendCount, onStart, onHistory, onPendencias, onSettings }) {
  const [open, setOpen] = useState(false);

  const items = [
    { key: "settings", label: "Configurações", icon: Settings, onClick: onSettings, color: C.inkSoft, bg: C.surface },
    { key: "history", label: "Histórico", icon: History, onClick: onHistory, color: C.inkSoft, bg: C.surface },
    {
      key: "pend", label: "Pendências", icon: AlertTriangle, onClick: onPendencias,
      color: pendCount > 0 ? C.red : C.inkSoft, bg: C.surface, badge: pendCount,
    },
    {
      key: "start", label: hasActiveRonda ? "Continuar ronda" : "Iniciar ronda",
      icon: PlayCircle, onClick: onStart, color: "#fff", bg: C.accent,
    },
  ];

  function handleItem(fn) {
    setOpen(false);
    fn && fn();
  }

  return (
    <>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(34,38,43,0.28)", zIndex: 150 }}
        />
      )}

      <div style={{
        position: "fixed", right: "max(20px, calc(50% - 195px))", bottom: 24, zIndex: 160,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12,
      }}>
        {open && items.map((it, i) => (
          <button
            key={it.key}
            onClick={() => handleItem(it.onClick)}
            style={{
              display: "flex", alignItems: "center", gap: 10, border: "none", cursor: "pointer",
              background: "transparent", padding: 0,
              animation: `fabItem 0.22s cubic-bezier(.2,.8,.2,1) both`,
              animationDelay: `${(items.length - i) * 25}ms`,
            }}
          >
            <span style={{
              background: C.ink, color: "#fff", fontSize: 12.5, fontWeight: 600,
              padding: "7px 12px", borderRadius: 10, boxShadow: "0 4px 14px rgba(0,0,0,0.18)", whiteSpace: "nowrap",
            }}>
              {it.label}
            </span>
            <span style={{
              position: "relative", width: 48, height: 48, borderRadius: "50%", background: it.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 16px rgba(34,38,43,0.18)",
            }}>
              <it.icon size={20} color={it.color} />
              {!!it.badge && (
                <span style={{
                  position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9,
                  background: C.red, color: "#fff", fontSize: 10.5, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
                }}>{it.badge}</span>
              )}
            </span>
          </button>
        ))}

        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            width: 60, height: 60, borderRadius: "50%", border: "none", cursor: "pointer",
            background: `linear-gradient(150deg, ${C.accentDeep}, ${C.accent})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 10px 26px rgba(41,80,68,0.4)",
            transform: open ? "rotate(135deg)" : "rotate(0deg)",
            transition: "transform 0.25s cubic-bezier(.2,.8,.2,1)",
          }}
        >
          {open ? <X size={24} color="#fff" /> : <PawPrint size={24} color="#fff" />}
        </button>
      </div>
    </>
  );
}
