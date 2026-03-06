// ==================================================================
// JusBrasil Busca Inteligente — Overlay Script
// Injetado via bookmarklet na pagina do JusBrasil
// Chama Claude API diretamente (sem servidor local)
// ==================================================================
(function () {
  "use strict";

  // Evitar dupla injecao
  if (window.__JUSBRASIL_IA_LOADED__) {
    const existing = document.getElementById("jbia-panel");
    if (existing) existing.style.display = "flex";
    return;
  }
  window.__JUSBRASIL_IA_LOADED__ = true;

  const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
  const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
  const LS_KEY = "jbia_anthropic_api_key";

  // ================================================================
  // STATE
  // ================================================================
  let state = {
    buscando: false,
    resultados: [],
    filtroOutcome: "todos",
    termosDestaque: [],
    queriesUsadas: [],
  };

  // ================================================================
  // API KEY MANAGEMENT (localStorage)
  // ================================================================
  function getApiKey() {
    return localStorage.getItem(LS_KEY) || "";
  }

  function setApiKey(key) {
    localStorage.setItem(LS_KEY, key);
  }

  // ================================================================
  // ESTILOS
  // ================================================================
  const style = document.createElement("style");
  style.textContent = `
    #jbia-panel {
      position: fixed; top: 0; right: 0;
      width: 440px; height: 100vh;
      background: #0a1628;
      color: #e2e8f0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      z-index: 999999;
      display: flex; flex-direction: column;
      box-shadow: -4px 0 24px rgba(0,0,0,.4);
      transition: transform .3s ease;
      font-size: 14px;
      line-height: 1.5;
    }
    #jbia-panel.jbia-hidden { transform: translateX(100%); pointer-events: none; }

    #jbia-fab {
      position: fixed; bottom: 24px; right: 24px;
      width: 56px; height: 56px;
      background: linear-gradient(135deg, #06b6d4, #0891b2);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 999998;
      box-shadow: 0 4px 16px rgba(6,182,212,.4);
      transition: transform .2s, box-shadow .2s;
      border: none; color: #fff; font-size: 22px; font-weight: 700;
    }
    #jbia-fab:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(6,182,212,.6); }

    .jbia-header {
      background: linear-gradient(135deg, #0f1d34, #162844);
      padding: 16px 20px;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 2px solid #06b6d4;
      flex-shrink: 0;
    }
    .jbia-header h2 {
      font-size: 16px; font-weight: 700; margin: 0; color: #fff;
    }
    .jbia-header h2 span { color: #22d3ee; }
    .jbia-close {
      background: none; border: none; color: #94a3b8; font-size: 22px;
      cursor: pointer; padding: 4px 8px; border-radius: 6px;
    }
    .jbia-close:hover { color: #fff; background: rgba(255,255,255,.1); }

    .jbia-body {
      flex: 1; overflow-y: auto; padding: 16px 20px;
    }
    .jbia-body::-webkit-scrollbar { width: 6px; }
    .jbia-body::-webkit-scrollbar-track { background: transparent; }
    .jbia-body::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 3px; }

    .jbia-section { margin-bottom: 16px; }
    .jbia-label {
      font-size: 12px; font-weight: 600; color: #94a3b8;
      text-transform: uppercase; letter-spacing: .5px;
      margin-bottom: 6px;
    }

    .jbia-textarea {
      width: 100%; min-height: 80px; padding: 12px;
      background: #0f1d34; border: 2px solid #1e3a5f;
      border-radius: 10px; color: #e2e8f0;
      font-family: inherit; font-size: 14px;
      resize: vertical; outline: none;
    }
    .jbia-textarea:focus { border-color: #06b6d4; }
    .jbia-textarea::placeholder { color: #475569; }

    .jbia-input-sm {
      width: 100%; padding: 10px 12px;
      background: #0f1d34; border: 2px solid #1e3a5f;
      border-radius: 8px; color: #e2e8f0;
      font-family: monospace; font-size: 13px;
      outline: none;
    }
    .jbia-input-sm:focus { border-color: #06b6d4; }
    .jbia-input-sm::placeholder { color: #475569; }

    .jbia-key-row {
      display: flex; gap: 8px; align-items: center;
    }
    .jbia-key-row input { flex: 1; }
    .jbia-key-save {
      padding: 10px 16px; background: #06b6d4; color: #fff;
      border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit; white-space: nowrap;
    }
    .jbia-key-save:hover { background: #0891b2; }
    .jbia-key-status {
      font-size: 12px; margin-top: 4px;
    }
    .jbia-key-ok { color: #22c55e; }
    .jbia-key-change {
      color: #06b6d4; cursor: pointer; font-size: 12px;
      background: none; border: none; padding: 0; font-family: inherit;
    }

    .jbia-examples {
      display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;
    }
    .jbia-example-btn {
      padding: 4px 10px; background: #162844; border: 1px solid #1e3a5f;
      border-radius: 6px; color: #94a3b8; font-size: 12px;
      cursor: pointer; transition: all .15s;
    }
    .jbia-example-btn:hover { background: #1e3a5f; color: #22d3ee; border-color: #06b6d4; }

    .jbia-tribunais {
      display: flex; flex-wrap: wrap; gap: 6px;
    }
    .jbia-trib-chip {
      padding: 4px 10px; background: #162844; border: 1px solid #1e3a5f;
      border-radius: 6px; color: #94a3b8; font-size: 12px;
      cursor: pointer; transition: all .15s; user-select: none;
    }
    .jbia-trib-chip.active { background: #06b6d4; color: #fff; border-color: #06b6d4; }
    .jbia-trib-chip:hover { border-color: #06b6d4; }

    .jbia-search-btn {
      width: 100%; padding: 14px; border: none; border-radius: 10px;
      background: linear-gradient(135deg, #06b6d4, #0891b2);
      color: #fff; font-size: 15px; font-weight: 700;
      cursor: pointer; font-family: inherit; transition: all .2s;
    }
    .jbia-search-btn:hover { background: linear-gradient(135deg, #0891b2, #0e7490); }
    .jbia-search-btn:disabled { opacity: .5; cursor: not-allowed; }

    .jbia-progress { margin: 12px 0; }
    .jbia-progress-bar {
      height: 6px; background: #162844; border-radius: 3px; overflow: hidden;
    }
    .jbia-progress-fill {
      height: 100%; background: linear-gradient(90deg, #06b6d4, #22d3ee);
      border-radius: 3px; transition: width .3s;
    }
    .jbia-progress-text { font-size: 12px; color: #64748b; margin-top: 4px; }

    .jbia-stats { display: flex; gap: 8px; margin: 12px 0; flex-wrap: wrap; }
    .jbia-stat {
      padding: 6px 12px; background: #0f1d34; border-radius: 8px;
      font-size: 12px; color: #94a3b8;
    }
    .jbia-stat b { color: #22d3ee; }

    .jbia-filters { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
    .jbia-filter-btn {
      padding: 5px 12px; background: #162844; border: 1px solid #1e3a5f;
      border-radius: 6px; color: #94a3b8; font-size: 12px;
      cursor: pointer; transition: all .15s;
    }
    .jbia-filter-btn.active { background: #06b6d4; color: #fff; border-color: #06b6d4; }
    .jbia-filter-btn:hover { border-color: #06b6d4; }

    .jbia-result {
      background: #0f1d34; border: 1px solid #1e3a5f;
      border-radius: 10px; padding: 14px; margin-bottom: 10px;
      transition: border-color .2s;
    }
    .jbia-result:hover { border-color: #06b6d4; }
    .jbia-result-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 6px;
    }
    .jbia-result-score {
      background: linear-gradient(135deg, #06b6d4, #0891b2);
      color: #fff; font-size: 13px; font-weight: 700;
      padding: 3px 10px; border-radius: 6px; flex-shrink: 0;
    }
    .jbia-result-score.high { background: linear-gradient(135deg, #22c55e, #16a34a); }
    .jbia-result-score.medium { background: linear-gradient(135deg, #eab308, #ca8a04); }
    .jbia-result-score.low { background: linear-gradient(135deg, #64748b, #475569); }
    .jbia-result-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
    .jbia-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .jbia-badge-court { background: #1e3a5f; color: #22d3ee; }
    .jbia-badge-date { background: #162844; color: #94a3b8; }
    .jbia-badge-type { background: #162844; color: #94a3b8; }
    .jbia-badge-favoravel { background: rgba(34,197,94,.15); color: #22c55e; }
    .jbia-badge-desfavoravel { background: rgba(239,68,68,.15); color: #ef4444; }
    .jbia-badge-parcial { background: rgba(234,179,8,.15); color: #eab308; }
    .jbia-badge-neutro { background: #162844; color: #94a3b8; }
    .jbia-badge-mandatory { background: rgba(168,85,247,.15); color: #a855f7; }

    .jbia-result-title {
      font-size: 14px; font-weight: 600; color: #f1f5f9;
      margin-bottom: 6px; cursor: pointer;
    }
    .jbia-result-title:hover { color: #22d3ee; }
    .jbia-result-ementa {
      font-size: 13px; color: #94a3b8; line-height: 1.6;
      max-height: 80px; overflow: hidden; transition: max-height .3s;
    }
    .jbia-result-ementa.expanded { max-height: 600px; }
    .jbia-result-ementa b, .jbia-result-ementa strong { color: #22d3ee; font-weight: 600; }
    .jbia-expand-btn {
      background: none; border: none; color: #06b6d4; font-size: 12px;
      cursor: pointer; padding: 4px 0; font-family: inherit;
    }

    .jbia-result-footer {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 8px; padding-top: 8px; border-top: 1px solid #1e3a5f;
    }
    .jbia-result-link {
      color: #06b6d4; font-size: 12px; text-decoration: none; font-weight: 500;
    }
    .jbia-result-link:hover { text-decoration: underline; }
    .jbia-result-matches { font-size: 11px; color: #64748b; }

    .jbia-export-bar {
      display: flex; gap: 8px; padding: 12px 20px;
      background: #0f1d34; border-top: 1px solid #1e3a5f; flex-shrink: 0;
    }
    .jbia-export-btn {
      flex: 1; padding: 10px; border: 1px solid #1e3a5f; border-radius: 8px;
      background: #162844; color: #94a3b8; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit; text-align: center;
    }
    .jbia-export-btn:hover { border-color: #06b6d4; color: #22d3ee; }

    .jbia-empty { text-align: center; padding: 40px 20px; color: #475569; }
    .jbia-empty-icon { font-size: 40px; margin-bottom: 12px; }

    .jbia-error {
      background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3);
      border-radius: 8px; padding: 12px; margin: 12px 0;
      color: #fca5a5; font-size: 13px;
    }

    .jbia-explicacao {
      background: rgba(6,182,212,.08); border: 1px solid rgba(6,182,212,.2);
      border-radius: 8px; padding: 10px 12px; margin: 10px 0;
      font-size: 12px; color: #94a3b8; line-height: 1.5;
    }

    @media (max-width: 500px) {
      #jbia-panel { width: 100vw; }
    }
  `;
  document.head.appendChild(style);

  // Carregar Inter se nao existir
  if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Inter"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }

  // ================================================================
  // EXEMPLOS E TRIBUNAIS
  // ================================================================
  const EXEMPLOS = [
    "Exclusao do ICMS da base de calculo do PIS e COFINS",
    "Honorarios advocaticios em execucao fiscal",
    "Responsabilidade tributaria de socios-administradores",
    "Imunidade tributaria de entidades religiosas",
    "Prescricao intercorrente em execucao fiscal",
    "ITBI na integralizacao de capital social",
  ];

  const TRIBUNAIS = [
    { id: "todos", label: "Todos" },
    { id: "stf", label: "STF" },
    { id: "stj", label: "STJ" },
    { id: "trf-1", label: "TRF1" },
    { id: "trf-2", label: "TRF2" },
    { id: "trf-3", label: "TRF3" },
    { id: "trf-4", label: "TRF4" },
    { id: "trf-5", label: "TRF5" },
    { id: "trf-6", label: "TRF6" },
  ];

  let tribunalSelecionado = "todos";

  // ================================================================
  // CHAMAR CLAUDE API DIRETO DO BROWSER
  // ================================================================
  async function chamarClaude(apiKey, descricao) {
    const prompt = `Voce e um especialista em direito brasileiro e pesquisa juridica.
O usuario precisa encontrar jurisprudencia relevante no JusBrasil (todos os tribunais do Brasil).

O usuario descreveu o caso: "${descricao}"

Sua tarefa: gerar termos de busca OTIMIZADOS para o JusBrasil.

O JusBrasil aceita:
- Termos simples: honorarios advocaticios
- Frases exatas com aspas: "exclusao do ICMS" "base de calculo"
- Combinacao de termos e frases: "PIS e COFINS" base calculo exclusao

REGRAS:
1. Gere 10-15 queries diferentes, variando:
   - Termos tecnicos vs linguagem processual
   - Nome completo vs abreviacao (ex: "imposto de renda" vs "IRPJ")
   - Tese principal vs argumentos acessorios
   - Diferentes formulacoes do mesmo conceito
2. Use aspas duplas para frases exatas importantes
3. Combine 2-3 conceitos por query (nao muito longa, nao muito curta)
4. Inclua queries com:
   - Termos do direito material (o merito)
   - Termos processuais (recurso, apelacao, mandado de seguranca)
   - Citacoes de artigos de lei relevantes (art. 150, art. 195, etc.)
5. Cada query deve ter entre 3 e 8 palavras/frases

Retorne APENAS um JSON valido (sem markdown, sem ${"```"}), com esta estrutura:
{
  "queries": ["query1", "query2", ...],
  "termos_destaque": [
    {"regex": "padrao regex JS valido", "label": "Nome curto", "cor": "#HEX", "peso": 15},
    ...
  ],
  "filtro_bloco_regex_principal": "regex JS para identificar o tema principal no texto",
  "filtro_bloco_regex_contexto": "regex JS para contexto juridico complementar",
  "explicacao": "Breve explicacao da estrategia de busca em 1-2 frases"
}

Os termos_destaque devem ter 4-6 itens com cores distintas:
- Tema principal: #FF6B6B (vermelho), peso 15-20
- Contexto juridico: #4ECDC4 (teal), peso 10-15
- Termos processuais: #45B7D1 (azul), peso 8-12
- Legislacao: #96CEB4 (verde), peso 10-15
- Resultado/decisao: #FFEAA7 (amarelo), peso 5-8`;

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `Erro HTTP ${resp.status}`;
      throw new Error(errMsg);
    }

    const data = await resp.json();
    let text = data.content[0].text.trim();

    // Extrair JSON de dentro de markdown (```json ... ```) ou texto
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    return JSON.parse(text);
  }

  // ================================================================
  // CRIAR DOM
  // ================================================================
  function criarPanel() {
    // FAB
    const fab = document.createElement("button");
    fab.id = "jbia-fab";
    fab.innerHTML = "JB";
    fab.title = "JusBrasil IA";
    fab.onclick = () => {
      panel.classList.remove("jbia-hidden");
      fab.style.display = "none";
    };
    document.body.appendChild(fab);
    fab.style.display = "none";

    // Painel
    const panel = document.createElement("div");
    panel.id = "jbia-panel";

    const hasKey = !!getApiKey();

    panel.innerHTML = `
      <div class="jbia-header">
        <h2>JusBrasil <span>Busca Inteligente</span></h2>
        <button class="jbia-close" id="jbia-close-btn" title="Fechar">&times;</button>
      </div>
      <div class="jbia-body" id="jbia-body">
        <!-- API Key -->
        <div class="jbia-section" id="jbia-key-section">
          <div class="jbia-label">API Key (Anthropic)</div>
          <div id="jbia-key-configured" style="display:${hasKey ? "block" : "none"}">
            <span class="jbia-key-ok">Configurada: ${hasKey ? getApiKey().substring(0, 10) + "..." : ""}</span>
            <button class="jbia-key-change" id="jbia-key-change">trocar</button>
          </div>
          <div id="jbia-key-input-area" style="display:${hasKey ? "none" : "block"}">
            <div class="jbia-key-row">
              <input type="password" class="jbia-input-sm" id="jbia-key-input" placeholder="sk-ant-api03-...">
              <button class="jbia-key-save" id="jbia-key-save">Salvar</button>
            </div>
            <div class="jbia-key-status" id="jbia-key-status"></div>
          </div>
        </div>

        <!-- Descricao -->
        <div class="jbia-section">
          <div class="jbia-label">Descreva seu caso</div>
          <textarea class="jbia-textarea" id="jbia-input"
            placeholder="Ex: Preciso de jurisprudencia sobre exclusao do ICMS da base de calculo do PIS e COFINS..."
          ></textarea>
          <div class="jbia-examples" id="jbia-examples"></div>
        </div>

        <!-- Tribunais -->
        <div class="jbia-section">
          <div class="jbia-label">Filtrar por tribunal</div>
          <div class="jbia-tribunais" id="jbia-tribunais"></div>
        </div>

        <!-- Botao buscar -->
        <div class="jbia-section">
          <button class="jbia-search-btn" id="jbia-search-btn">Pesquisar com IA</button>
        </div>

        <!-- Progresso -->
        <div class="jbia-progress" id="jbia-progress" style="display:none;">
          <div class="jbia-progress-bar">
            <div class="jbia-progress-fill" id="jbia-progress-fill" style="width:0%"></div>
          </div>
          <div class="jbia-progress-text" id="jbia-progress-text"></div>
        </div>

        <!-- Explicacao -->
        <div id="jbia-explicacao" style="display:none;"></div>

        <!-- Erro -->
        <div id="jbia-error" style="display:none;"></div>

        <!-- Stats -->
        <div class="jbia-stats" id="jbia-stats" style="display:none;"></div>

        <!-- Filtros -->
        <div class="jbia-filters" id="jbia-filters" style="display:none;"></div>

        <!-- Resultados -->
        <div id="jbia-results"></div>
      </div>

      <!-- Export -->
      <div class="jbia-export-bar" id="jbia-export-bar" style="display:none;">
        <button class="jbia-export-btn" id="jbia-csv-btn">Exportar CSV</button>
        <button class="jbia-export-btn" id="jbia-copy-btn">Copiar links</button>
      </div>
    `;
    document.body.appendChild(panel);

    // Eventos
    document.getElementById("jbia-close-btn").onclick = () => {
      panel.classList.add("jbia-hidden");
      fab.style.display = "flex";
    };

    // API Key save
    document.getElementById("jbia-key-save").onclick = () => {
      const key = document.getElementById("jbia-key-input").value.trim();
      if (!key || !key.startsWith("sk-")) {
        document.getElementById("jbia-key-status").innerHTML =
          '<span style="color:#ef4444">API key invalida (deve comecar com sk-)</span>';
        return;
      }
      setApiKey(key);
      document.getElementById("jbia-key-configured").style.display = "block";
      document.getElementById("jbia-key-configured").innerHTML =
        '<span class="jbia-key-ok">Configurada: ' + key.substring(0, 10) + '...</span> ' +
        '<button class="jbia-key-change" id="jbia-key-change">trocar</button>';
      document.getElementById("jbia-key-input-area").style.display = "none";
      document.getElementById("jbia-key-change").onclick = mostrarKeyInput;
    };

    // API Key change
    const changeBtn = document.getElementById("jbia-key-change");
    if (changeBtn) changeBtn.onclick = mostrarKeyInput;

    function mostrarKeyInput() {
      document.getElementById("jbia-key-configured").style.display = "none";
      document.getElementById("jbia-key-input-area").style.display = "block";
      document.getElementById("jbia-key-input").value = "";
      document.getElementById("jbia-key-status").innerHTML = "";
    }

    // Exemplos
    const exDiv = document.getElementById("jbia-examples");
    EXEMPLOS.forEach((ex) => {
      const btn = document.createElement("button");
      btn.className = "jbia-example-btn";
      btn.textContent = ex.length > 40 ? ex.substring(0, 38) + "..." : ex;
      btn.title = ex;
      btn.onclick = () => { document.getElementById("jbia-input").value = ex; };
      exDiv.appendChild(btn);
    });

    // Tribunais
    const tribDiv = document.getElementById("jbia-tribunais");
    TRIBUNAIS.forEach((t) => {
      const chip = document.createElement("span");
      chip.className = "jbia-trib-chip" + (t.id === "todos" ? " active" : "");
      chip.textContent = t.label;
      chip.dataset.id = t.id;
      chip.onclick = () => {
        tribunalSelecionado = t.id;
        tribDiv.querySelectorAll(".jbia-trib-chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
      };
      tribDiv.appendChild(chip);
    });

    // Buscar
    document.getElementById("jbia-search-btn").onclick = iniciarBusca;

    // Enter
    document.getElementById("jbia-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); iniciarBusca(); }
    });

    // Export
    document.getElementById("jbia-csv-btn").onclick = exportarCSV;
    document.getElementById("jbia-copy-btn").onclick = copiarLinks;
  }

  // ================================================================
  // BUSCA PRINCIPAL
  // ================================================================
  async function iniciarBusca() {
    const input = document.getElementById("jbia-input");
    const descricao = input.value.trim();
    if (!descricao || state.buscando) return;

    const apiKey = getApiKey();
    if (!apiKey) {
      mostrarErro("Configure sua API key da Anthropic primeiro.");
      return;
    }

    state.buscando = true;
    state.resultados = [];
    state.filtroOutcome = "todos";
    state.termosDestaque = [];
    state.queriesUsadas = [];

    const btn = document.getElementById("jbia-search-btn");
    btn.disabled = true;
    btn.textContent = "Gerando queries com IA...";

    esconderElemento("jbia-error");
    esconderElemento("jbia-stats");
    esconderElemento("jbia-filters");
    esconderElemento("jbia-export-bar");
    esconderElemento("jbia-explicacao");
    document.getElementById("jbia-results").innerHTML = "";

    mostrarProgresso(0, 1, "Consultando Claude AI...");

    try {
      // 1. Chamar Claude diretamente
      const data = await chamarClaude(apiKey, descricao);
      const queries = data.queries || [];
      state.termosDestaque = data.termos_destaque || [];
      state.queriesUsadas = queries;

      if (data.explicacao) {
        mostrarExplicacao(data.explicacao);
      }

      if (queries.length === 0) {
        throw new Error("Claude nao gerou nenhuma query de busca.");
      }

      // 2. Buscar no JusBrasil (paralelo, batches de 3)
      const todosResultados = [];
      const total = queries.length;
      let concluidas = 0;

      mostrarProgresso(0, total, "Buscando 0/" + total + " queries...");

      const BATCH_SIZE = 3;
      for (let i = 0; i < queries.length; i += BATCH_SIZE) {
        const batch = queries.slice(i, i + BATCH_SIZE);
        const promessas = batch.map((q) => buscarJusBrasil(q));
        const resultados = await Promise.allSettled(promessas);

        resultados.forEach((r, idx) => {
          concluidas++;
          if (r.status === "fulfilled" && r.value.length > 0) {
            r.value.forEach((item) => { item._query = batch[idx]; });
            todosResultados.push(...r.value);
          }
          mostrarProgresso(concluidas, total, "Buscando " + concluidas + "/" + total + " queries...");
        });

        if (i + BATCH_SIZE < queries.length) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      // 3. Deduplicar e scoring
      const deduplicados = deduplicar(todosResultados);
      const scored = deduplicados.map((item) => pontuar(item, data));
      scored.sort((a, b) => b._score - a._score);

      state.resultados = scored;

      // 4. Renderizar
      mostrarProgresso(total, total, "Concluido!");
      setTimeout(() => esconderElemento("jbia-progress"), 1000);

      mostrarStats(scored);
      mostrarFiltros();
      renderizarResultados();

      if (scored.length > 0) {
        document.getElementById("jbia-export-bar").style.display = "flex";
      }
    } catch (e) {
      mostrarErro(e.message);
      esconderElemento("jbia-progress");
    } finally {
      state.buscando = false;
      btn.disabled = false;
      btn.textContent = "Pesquisar com IA";
    }
  }

  // ================================================================
  // BUSCAR NO JUSBRASIL (same-origin fetch)
  // ================================================================
  async function buscarJusBrasil(query) {
    const params = new URLSearchParams({ q: query });
    if (tribunalSelecionado !== "todos") {
      params.set("tribunal", tribunalSelecionado);
    }

    const url = "/jurisprudencia/busca?" + params.toString();
    const resp = await fetch(url, {
      credentials: "include",
      headers: { Accept: "text/html" },
    });

    if (!resp.ok) return [];

    const html = await resp.text();

    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return [];

    let nextData;
    try { nextData = JSON.parse(match[1]); } catch (e) { return []; }

    return extrairResultados(nextData);
  }

  function extrairResultados(nextData) {
    try {
      const apolloState = nextData?.props?.pageProps?.__APOLLO_STATE__;
      if (!apolloState) return [];

      const rootQuery = apolloState["ROOT_QUERY"];
      if (!rootQuery) return [];

      let items = [];
      for (const key of Object.keys(rootQuery)) {
        if (key.startsWith("searchHaystack")) {
          const searchResult = rootQuery[key];
          if (searchResult && searchResult.items) {
            items = searchResult.items;
            break;
          }
        }
      }

      if (items.length === 0) {
        for (const key of Object.keys(rootQuery)) {
          if (key.startsWith("searchHaystack")) {
            const val = rootQuery[key];
            if (val && Array.isArray(val.items)) {
              items = val.items.map((ref) => {
                if (ref && ref.__ref) return apolloState[ref.__ref] || ref;
                return ref;
              });
              break;
            }
          }
        }
      }

      return items
        .map((item) => {
          const d = item?.data || item;
          if (!d || !d.docId) return null;
          return {
            docId: d.docId || "",
            court: d.court || "",
            title: d.title || "",
            type: d.type || "",
            date: d.date || "",
            url: d.url || "",
            slug: d.slug || "",
            highlight: d.highlight || "",
            plainFacts: d.addons?.plainFacts || d.plainFacts || "",
            isMandatoryPrecedent: d.isMandatoryPrecedent || false,
            thesisType: d.thesisType || "",
            _matchCount: 1,
            _queries: [],
          };
        })
        .filter(Boolean);
    } catch (e) {
      console.warn("[JusBrasil IA] Erro ao extrair resultados:", e);
      return [];
    }
  }

  // ================================================================
  // DEDUPLICAR
  // ================================================================
  function deduplicar(items) {
    const mapa = new Map();
    for (const item of items) {
      const id = item.docId;
      if (!id) continue;
      if (mapa.has(id)) {
        const existing = mapa.get(id);
        existing._matchCount++;
        if (item._query && !existing._queries.includes(item._query)) {
          existing._queries.push(item._query);
        }
      } else {
        item._queries = item._query ? [item._query] : [];
        mapa.set(id, item);
      }
    }
    return Array.from(mapa.values());
  }

  // ================================================================
  // SCORING
  // ================================================================
  function pontuar(item, data) {
    let score = 0;
    score += (item._matchCount || 1) * 12;

    const texto = (item.title + " " + item.highlight + " " + item.plainFacts).toLowerCase();
    const termos = data.termos_destaque || [];
    for (const t of termos) {
      try {
        const re = new RegExp(t.regex, "gi");
        const matches = texto.match(re);
        if (matches) score += (t.peso || 10) * Math.min(matches.length, 3);
      } catch (e) {}
    }

    if (data.filtro_bloco_regex_principal) {
      try { if (new RegExp(data.filtro_bloco_regex_principal, "gi").test(texto)) score += 30; } catch (e) {}
    }
    if (data.filtro_bloco_regex_contexto) {
      try { if (new RegExp(data.filtro_bloco_regex_contexto, "gi").test(texto)) score += 15; } catch (e) {}
    }
    if (data.filtro_bloco_regex_principal && data.filtro_bloco_regex_contexto) {
      try {
        const temP = new RegExp(data.filtro_bloco_regex_principal, "gi").test(texto);
        const temC = new RegExp(data.filtro_bloco_regex_contexto, "gi").test(texto);
        if (temP && temC) score += 20;
      } catch (e) {}
    }

    if (item.isMandatoryPrecedent) score += 25;
    if (item.thesisType) score += 15;

    item._outcome = classificarOutcome(texto);
    item._score = score;
    return item;
  }

  // ================================================================
  // CLASSIFICAR OUTCOME
  // ================================================================
  function classificarOutcome(texto) {
    const padroesFav = [
      /\b(deu|dar|dando)\s+provimento/i, /\bprocedente\b/i,
      /\bfavor[aá]vel\b/i, /\bconcedid[oa]\b/i,
      /\bprovid[oa]\b/i, /\breform(ou|ada|ado)\b/i,
    ];
    const padroesDesf = [
      /\b(negou|negar|negando)\s+provimento/i, /\bimprocedente\b/i,
      /\bdesfavor[aá]vel\b/i, /\bdenegad[oa]\b/i,
      /\bimprovid[oa]\b/i, /\bmantida\s+(a\s+)?senten[cç]a/i,
    ];
    const padroesParcial = [
      /parcial(mente)?\s+provid/i, /parcial(mente)?\s+procedente/i,
      /provimento\s+parcial/i,
    ];

    let fav = 0, desf = 0, parc = 0;
    for (const p of padroesParcial) if (p.test(texto)) parc++;
    for (const p of padroesFav) if (p.test(texto)) fav++;
    for (const p of padroesDesf) if (p.test(texto)) desf++;

    if (parc > 0) return "parcial";
    if (fav > desf && fav > 0) return "favoravel";
    if (desf > fav && desf > 0) return "desfavoravel";
    return "neutro";
  }

  // ================================================================
  // RENDERIZAR
  // ================================================================
  function renderizarResultados() {
    const container = document.getElementById("jbia-results");
    container.innerHTML = "";

    let resultados = state.resultados;
    if (state.filtroOutcome !== "todos") {
      resultados = resultados.filter((r) => r._outcome === state.filtroOutcome);
    }

    if (resultados.length === 0) {
      container.innerHTML = '<div class="jbia-empty"><div class="jbia-empty-icon">&#128269;</div>' +
        '<div>Nenhum resultado encontrado' + (state.filtroOutcome !== "todos" ? " com este filtro" : "") + '.</div></div>';
      return;
    }

    resultados.forEach((item, idx) => {
      const div = document.createElement("div");
      div.className = "jbia-result";

      const scoreClass = item._score >= 80 ? "high" : item._score >= 40 ? "medium" : "low";
      const dateStr = item.date ? formatarData(item.date) : "";
      const courtLabel = item.court || "";
      const typeLabel = item.type === "ACORDAO" ? "Acordao" : item.type || "";
      const outcomeBadge = criarBadgeOutcome(item._outcome);
      const mandatoryBadge = item.isMandatoryPrecedent
        ? '<span class="jbia-badge jbia-badge-mandatory">Vinculante</span>' : "";
      const thesisBadge = item.thesisType
        ? '<span class="jbia-badge jbia-badge-mandatory">' + escapeHtml(item.thesisType) + '</span>' : "";
      const ementaTexto = item.highlight || item.plainFacts || item.title || "";
      const linkUrl = item.url
        ? (item.url.startsWith("http") ? item.url : "https://www.jusbrasil.com.br" + item.url)
        : "#";

      div.innerHTML = '<div class="jbia-result-header">' +
        '<div class="jbia-result-meta">' +
        '<span class="jbia-badge jbia-badge-court">' + escapeHtml(courtLabel) + '</span>' +
        (dateStr ? '<span class="jbia-badge jbia-badge-date">' + dateStr + '</span>' : '') +
        (typeLabel ? '<span class="jbia-badge jbia-badge-type">' + escapeHtml(typeLabel) + '</span>' : '') +
        outcomeBadge + mandatoryBadge + thesisBadge +
        '</div>' +
        '<span class="jbia-result-score ' + scoreClass + '">' + item._score + '</span>' +
        '</div>' +
        '<div class="jbia-result-title" onclick="window.open(\'' + linkUrl.replace(/'/g, "\\'") + '\',\'_blank\')">' +
        escapeHtml(item.title || "Sem titulo") + '</div>' +
        '<div class="jbia-result-ementa" id="jbia-ementa-' + idx + '">' +
        highlightTexto(ementaTexto) + '</div>' +
        '<button class="jbia-expand-btn" onclick="var el=document.getElementById(\'jbia-ementa-' + idx + '\');' +
        'el.classList.toggle(\'expanded\');this.textContent=el.classList.contains(\'expanded\')?\'Ver menos\':\'Ver mais\'">Ver mais</button>' +
        '<div class="jbia-result-footer">' +
        '<a class="jbia-result-link" href="' + linkUrl + '" target="_blank">Abrir no JusBrasil</a>' +
        '<span class="jbia-result-matches">' + item._matchCount + (item._matchCount === 1 ? " query" : " queries") + '</span>' +
        '</div>';

      container.appendChild(div);
    });
  }

  function highlightTexto(texto) {
    let limpo = texto.replace(/<(?!\/?(?:b|strong)\b)[^>]+>/gi, "").trim();
    for (const t of state.termosDestaque) {
      try {
        const re = new RegExp("(" + t.regex + ")", "gi");
        limpo = limpo.replace(re, '<b style="color:' + (t.cor || "#22d3ee") + '">$1</b>');
      } catch (e) {}
    }
    return limpo;
  }

  function criarBadgeOutcome(outcome) {
    const map = {
      favoravel: { cls: "jbia-badge-favoravel", label: "Favoravel" },
      desfavoravel: { cls: "jbia-badge-desfavoravel", label: "Desfavoravel" },
      parcial: { cls: "jbia-badge-parcial", label: "Parcial" },
      neutro: { cls: "jbia-badge-neutro", label: "Neutro" },
    };
    const m = map[outcome] || map.neutro;
    return '<span class="jbia-badge ' + m.cls + '">' + m.label + '</span>';
  }

  // ================================================================
  // UI HELPERS
  // ================================================================
  function mostrarProgresso(atual, total, texto) {
    const el = document.getElementById("jbia-progress");
    el.style.display = "block";
    const pct = total > 0 ? Math.round((atual / total) * 100) : 0;
    document.getElementById("jbia-progress-fill").style.width = pct + "%";
    document.getElementById("jbia-progress-text").textContent = texto;
  }

  function esconderElemento(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  }

  function mostrarErro(msg) {
    const el = document.getElementById("jbia-error");
    el.style.display = "block";
    el.innerHTML = '<div class="jbia-error">' + escapeHtml(msg) + '</div>';
  }

  function mostrarExplicacao(texto) {
    const el = document.getElementById("jbia-explicacao");
    el.style.display = "block";
    el.innerHTML = '<div class="jbia-explicacao">' + escapeHtml(texto) + '</div>';
  }

  function mostrarStats(resultados) {
    const el = document.getElementById("jbia-stats");
    el.style.display = "flex";
    const fav = resultados.filter((r) => r._outcome === "favoravel").length;
    const desf = resultados.filter((r) => r._outcome === "desfavoravel").length;
    const parc = resultados.filter((r) => r._outcome === "parcial").length;
    const tribunais = new Set(resultados.map((r) => r.court).filter(Boolean));

    el.innerHTML =
      '<div class="jbia-stat"><b>' + resultados.length + '</b>&nbsp;resultados</div>' +
      '<div class="jbia-stat"><b>' + tribunais.size + '</b>&nbsp;tribunais</div>' +
      '<div class="jbia-stat"><b>' + state.queriesUsadas.length + '</b>&nbsp;queries</div>' +
      '<div class="jbia-stat" style="color:#22c55e"><b>' + fav + '</b>&nbsp;fav</div>' +
      '<div class="jbia-stat" style="color:#ef4444"><b>' + desf + '</b>&nbsp;desf</div>' +
      '<div class="jbia-stat" style="color:#eab308"><b>' + parc + '</b>&nbsp;parc</div>';
  }

  function mostrarFiltros() {
    const el = document.getElementById("jbia-filters");
    el.style.display = "flex";
    el.innerHTML = "";
    var filtros = [
      { id: "todos", label: "Todos" }, { id: "favoravel", label: "Favoravel" },
      { id: "desfavoravel", label: "Desfavoravel" }, { id: "parcial", label: "Parcial" },
      { id: "neutro", label: "Neutro" },
    ];
    filtros.forEach((f) => {
      const btn = document.createElement("button");
      btn.className = "jbia-filter-btn" + (f.id === state.filtroOutcome ? " active" : "");
      btn.textContent = f.label;
      btn.onclick = () => {
        state.filtroOutcome = f.id;
        el.querySelectorAll(".jbia-filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderizarResultados();
      };
      el.appendChild(btn);
    });
  }

  function formatarData(dateVal) {
    try {
      const d = typeof dateVal === "number" ? new Date(dateVal) : new Date(dateVal);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch (e) { return ""; }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ================================================================
  // EXPORTAR CSV
  // ================================================================
  function exportarCSV() {
    if (state.resultados.length === 0) return;
    const linhas = [["Score", "Tribunal", "Data", "Tipo", "Titulo", "Outcome", "Vinculante", "Tese", "URL", "Queries"].join(";")];
    const resultados = state.filtroOutcome !== "todos"
      ? state.resultados.filter((r) => r._outcome === state.filtroOutcome) : state.resultados;

    for (const r of resultados) {
      const url = r.url ? (r.url.startsWith("http") ? r.url : "https://www.jusbrasil.com.br" + r.url) : "";
      linhas.push([r._score, r.court, formatarData(r.date), r.type,
        '"' + (r.title || "").replace(/"/g, '""') + '"', r._outcome,
        r.isMandatoryPrecedent ? "Sim" : "Nao", r.thesisType || "", url,
        '"' + (r._queries || []).join(", ") + '"'].join(";"));
    }
    const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "jusbrasil-ia-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ================================================================
  // COPIAR LINKS
  // ================================================================
  function copiarLinks() {
    if (state.resultados.length === 0) return;
    const resultados = state.filtroOutcome !== "todos"
      ? state.resultados.filter((r) => r._outcome === state.filtroOutcome) : state.resultados;
    const links = resultados.map((r) => {
      const url = r.url ? (r.url.startsWith("http") ? r.url : "https://www.jusbrasil.com.br" + r.url) : "";
      return "[" + r._score + "] " + r.court + " - " + r.title + "\n" + url;
    }).join("\n\n");

    navigator.clipboard.writeText(links).then(
      () => {
        const btn = document.getElementById("jbia-copy-btn");
        btn.textContent = "Copiado!";
        setTimeout(() => (btn.textContent = "Copiar links"), 2000);
      },
      () => alert("Erro ao copiar. Tente novamente.")
    );
  }

  // ================================================================
  // INIT
  // ================================================================
  criarPanel();
  console.log("[JusBrasil IA] Overlay carregado com sucesso!");
})();
