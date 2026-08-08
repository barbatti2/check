# Ronda Pet

App de rondas diárias para gerência de loja de pet shop — feito em React + Vite,
com Firebase (Firestore) como banco de dados, funcionando 100% offline com
sincronização automática quando a internet volta.

## Estrutura

- `src/App.jsx` — estado geral e navegação
- `src/components/` — telas (Home, Ronda, Sector, Summary, History, Pendencias, Settings)
- `src/firebase.js` — inicialização do Firebase (Auth anônimo + Firestore com cache offline)
- `src/lib/db.js` — leitura/escrita no Firestore
- `src/lib/helpers.js` — cálculos (pontuação, datas, etc.)
- `src/lib/export.js` — exportação Excel e compartilhamento WhatsApp
- `src/data/defaultSectors.js` — setores e perguntas padrão (editáveis em Configurações)

## 1. Criar o projeto no Firebase

1. Acesse https://console.firebase.google.com e crie um novo projeto.
2. Em **Build > Authentication > Sign-in method**, ative o provedor **Anônimo**.
3. Em **Build > Firestore Database**, clique em **Criar banco de dados** (modo produção).
4. Em **Configurações do projeto > Geral > Seus apps**, clique no ícone `</>` para
   criar um app Web e copie os valores do `firebaseConfig`.
5. Em **Firestore Database > Regras**, cole o conteúdo do arquivo `firestore.rules`
   deste projeto e publique. Isso garante que cada dispositivo só acesse seus
   próprios dados.

## 2. Configurar as variáveis de ambiente

Copie `.env.example` para `.env` e preencha com os valores do passo anterior:

```
cp .env.example .env
```

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

O arquivo `.env` já está no `.gitignore` e não deve ser commitado.

## 3. Rodar localmente

```
npm install
npm run dev
```

Abra o endereço mostrado no terminal (geralmente `http://localhost:5173`).
Teste também em modo offline: pare o Wi-Fi, continue usando o app normalmente,
e reative a internet — o Firestore sincroniza as rondas sozinho.

## 4. Subir para o GitHub

```
git init
git add .
git commit -m "Ronda Pet - versão inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/ronda-pet.git
git push -u origin main
```

## 5. Publicar (opcional)

Qualquer serviço de hospedagem estática funciona. Os mais simples:

**Firebase Hosting**
```
npm install -g firebase-tools
firebase login
firebase init hosting   # escolha "dist" como diretório público, SPA: sim
npm run build
firebase deploy
```

**Vercel**: importe o repositório em vercel.com, ele detecta o Vite automaticamente.

**GitHub Pages**: rode `npm run build`, publique o conteúdo de `dist/` na branch
`gh-pages` (ex.: com o pacote `gh-pages`).

Depois de publicado, abra o link no celular e use **"Adicionar à tela de início"**
no navegador para que o app se comporte como um aplicativo nativo.

## Notas

- Autenticação anônima é suficiente para uso pessoal (um único usuário/dispositivo
  lógico). Se quiser acessar as mesmas rondas de vários aparelhos, troque para
  login por e-mail/senha ou Google em `src/firebase.js` e `src/lib/db.js`.
- Fotos das perguntas são salvas como base64 dentro do próprio documento da
  ronda no Firestore — ótimo para uso pessoal, mas evite fotos muito grandes
  (cada documento tem limite de 1 MB no Firestore).
- O menu de navegação é o botão flutuante (FAB) no canto inferior direito:
  toque nele para abrir Iniciar/Continuar ronda, Pendências, Histórico e
  Configurações.
