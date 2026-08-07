# Ronda Pet — PWA de rondas diárias

App pessoal para o gerente fazer a ronda dos 13 setores da loja pet antes do checklist oficial, com pontuação, pendências e histórico. Dados ficam no **Firebase Firestore**.

## 1. Criar o projeto Firebase (5 min)

1. Acesse https://console.firebase.google.com → **Adicionar projeto**.
2. Dentro do projeto, vá em **Compilação → Firestore Database → Criar banco de dados** (modo produção, escolha a região mais próxima).
3. Em **Configurações do projeto → Geral → Seus apps**, clique no ícone `</>` para criar um app Web e copie o objeto `firebaseConfig`.
4. Abra `js/firebase.js` neste projeto e substitua os valores de `firebaseConfig` pelos seus.

## 2. Regras do Firestore (uso pessoal)

Como é um app de uso pessoal sem login, em **Firestore → Regras**, use (ajuste depois se quiser adicionar autenticação):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // uso pessoal — restrinja se for publicar a URL
    }
  }
}
```

> Recomendado: se for hospedar publicamente, ative **Firebase Authentication** (login anônimo, por exemplo) e troque a regra para `if request.auth != null`.

## 3. Publicar como PWA instalável

O app é 100% estático (HTML/CSS/JS), então qualquer hospedagem estática funciona. A mais simples é o próprio Firebase Hosting:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting     # aponte o "public directory" para esta pasta
firebase deploy
```

Alternativas: Netlify, Vercel ou GitHub Pages (basta arrastar a pasta ou conectar o repositório).

Depois de publicado com **HTTPS**, abra o link no celular (Chrome/Safari) → menu → **"Adicionar à tela inicial"** para instalar como app.

## 4. Primeira execução

Ao abrir pela primeira vez, o app cria automaticamente os 13 setores padrão no Firestore (com 4 perguntas genéricas cada). Personalize tudo em **Configurações**: adicionar/remover setores e perguntas.

## Estrutura de dados (Firestore)

- `setores/{id}` → `{ nome, icone, ordem, perguntas: [{id, texto}] }`
- `rondas/{id}` → `{ inicio, fim, status, setoresConcluidos[], pontuacao, conformes, naoConformes, pendenciasCount }`
- `rondas/{id}/respostas/{id}` → `{ setorId, perguntaId, resposta, observacao }`
- `pendencias/{id}` → `{ rondaId, setorId, descricao, responsavel, prazo, prioridade, status }`

## Arquivos

- `index.html` — shell do app
- `css/style.css` — design system (Material 3 + Apple HIG + neumorphism leve)
- `js/app.js` — lógica, telas e roteamento
- `js/firebase.js` — configuração e conexão com Firestore
- `js/seed-data.js` — setores/perguntas padrão
- `js/export.js` — exportação para Excel (.xlsx)
- `manifest.json`, `sw.js`, `icons/` — recursos de PWA instalável/offline
