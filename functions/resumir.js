// functions/resumir.js
//
// Cloudflare Pages Function. Fica acessível automaticamente em:
//   https://SEU-SITE.pages.dev/resumir
//
// Recebe a lista de pendências do checklist (texto + setor + pergunta de
// cada uma), chama a API do Gemini para agrupar e resumir por setor, num
// padrão de escrita fixo, e devolve o resultado em JSON estruturado.
//
// Requer a variável de ambiente GEMINI_API_KEY configurada no painel do
// Cloudflare Pages (Settings → Environment variables). A chave NUNCA fica
// no código — só é lida em tempo de execução via context.env.

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
  "O setor está organizado?"). Use essa pergunta como CONTEXTO para entender
  qual é o problema real — muitas vezes quem escreve a pendência só anota o
  nome do produto ou um detalhe curto, sem explicar o problema por extenso.
- "Pendência": o texto curto que o funcionário escreveu (às vezes é só o
  nome de um produto, às vezes já é uma frase completa).

Tarefa:
1. Agrupe as pendências por setor (use exatamente o nome de setor recebido).
2. Para cada pendência, escreva uma ação clara e específica combinando a
   pergunta (o tipo de problema) com o texto da pendência (o que/onde),
   sempre no seguinte padrão fixo, começando com:
   "Ação necessária: <o que precisa ser feito, incluindo o item ou detalhe citado>."
   Exemplos de como cruzar pergunta + pendência (são só exemplos de RACIOCÍNIO,
   não copie as frases prontas):
   - Pergunta sobre preços + pendência "Cloro Genco Shampoo 5 Litros" →
     "Ação necessária: colocar etiqueta de preço no produto Cloro Genco Shampoo 5 Litros."
   - Pergunta sobre abastecimento + pendência com nome de produto →
     "Ação necessária: repor o produto [nome] no setor."
   - Pergunta sobre organização + pendência descrevendo bagunça →
     "Ação necessária: organizar [o que foi descrito]."
   - Se a pendência já vier como uma frase completa e clara, apenas
     reescreva de forma mais objetiva no mesmo padrão, sem inventar detalhes.
   - Não invente informações que não estejam no texto original nem na pergunta.
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

// No Cloudflare Pages Functions, o nome da função define o método aceito:
// onRequestPost só responde a POST (GET/outros já recebem 405 automático).
export async function onRequestPost(context) {
  const { request, env } = context;

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
            responseMimeType: "application/json"
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
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return jsonResponse(502, { error: "A IA não retornou nenhum conteúdo." });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
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
