import React from "react";
import { ArrowLeft, Package } from "lucide-react";
import {
  Tag, ClipboardList, Dog, Cat, Bird, Bone, Pill, Sparkles, ShoppingBag,
  BedDouble, Cookie, Grid3x3, ImageOff,
} from "lucide-react";
import { C } from "../theme";

export const ICONS = {
  Tag, ClipboardList, Dog, Cat, Bird, Bone, Pill, Sparkles, ShoppingBag,
  BedDouble, Package, Cookie, Grid3x3,
};

export function IconBadge({ name, size = 20, bg = C.accentSoft, color = C.accent, box = 40 }) {
  const Ic = ICONS[name] || Package;
  return (
    <div style={{
      width: box, height: box, borderRadius: box * 0.4, background: bg,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <Ic size={size} color={color} strokeWidth={2} />
    </div>
  );
}

export function PrimaryButton({ children, onClick, style, disabled, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? C.inkFaint : C.accent,
        color: "#fff", border: "none", borderRadius: 18,
        padding: "16px 22px", fontSize: 15.5, fontWeight: 600,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        width: "100%", cursor: disabled ? "default" : "pointer",
        boxShadow: disabled ? "none" : "0 8px 20px rgba(59,117,99,0.28)",
        transition: "transform 0.15s ease",
        ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, style, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: C.surface, color: C.ink, border: `1px solid ${C.line}`,
        borderRadius: 16, padding: "13px 18px", fontSize: 14.5, fontWeight: 600,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        cursor: "pointer", boxShadow: C.shadowCard, ...style,
      }}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

export function ProgressBar({ pct, color = C.accent, height = 10 }) {
  return (
    <div style={{ width: "100%", height, borderRadius: height, background: C.surfaceSunken, boxShadow: C.shadowInset, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%", borderRadius: height,
        background: `linear-gradient(90deg, ${color}, ${color}CC)`,
        transition: "width 0.5s cubic-bezier(.2,.8,.2,1)",
      }} />
    </div>
  );
}

export function ScreenHeader({ title, onBack, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 4px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && (
          <button onClick={onBack} style={{
            width: 38, height: 38, borderRadius: 13, background: C.surface, border: "none",
            display: "flex", alignItems: "center", justifyContent: "center", boxShadow: C.shadowCard, cursor: "pointer",
          }}>
            <ArrowLeft size={18} color={C.ink} />
          </button>
        )}
        <h1 className="font-display" style={{ fontSize: 21, fontWeight: 700, color: C.ink, margin: 0 }}>{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function ScoreRing({ score, size = 60 }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 80 ? C.accent : score >= 50 ? C.gold : C.red;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={C.surfaceSunken} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="font-display" style={{ fontSize: size * 0.28, fontWeight: 700, color: C.ink }}>{score}</span>
      </div>
    </div>
  );
}

export function EmptyState({ text }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: C.inkFaint }}>
      <ImageOff size={30} style={{ marginBottom: 10, opacity: 0.5 }} />
      <div style={{ fontSize: 13.5 }}>{text}</div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.inkFaint, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
