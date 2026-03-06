#!/usr/bin/env python3
"""
JusBrasil Busca Inteligente — Servidor Local
Porta 8767 | CORS habilitado para bookmarklet
"""

import http.server
import json
import os
import ssl
import urllib.request
import webbrowser

# ============================================================
# CONFIG
# ============================================================
PORT = 8767
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

# SSL context para chamadas externas (Claude API)
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()
    SSL_CTX.check_hostname = False
    SSL_CTX.verify_mode = ssl.CERT_NONE

CLAUDE_MODEL = "claude-haiku-4-5-20251001"

# ============================================================
# HELPERS
# ============================================================
def carregar_config() -> dict:
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return {}


def salvar_config(cfg: dict) -> None:
    with open(CONFIG_FILE, "w") as f:
        json.dump(cfg, f, indent=2)


def carregar_api_key() -> str:
    # 1. Env var
    env_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if env_key:
        return env_key
    # 2. Config local
    cfg = carregar_config()
    key = cfg.get("anthropic_api_key", "")
    if key:
        return key
    # 3. Fallback: tentar config do TRF5 ou CARF
    for fallback in ["trf5-busca", "carf-busca"]:
        path = os.path.join(os.path.dirname(STATIC_DIR), fallback, "config.json")
        if os.path.exists(path):
            with open(path) as f:
                fk = json.load(f).get("anthropic_api_key", "")
                if fk:
                    return fk
    return ""


# ============================================================
# CLAUDE AI — Gerar termos de busca
# ============================================================
def chamar_claude(api_key: str, descricao_caso: str) -> dict:
    prompt = f"""Voce e um especialista em direito brasileiro e pesquisa juridica.
O usuario precisa encontrar jurisprudencia relevante no JusBrasil (todos os tribunais do Brasil).

O usuario descreveu o caso: "{descricao_caso}"

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

Retorne APENAS um JSON valido (sem markdown, sem ```), com esta estrutura:
{{
  "queries": ["query1", "query2", ...],
  "termos_destaque": [
    {{"regex": "padrao regex JS valido", "label": "Nome curto", "cor": "#HEX", "peso": 15}},
    ...
  ],
  "filtro_bloco_regex_principal": "regex JS para identificar o tema principal no texto",
  "filtro_bloco_regex_contexto": "regex JS para contexto juridico complementar",
  "explicacao": "Breve explicacao da estrategia de busca em 1-2 frases"
}}

Os termos_destaque devem ter 4-6 itens com cores distintas:
- Tema principal: #FF6B6B (vermelho), peso 15-20
- Contexto juridico: #4ECDC4 (teal), peso 10-15
- Termos processuais: #45B7D1 (azul), peso 8-12
- Legislacao: #96CEB4 (verde), peso 10-15
- Resultado/decisao: #FFEAA7 (amarelo), peso 5-8
"""

    body = json.dumps({
        "model": CLAUDE_MODEL,
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}]
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )

    with urllib.request.urlopen(req, context=SSL_CTX, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    text = data["content"][0]["text"].strip()
    # Limpar possivel markdown
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    return json.loads(text)


# ============================================================
# HTTP HANDLER
# ============================================================
class Handler(http.server.BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {fmt % args}")

    def send_cors_headers(self):
        """CORS headers para permitir chamadas do bookmarklet no JusBrasil."""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def send_json(self, data: dict, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def serve_file(self, filename: str, content_type: str) -> None:
        path = os.path.join(STATIC_DIR, filename)
        if not os.path.exists(path):
            self.send_error(404)
            return
        with open(path, "rb") as f:
            content = f.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_cors_headers()
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(content)

    # ---- OPTIONS (preflight CORS) ----
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    # ---- GET ----
    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/" or path == "/index.html":
            self.serve_file("index.html", "text/html; charset=utf-8")

        elif path == "/overlay.js":
            self.serve_file("overlay.js", "application/javascript; charset=utf-8")

        elif path == "/api/status":
            key = carregar_api_key()
            self.send_json({
                "has_api_key": bool(key),
                "api_key_preview": f"{key[:10]}...{key[-4:]}" if len(key) > 14 else "",
            })

        else:
            self.send_error(404)

    # ---- POST ----
    def do_POST(self):
        path = self.path.split("?")[0]
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {}

        if path == "/api/salvar-key":
            key = payload.get("api_key", "").strip()
            if not key or not key.startswith("sk-"):
                self.send_json({"error": "API key invalida"}, 400)
                return
            cfg = carregar_config()
            cfg["anthropic_api_key"] = key
            salvar_config(cfg)
            self.send_json({"status": "ok", "message": "API key salva com sucesso"})

        elif path == "/api/gerar-termos":
            descricao = payload.get("descricao", "").strip()
            if not descricao:
                self.send_json({"error": "Descricao vazia"}, 400)
                return
            api_key = carregar_api_key()
            if not api_key:
                self.send_json({"error": "API key nao configurada"}, 400)
                return
            try:
                data = chamar_claude(api_key, descricao)
                self.send_json({"status": "ok", "data": data})
            except Exception as e:
                self.send_json({"error": f"Erro ao chamar Claude: {e}"}, 500)

        else:
            self.send_error(404)


# ============================================================
# MAIN
# ============================================================
PORT_HTTPS = 8768
CERT_FILE = os.path.join(STATIC_DIR, "server.crt")
KEY_FILE = os.path.join(STATIC_DIR, "server.key")

if __name__ == "__main__":
    import threading

    # HTTP server (para setup page)
    server_http = http.server.HTTPServer(("127.0.0.1", PORT), Handler)

    # HTTPS server (para bookmarklet no JusBrasil HTTPS)
    server_https = None
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        server_https = http.server.HTTPServer(("127.0.0.1", PORT_HTTPS), Handler)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(CERT_FILE, KEY_FILE)
        server_https.socket = ctx.wrap_socket(server_https.socket, server_side=True)

    print(f"\n  JusBrasil Busca Inteligente")
    print(f"  HTTP:  http://localhost:{PORT}")
    if server_https:
        print(f"  HTTPS: https://localhost:{PORT_HTTPS}")
    print(f"  Ctrl+C para parar\n")

    try:
        webbrowser.open(f"http://localhost:{PORT}")
    except Exception:
        pass

    # Rodar HTTPS em thread separada
    if server_https:
        t = threading.Thread(target=server_https.serve_forever, daemon=True)
        t.start()

    try:
        server_http.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
        server_http.server_close()
        if server_https:
            server_https.server_close()
