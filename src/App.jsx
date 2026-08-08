import React, { useState, useEffect, useMemo } from "react";
import { C } from "./theme";
import { DEFAULT_SECTORS, DEFAULT_QUESTIONS } from "./data/defaultSectors";
import { uid, calcStats } from "./lib/helpers";
import { ensureSignedIn } from "./firebase";
import { getConfig, saveConfigDb, subscribeRondas, saveRondaDb } from "./lib/db";
import { exportExcel, shareWhatsapp } from "./lib/export";

import Fab from "./components/Fab";
import Home from "./components/Home";
import Ronda from "./components/Ronda";
import Sector from "./components/Sector";
import Summary from "./components/Summary";
import History from "./components/History";
import Pendencias from "./components/Pendencias";
import Settings from "./components/Settings";
import SettingsSector from "./components/SettingsSector";
import PendenciaModal from "./components/PendenciaModal";

export default function App() {
  const [uidState, setUidState] = useState(null);
  const [ready, setReady] = useState(false);

  const [screen, setScreen] = useState("home");
  const [userName, setUserName] = useState("Gerente");
  const [petPhoto, setPetPhoto] = useState(null);
  const [sectors, setSectors] = useState(DEFAULT_SECTORS);
  const [questionsConfig, setQuestionsConfig] = useState(DEFAULT_QUESTIONS);

  const [rondas, setRondas] = useState([]);
  const [currentRonda, setCurrentRonda] = useState(null);
  const [activeSectorId, setActiveSectorId] = useState(null);
  const [pendModal, setPendModal] = useState(null);
  const [viewingRonda, setViewingRonda] = useState(null);
  const [historyFilter, setHistoryFilter] = useState({ from: "", to: "" });
  const [settingsSectorId, setSettingsSectorId] = useState(null);
  const [toast, setToast] = useState(null);
  const [printMode, setPrintMode] = useState(false);

  // --- Auth + initial config load ---
  useEffect(() => {
    ensureSignedIn(async (userId) => {
      setUidState(userId);
      const cfg = await getConfig(userId);
      if (cfg) {
        setUserName(cfg.userName || "Gerente");
        setPetPhoto(cfg.petPhoto || null);
        setSectors(cfg.sectors || DEFAULT_SECTORS);
        setQuestionsConfig(cfg.questions || DEFAULT_QUESTIONS);
      } else {
        await saveConfigDb(userId, { userName: "Gerente", sectors: DEFAULT_SECTORS, questions: DEFAULT_QUESTIONS });
      }
      setReady(true);
    });
  }, []);

  // --- Real-time rondas subscription (offline-first via Firestore cache) ---
  useEffect(() => {
    if (!uidState) return;
    const unsub = subscribeRondas(uidState, (list) => setRondas(list));
    return () => unsub();
  }, [uidState]);

  function persistConfig(patch) {
    if (patch.userName !== undefined) setUserName(patch.userName);
    if (patch.petPhoto !== undefined) setPetPhoto(patch.petPhoto);
    if (patch.sectors !== undefined) setSectors(patch.sectors);
    if (patch.questions !== undefined) setQuestionsConfig(patch.questions);
    if (uidState) saveConfigDb(uidState, patch);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  function startRonda() {
    if (currentRonda) { setScreen("ronda"); return; }
    const ronda = { id: uid(), date: new Date().toISOString(), startTime: Date.now(), endTime: null, answers: {} };
    setCurrentRonda(ronda);
    setScreen("ronda");
  }

  function updateAnswer(sectorId, questionId, patch) {
    setCurrentRonda((prev) => {
      const next = { ...prev, answers: { ...prev.answers } };
      next.answers[sectorId] = { ...(next.answers[sectorId] || {}) };
      next.answers[sectorId][questionId] = { ...(next.answers[sectorId][questionId] || {}), ...patch };
      return next;
    });
  }

  async function finalizeRonda() {
    const finished = { ...currentRonda, endTime: Date.now() };
    const withStats = { ...finished, stats: calcStats(finished, questionsConfig) };
    setRondas((prev) => [withStats, ...prev.filter((r) => r.id !== withStats.id)]);
    setCurrentRonda(withStats);
    setScreen("summary");
    if (uidState) await saveRondaDb(uidState, withStats);
  }

  async function resolvePendencia(p) {
    const ronda = rondas.find((r) => r.id === p.rondaId);
    if (!ronda) return;
    const next = { ...ronda, answers: { ...ronda.answers } };
    next.answers[p.sectorId] = { ...next.answers[p.sectorId] };
    const existing = next.answers[p.sectorId][p.questionId];
    next.answers[p.sectorId][p.questionId] = { ...existing, pendencia: { ...existing.pendencia, resolved: true } };
    next.stats = calcStats(next, questionsConfig);
    setRondas((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    if (uidState) await saveRondaDb(uidState, next);
  }

  const sectorProgress = (sectorId) => {
    const qs = questionsConfig[sectorId] || [];
    if (!currentRonda) return { done: 0, total: qs.length };
    const done = qs.filter((q) => currentRonda.answers?.[sectorId]?.[q.id]?.status).length;
    return { done, total: qs.length };
  };

  const totalProgress = useMemo(() => {
    if (!currentRonda) return 0;
    let total = 0, done = 0;
    sectors.forEach((s) => { const p = sectorProgress(s.id); total += p.total; done += p.done; });
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }, [currentRonda, sectors, questionsConfig]);

  const sectorProgressAll = useMemo(() => {
    if (!currentRonda) return { done: 0, totalSectors: sectors.length, pct: 0 };
    const done = sectors.filter((s) => {
      const p = sectorProgress(s.id);
      return p.total > 0 && p.done === p.total;
    }).length;
    return { done, totalSectors: sectors.length, pct: totalProgress };
  }, [currentRonda, sectors, questionsConfig, totalProgress]);

  const pendCount = useMemo(() => {
    let n = 0;
    rondas.forEach((r) => (r.stats?.pendencias || []).forEach((p) => { if (!p.resolved) n += 1; }));
    return n;
  }, [rondas]);

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: C.inkSoft, fontSize: 15 }}>Carregando…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", position: "relative", padding: "22px 18px 24px", background: C.bg }}>
        {screen === "home" && (
          <Home
            userName={userName} petPhoto={petPhoto} rondas={rondas} currentRonda={currentRonda}
            sectors={sectors} sectorProgressAll={sectorProgressAll}
            onOpenRonda={() => setScreen("ronda")}
            onOpenHistory={() => setScreen("history")}
          />
        )}

        {screen === "ronda" && currentRonda && (
          <Ronda sectors={sectors} progress={totalProgress} sectorProgress={sectorProgress}
            onOpenSector={(id) => { setActiveSectorId(id); setScreen("sector"); }}
            onFinish={finalizeRonda}
            onBack={() => setScreen("home")}
          />
        )}

        {screen === "sector" && currentRonda && (
          <Sector
            sector={sectors.find((s) => s.id === activeSectorId)}
            questions={questionsConfig[activeSectorId] || []}
            answers={currentRonda.answers?.[activeSectorId] || {}}
            onAnswer={(qid, patch) => updateAnswer(activeSectorId, qid, patch)}
            onPendencia={(qid) => setPendModal({ sectorId: activeSectorId, questionId: qid })}
            onBack={() => setScreen("ronda")}
          />
        )}

        {screen === "summary" && currentRonda && (
          <Summary
            ronda={currentRonda} sectors={sectors} printMode={printMode}
            onPrint={() => { setPrintMode(true); setTimeout(() => { window.print(); setPrintMode(false); }, 150); }}
            onExcel={() => exportExcel(currentRonda, sectors, showToast)}
            onWhatsapp={() => shareWhatsapp(currentRonda, sectors)}
            onDone={() => { setCurrentRonda(null); setScreen("home"); }}
            onBack={() => setScreen("home")}
          />
        )}

        {screen === "history" && (
          <History rondas={rondas} filter={historyFilter} setFilter={setHistoryFilter}
            onOpen={(r) => { setViewingRonda(r); setScreen("historyDetail"); }}
            onBack={() => setScreen("home")}
          />
        )}

        {screen === "historyDetail" && viewingRonda && (
          <Summary
            ronda={viewingRonda} sectors={sectors} readOnly printMode={printMode}
            onPrint={() => { setPrintMode(true); setTimeout(() => { window.print(); setPrintMode(false); }, 150); }}
            onExcel={() => exportExcel(viewingRonda, sectors, showToast)}
            onWhatsapp={() => shareWhatsapp(viewingRonda, sectors)}
            onDone={() => setScreen("history")}
            onBack={() => setScreen("history")}
          />
        )}

        {screen === "pendencias" && (
          <Pendencias rondas={rondas} sectors={sectors} onBack={() => setScreen("home")} onResolve={resolvePendencia} />
        )}

        {screen === "settings" && (
          <Settings
            userName={userName} petPhoto={petPhoto} sectors={sectors} questionsConfig={questionsConfig}
            onSaveProfile={persistConfig}
            onOpenSector={(id) => { setSettingsSectorId(id); setScreen("settingsSector"); }}
            onBack={() => setScreen("home")}
          />
        )}

        {screen === "settingsSector" && (
          <SettingsSector
            sector={sectors.find((s) => s.id === settingsSectorId)}
            questions={questionsConfig[settingsSectorId] || []}
            onChange={(qs) => persistConfig({ questions: { ...questionsConfig, [settingsSectorId]: qs } })}
            onBack={() => setScreen("settings")}
          />
        )}

        {pendModal && (
          <PendenciaModal
            initial={currentRonda?.answers?.[pendModal.sectorId]?.[pendModal.questionId]?.pendencia}
            onClose={() => setPendModal(null)}
            onSave={(data) => { updateAnswer(pendModal.sectorId, pendModal.questionId, { pendencia: data }); setPendModal(null); }}
            onRemove={() => { updateAnswer(pendModal.sectorId, pendModal.questionId, { pendencia: null }); setPendModal(null); }}
          />
        )}

        {!["sector", "settingsSector"].includes(screen) && !pendModal && (
          <div className="no-print">
            <Fab
              hasActiveRonda={!!currentRonda}
              pendCount={pendCount}
              onStart={startRonda}
              onHistory={() => setScreen("history")}
              onPendencias={() => setScreen("pendencias")}
              onSettings={() => setScreen("settings")}
            />
          </div>
        )}

        {toast && (
          <div className="no-print anim-pop" style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            background: C.ink, color: "#fff", padding: "12px 20px", borderRadius: 14,
            fontSize: 13.5, fontWeight: 600, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", zIndex: 999,
          }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
