import {
  doc, getDoc, setDoc, collection, onSnapshot, query, orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

const configRef = (uid) => doc(db, "users", uid, "meta", "config");
const rondaRef = (uid, id) => doc(db, "users", uid, "rondas", id);
const rondasCol = (uid) => collection(db, "users", uid, "rondas");

export async function getConfig(uid) {
  const snap = await getDoc(configRef(uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveConfigDb(uid, cfg) {
  await setDoc(configRef(uid), cfg, { merge: true });
}

// Real-time listener. Firestore's persistent local cache serves data
// instantly offline and syncs automatically once connectivity returns.
export function subscribeRondas(uid, cb) {
  const q = query(rondasCol(uid), orderBy("date", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function saveRondaDb(uid, ronda) {
  await setDoc(rondaRef(uid, ronda.id), ronda, { merge: true });
}
