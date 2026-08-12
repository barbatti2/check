// worker.js
//
// Este projeto está publicado como um Cloudflare Worker com Static Assets
// (o domínio "*.workers.dev" indica esse modelo, diferente do Cloudflare
// Pages clássico — por isso a pasta "functions/" não é usada aqui).
//
// Este único arquivo faz duas coisas:
// 1. Serve os arquivos estáticos do app (index.html, css, js, etc.) via
//    o binding ASSETS configurado no wrangler.jsonc.
// 2. Trata a rota POST /resumir chamando a API do Gemini para gerar o
//    resumo das pendências agrupado por setor.
//
// Requer a variável de ambiente GEMINI_API_KEY configurada no painel do
// Cloudflare (Settings → Variables and Secrets do projeto). A chave NUNCA
// fica no código — só é lida em tempo de execução via env.GEMINI_API_KEY.

// Modelos tentados em ordem — o Google costuma aposentar modelos do Gemini
// com relativa frequência. Se o primeiro da lista deixar de existir (erro
// 404 "not found"), tenta automaticamente o próximo, sem precisar mexer
// no código de novo.
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.5-flash"];

const SYSTEM_PROMPT = `
Você organiza pendências de um checklist de loja (pet shop). Você recebe uma
lista de pendências. Cada uma traz três informações:
- "Setor": o setor da loja.
- "Pergunta": a pergunta do checklist que gerou essa pendência (ex.: "Todos
  os itens estão precificados?", "O setor está devidamente abastecido?",
  "O setor está organizado?"). Essa pergunta diz qual é o TIPO de problema.
- "Pendência": o texto curto que o funcionário escreveu. Na maioria das
  vezes é SÓ o nome de um produto ou um detalhe curto — não é uma frase
  explicando o problema.

Regra mais importante, leia com atenção:
NUNCA responda apenas colando o texto da pendência depois de "Ação
necessária:". Isso é ERRADO e é o erro mais comum que você comete — sua
tarefa é TRADUZIR a pergunta em uma ação (um verbo + o que fazer), e só
usar o texto da pendência para dizer EM QUAL item/lugar.

Como decidir a ação a partir da pergunta (use como referência, adapte para
perguntas parecidas mesmo que o texto não seja idêntico):
- Pergunta é sobre preço/etiqueta/precificação → ação é "colocar etiqueta de
  preço em" / "verificar o preço de".
- Pergunta é sobre abastecimento/estoque/reposição → ação é "repor" /
  "abastecer o estoque de".
- Pergunta é sobre organização/limpeza/gôndola → ação é "organizar" /
  "reorganizar a gôndola de" / "limpar".
- Pergunta não se encaixa em nenhuma acima → deduza a ação mais natural
  possível a partir do sentido da própria pergunta.

Exemplo completo (siga esse padrão de raciocínio):
- Setor: Higiene e Beleza
- Pergunta: Todos os itens estão precificados?
- Pendência: Cloro Genco Shampoo 5 Litros
- ERRADO (não faça isso): "Ação necessária: Cloro Genco Shampoo 5 Litros."
- CERTO: "Ação necessária: colocar etiqueta de preço no produto Cloro Genco Shampoo 5 Litros."

Tarefa:
1. Agrupe as pendências por setor (use exatamente o nome de setor recebido).
2. Para cada pendência, escreva a ação seguindo a regra acima, sempre no
   padrão fixo, começando com "Ação necessária: ...":
   - Se a pendência já vier como uma frase completa e clara descrevendo o
     problema (já tem um verbo, já explica o que fazer), apenas reescreva
     de forma mais objetiva no mesmo padrão, sem inventar detalhes novos.
   - Não invente informações que não estejam no texto original nem na
     pergunta (o nome do produto/detalhe deve vir exatamente do texto).
   - Não repita o nome do setor dentro da frase.
   - Mantenha a frase com no máximo ~20 palavras.
3. Se dois ou mais itens do mesmo setor tratarem exatamente do mesmo
   problema, você pode combiná-los em uma única ação.

Responda SOMENTE com um JSON válido, sem markdown, sem texto fora do JSON,
sem comentários, no formato exato abaixo:

{
  "setores": [
    { "setor": "Nome do Setor", "acoes": ["Ação necessária: ...", "Ação necessária: ..."] }
  ]
}
`.trim();

function jsonResponse(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: { "Content-Type": "application/json" }
  });
}

async function handleResumir(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "JSON inválido no corpo da requisição." });
  }

  const pendencias = Array.isArray(body.pendencias) ? body.pendencias : [];
  if (!pendencias.length) {
    return jsonResponse(400, { error: "Nenhuma pendência foi enviada." });
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "GEMINI_API_KEY não configurada no ambiente." });
  }

  const userContent = pendencias
    .map((p, i) => {
      const setor = (p.setor || "Sem setor").toString().trim();
      const pergunta = (p.pergunta || "").toString().trim();
      const texto = (p.texto || "").toString().trim();
      return `${i + 1}. Setor: ${setor} | Pergunta: ${pergunta || "(não informada)"} | Pendência: ${texto}`;
    })
    .join("\n");

  const url = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    let resp = null;
    let lastErrorText = "";
    for (const model of GEMINI_MODELS) {
      resp = await fetch(url(model), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userContent }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
            maxOutputTokens: 4096
          }
        })
      });

      if (resp.ok) break;

      lastErrorText = await resp.text();
      // Só tenta o próximo modelo se o erro for "modelo não encontrado"
      // (404) — outros erros (chave inválida, cota, etc.) não vão sumir
      // trocando de modelo, então já retorna o erro real.
      if (resp.status !== 404) {
        return jsonResponse(502, { error: "Erro ao chamar a API do Gemini.", details: lastErrorText });
      }
    }

    if (!resp || !resp.ok) {
      return jsonResponse(502, { error: "Nenhum modelo do Gemini disponível no momento.", details: lastErrorText });
    }

    const data = await resp.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      if (candidate?.finishReason === "MAX_TOKENS") {
        return jsonResponse(502, { error: "O resumo ficou grande demais e foi cortado pela IA. Tente com menos pendências de cada vez." });
      }
      return jsonResponse(502, { error: "A IA não retornou nenhum conteúdo." });
    }

    // Às vezes o modelo ainda embrulha o JSON em ```json ... ``` ou coloca
    // um texto de introdução antes/depois, mesmo pedindo responseMimeType
    // "application/json" — limpa tudo isso antes de tentar interpretar,
    // pegando só o trecho entre a primeira "{" e a última "}".
    let cleanText = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const firstBrace = cleanText.indexOf("{");
    const lastBrace = cleanText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleanText = cleanText.slice(firstBrace, lastBrace + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch {
      return jsonResponse(502, { error: "A IA não retornou um JSON válido.", raw: text });
    }

    if (!Array.isArray(parsed.setores)) {
      return jsonResponse(502, { error: "Formato de resposta inesperado da IA.", raw: parsed });
    }

    return jsonResponse(200, parsed);
  } catch (err) {
    return jsonResponse(500, { error: "Falha inesperada ao gerar o resumo.", details: String(err) });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/resumir") {
      if (request.method !== "POST") {
        return jsonResponse(405, { error: "Método não permitido." });
      }
      return handleResumir(request, env);
    }

    // Qualquer outra rota: serve os arquivos estáticos normalmente.
    return env.ASSETS.fetch(request);
  }
};
