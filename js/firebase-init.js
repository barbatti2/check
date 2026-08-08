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
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
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
