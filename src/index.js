import { onRequestPost as resumir } from "../functions/resumir.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/resumir" && request.method === "POST") {
      return resumir({ request, env });
    }

    // Qualquer outra rota: serve os arquivos estáticos do app
    // (index.html, css, js, manifest, etc.)
    return env.ASSETS.fetch(request);
  }
};
