# Ronda Pet — PWA de Rondas Diárias

App pessoal (HTML + CSS + JS puro) para conduzir a ronda diária de checklist
antes do checklist oficial da loja.

## Como usar agora (sem nenhuma configuração)

Basta abrir `index.html` num navegador (ou hospedar os arquivos em qualquer
servidor estático / GitHub Pages / Netlify). Sem configurar o Firebase, o
app funciona 100% localmente neste dispositivo, salvando tudo em
`localStorage` — nada quebra, nada trava.

Para instalar como app (PWA): abra pelo Chrome/Safari no celular → menu →
"Adicionar à tela de início".

## Conectar ao Firestore (opcional, recomendado para uso contínuo)

1. Crie um projeto em https://console.firebase.google.com
2. Ative **Firestore Database**.
3. Em *Configurações do projeto → Seus apps → Web*, copie as chaves.
4. Abra `js/config-firebase.js`, cole suas chaves em `firebaseConfig` e
   troque `FIREBASE_ENABLED` para `true`.
5. Nas regras do Firestore (uso pessoal, um único dispositivo):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   Ajuste conforme sua necessidade de segurança se for expor publicamente.

Com o Firestore ativado, a tela **Configurações → Conexão** mostra o status
em tempo real.

## Estrutura

```
index.html
manifest.json          → metadados do PWA
sw.js                   → cache do app-shell (funciona offline)
css/style.css           → design system completo
js/config-firebase.js   → suas chaves do Firebase
js/data-default.js      → setores e perguntas padrão (editáveis no app)
js/db.js                → camada de dados (Firestore + fallback local)
js/app.js               → toda a lógica da interface
icons/                  → ícones do PWA
```

## Funcionalidades

- Tela inicial com **Iniciar Ronda**, histórico recente e atalho de Configurações
- 13 setores em cartões, cada um marcado com ✓ ao ser concluído (não permite refazer sem querer)
- Perguntas por setor, com resposta 😞/🙂, observação opcional e criação de pendência
  (descrição, responsável, prazo, prioridade)
- Barra de progresso da ronda e de cada setor
- Resumo final com anel de pontuação, conformes/não conformes e lista de pendências
- Exportação para Excel (.xlsx) com 3 abas: Resumo, Checklist detalhado e Pendências
- Histórico completo com filtro por período
- Configurações: ativar/desativar setores e cadastrar/remover perguntas de cada um
