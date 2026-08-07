// ======================================================================
// CONFIGURAÇÃO DO FIREBASE
// Troque os valores abaixo pelos dados do SEU projeto Firebase.
// Console: https://console.firebase.google.com -> Configurações do projeto -> Seus apps -> SDK setup
// ======================================================================
export const firebaseConfig = {
  const firebaseConfig = {
  apiKey: "AIzaSyB1iyuDETyPVzzZDXgGF74jVmHIYF7XjVg",
  authDomain: "check-6d34c.firebaseapp.com",
  projectId: "check-6d34c",
  storageBucket: "check-6d34c.firebasestorage.app",
  messagingSenderId: "753078110849",
  appId: "1:753078110849:web:cff7e9560eac5039169b80"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let app, db, offline = false;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.error("Falha ao iniciar o Firebase. Verifique js/firebase.js", e);
  offline = true;
}

export {
  db, offline, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, Timestamp
};
