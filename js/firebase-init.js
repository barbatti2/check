// ============================================================
// Configuração do Firebase
// ------------------------------------------------------------
// 1. Crie um projeto em https://console.firebase.google.com
// 2. Ative o Firestore Database (modo produção ou teste)
// 3. Em "Configurações do projeto" > "Seus apps" > Web (</>),
//    copie o objeto de configuração e cole abaixo.
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB1iyuDETyPVzzZDXgGF74jVmHIYF7XjVg",
  authDomain: "check-6d34c.firebaseapp.com",
  projectId: "check-6d34c",
  storageBucket: "check-6d34c.firebasestorage.app",
  messagingSenderId: "753078110849",
  appId: "1:753078110849:web:cff7e9560eac5039169b80"
};

export const isFirebaseConfigured = firebaseConfig.apiKey !== "SUA_API_KEY";

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const db = isFirebaseConfigured ? getFirestore(app) : null;

if (isFirebaseConfigured) {
  // Permite uso offline dentro da loja (sinal instável) com sincronização
  // automática quando a conexão voltar.
  enableIndexedDbPersistence(db).catch(() => {
    /* múltiplas abas abertas ou navegador sem suporte — segue normalmente */
  });
}
