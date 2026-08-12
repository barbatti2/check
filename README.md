# Ronda · Checklist da Loja

PWA pessoal para rondas diárias em loja pet, antes do checklist oficial. Setores configuráveis, perguntas com resposta rápida, pendências com responsável/prazo/prioridade, progresso em tempo real, histórico com filtro por data e exportação para Excel. Dados salvos no Firestore.

## 1. Criar o projeto Firebase (gratuito)

1. Acesse **console.firebase.google.com** e crie um projeto.
2. No menu lateral, abra **Firestore Database** → **Criar banco de dados** → modo produção (as regras abaixo cuidam do acesso) → escolha a região mais próxima (ex: `southamerica-east1`).
3. Em **Configurações do projeto → Seus apps**, clique no ícone **Web (`</>`)**, registre um app (não precisa de Hosting agora) e copie o objeto `firebaseConfig`.
4. Cole esse objeto em `js/firebase-init.js`, substituindo os valores de exemplo.

### Regras do Firestore

Como é um app de uso pessoal (sem tela de login), a forma mais simples é liberar leitura/escrita apenas para as coleções do app. Em **Firestore → Regras**, use:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sectors/{doc} { allow read, write: if true; }
    match /rondas/{doc}  { allow read, write: if true; }
  }
}
```

> Isso deixa o banco acessível a quem tiver a URL do app publicada. Para uso realmente pessoal, publique em um link que só você conhece, ou (recomendado se for expor publicamente) ative **Firebase Authentication** (login anônimo é suficiente) e troque as regras para `if request.auth != null`.

> **Índice composto:** na primeira vez que abrir o Histórico (ou retomar uma ronda), o Firestore pode recusar a consulta e mostrar no console do navegador um link "Create Index" — é normal, é só clicar no link e aguardar ~1 minuto. Isso acontece porque o app filtra por `status` e ordena por `startedAt` ao mesmo tempo, na coleção `rondas`.

## 2. Rodar localmente

O app usa ES Modules e Firestore, então precisa ser servido por HTTP (não abra o `index.html` direto no navegador). Qualquer servidor estático funciona, por exemplo:

```bash
cd pet-ronda
python3 -m http.server 8080
# depois abra http://localhost:8080
```

## 3. Publicar e instalar como PWA

Hospede a pasta em **Firebase Hosting**, **Netlify**, **Vercel** ou **GitHub Pages** (qualquer HTTPS estático serve). Depois, no celular:

- **Android/Chrome:** menu → "Adicionar à tela inicial".
- **iPhone/Safari:** compartilhar → "Adicionar à Tela de Início".

O app funciona offline para navegação (app shell em cache); os dados de rondas exigem conexão para salvar no Firestore.

## 4. Primeiro uso

1. Abra **Configurações** e cadastre as perguntas de cada setor (os 13 setores já vêm criados automaticamente).
2. Volte para a Home e toque em **Iniciar ronda**.
3. Percorra os setores, responda cada pergunta (Atingiu / Não atingiu), adicione observações e crie pendências quando necessário.
4. Finalize cada setor (fica bloqueado após concluído, evitando refazer por engano) e, ao concluir todos, toque em **Ver resultado**.
5. Exporte para Excel ou apenas conclua e volte à Home. A ronda fica salva no **Histórico**, com filtro por data.

## Resumo por IA (Cloudflare Pages + Gemini)

Na tela de Resultado (e também no detalhe de um item do Histórico), quando há pendências registradas aparece o botão **"Gerar resumo com IA"**. Ele agrupa todas as pendências por setor (usando também a pergunta do checklist que gerou cada uma, como contexto) e usa o Gemini para reescrever cada uma no padrão "Ação necessária: ...".

Para funcionar, o site precisa estar publicado no **Cloudflare Pages** (usa a Pages Function em `functions/resumir.js`, acessível em `/resumir`):

1. Crie o projeto no Cloudflare Pages conectado a este repositório (Framework preset: **None**, build command: vazio, build output directory: `.`).
2. No painel do projeto, vá em **Settings → Environment variables** e adicione `GEMINI_API_KEY` com sua chave da API do Gemini (nunca coloque a chave no código).
3. Faça um novo deploy (**Deployments → Retry deployment**, ou um novo push) para a variável entrar em vigor.
4. Se o site estiver hospedado em outro lugar (ex: GitHub Pages), o botão vai mostrar erro ao chamar a IA, já que a function só existe onde o Cloudflare Pages publicar.

## Estrutura de arquivos- ___

```
pet-ronda/
├── index.html
├── manifest.json
├── sw.js
├── functions/
│   └── resumir.js          ← Cloudflare Pages Function; chama a API do Gemini (usa GEMINI_API_KEY)
├── css/style.css
├── js/
│   ├── firebase-init.js   ← cole aqui suas credenciais
│   ├── db.js               ← acesso ao Firestore
│   ├── export.js           ← exportação Excel (SheetJS)
│   └── main.js             ← lógica e telas do app
└── icons/
```
