// =====================================================================
// CONFIGURAÇÃO DO FIREBASE
// =====================================================================
// 1. Crie um projeto em https://console.firebase.google.com
// 2. Ative o Firestore Database (modo produção ou teste)
// 3. Em "Configurações do projeto" > "Seus apps" > Web, copie as chaves
//    e cole abaixo, substituindo os valores de exemplo.
// 4. Nas regras do Firestore, para uso pessoal em um único dispositivo,
//    algo simples como o exemplo abaixo já funciona (ajuste conforme
//    sua necessidade de segurança):
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /{document=**} {
//          allow read, write: if true;
//        }
//      }
//    }
//
// Enquanto as chaves não forem preenchidas, o app funciona 100% offline
// usando localStorage neste dispositivo — nada quebra.
// =====================================================================

export const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Defina como true somente depois de preencher as chaves reais acima.
export const FIREBASE_ENABLED = false;
