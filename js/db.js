// =====================================================================
// Camada de dados — usa Firestore quando configurado (js/config-firebase.js),
// e cai automaticamente para localStorage quando não há configuração,
// garantindo que o app sempre funcione (offline-first para uso pessoal).
// =====================================================================

import { firebaseConfig, FIREBASE_ENABLED } from "./config-firebase.js";
import { DEFAULT_SECTORS, DEFAULT_QUESTIONS } from "./data-default.js";

const LS_CONFIG_KEY = "rondapet_config_v1";
const LS_RONDAS_KEY = "rondapet_rondas_v1";
const LS_ACTIVE_KEY = "rondapet_active_round_id";

let firestoreDb = null;
let firestoreApi = null;
let firestoreReady = false;

async function tryInitFirestore() {
  if (!FIREBASE_ENABLED) return false;
  try {
    const [{ initializeApp }, fs] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
    ]);
    const app = initializeApp(firebaseConfig);
    firestoreDb = fs.getFirestore(app);
    firestoreApi = fs;
    // Sanity check: attempt a lightweight read.
    await fs.getDoc(fs.doc(firestoreDb, "config", "geral"));
    firestoreReady = true;
    return true;
  } catch (err) {
    console.warn("Firestore indisponível, usando armazenamento local.", err);
    firestoreReady = false;
    return false;
  }
}

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function defaultConfig() {
  return {
    sectors: DEFAULT_SECTORS.map((s) => ({ ...s })),
    questionsBySector: Object.fromEntries(
      Object.entries(DEFAULT_QUESTIONS).map(([sectorId, list]) => [
        sectorId,
        list.map((texto) => ({ id: uid(), texto })),
      ])
    ),
  };
}

export const DB = {
  mode: "local", // 'firestore' | 'local'

  async init() {
    const ok = await tryInitFirestore();
    this.mode = ok ? "firestore" : "local";
    return this.mode;
  },

  isOnline() {
    return this.mode === "firestore" && firestoreReady;
  },

  // ---------------- CONFIG ----------------
  async getConfig() {
    if (this.isOnline()) {
      const { doc, getDoc } = firestoreApi;
      const snap = await getDoc(doc(firestoreDb, "config", "geral"));
      if (snap.exists()) return snap.data();
      const cfg = defaultConfig();
      await this.saveConfig(cfg);
      return cfg;
    }
    let cfg = readLocal(LS_CONFIG_KEY, null);
    if (!cfg) {
      cfg = defaultConfig();
      writeLocal(LS_CONFIG_KEY, cfg);
    }
    return cfg;
  },

  async saveConfig(config) {
    if (this.isOnline()) {
      const { doc, setDoc } = firestoreApi;
      await setDoc(doc(firestoreDb, "config", "geral"), config);
    }
    writeLocal(LS_CONFIG_KEY, config); // always cache locally too
  },

  // ---------------- RONDAS ----------------
  async createRonda(ronda) {
    const id = uid();
    const payload = { ...ronda, id };
    if (this.isOnline()) {
      const { doc, setDoc } = firestoreApi;
      await setDoc(doc(firestoreDb, "rondas", id), payload);
    }
    const all = readLocal(LS_RONDAS_KEY, []);
    all.unshift(payload);
    writeLocal(LS_RONDAS_KEY, all);
    return id;
  },

  async updateRonda(id, patch) {
    if (this.isOnline()) {
      const { doc, updateDoc } = firestoreApi;
      try {
        await updateDoc(doc(firestoreDb, "rondas", id), patch);
      } catch (err) {
        console.warn("Falha ao atualizar no Firestore, mantendo local.", err);
      }
    }
    const all = readLocal(LS_RONDAS_KEY, []);
    const idx = all.findIndex((r) => r.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...patch };
      writeLocal(LS_RONDAS_KEY, all);
      return all[idx];
    }
    return null;
  },

  async getRonda(id) {
    if (this.isOnline()) {
      const { doc, getDoc } = firestoreApi;
      const snap = await getDoc(doc(firestoreDb, "rondas", id));
      if (snap.exists()) return snap.data();
    }
    const all = readLocal(LS_RONDAS_KEY, []);
    return all.find((r) => r.id === id) || null;
  },

  async listRondas() {
    if (this.isOnline()) {
      try {
        const { collection, getDocs, query, orderBy } = firestoreApi;
        const q = query(collection(firestoreDb, "rondas"), orderBy("dataInicio", "desc"));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => d.data());
        writeLocal(LS_RONDAS_KEY, list); // refresh local cache
        return list;
      } catch (err) {
        console.warn("Falha ao listar do Firestore, usando cache local.", err);
      }
    }
    const all = readLocal(LS_RONDAS_KEY, []);
    return [...all].sort((a, b) => (b.dataInicio || "").localeCompare(a.dataInicio || ""));
  },

  // ---------------- ACTIVE ROUND POINTER (always local — device-specific) ----------------
  getActiveRoundId() {
    return localStorage.getItem(LS_ACTIVE_KEY) || null;
  },
  setActiveRoundId(id) {
    if (id) localStorage.setItem(LS_ACTIVE_KEY, id);
    else localStorage.removeItem(LS_ACTIVE_KEY);
  },
};
