#!/usr/bin/env python3
"""
ABB LEAGUE 2026 — atualizador automático.

Lê a API pública do Cartola FC para cada time da liga, captura a pontuação
da rodada corrente (e histórico) e regenera o data.json que o site consome.

A liga é definida em teams.json (id + nome de cada time), extraído da planilha.

Como funciona a API do Cartola (endpoints públicos usados pela sua planilha):
  - https://api.cartolafc.globo.com/mercado/status   -> rodada_atual, status_mercado
  - https://api.cartolafc.globo.com/time/id/{ID}/{RODADA} -> pontuação do time naquela rodada
  - https://api.cartolafc.globo.com/atletas/pontuados -> parciais ao vivo (rodada em andamento)

IMPORTANTE sobre autenticação:
  O endpoint /time/id/{id}/{rodada} de rodadas ENCERRADAS é público.
  Para ler a rodada AINDA EM ANDAMENTO de outro usuário, o Cartola pede o
  cabeçalho X-GLB-Token (token GLBID de uma conta logada). Coloque-o na
  variável de ambiente GLB_TOKEN (no GitHub: Settings > Secrets). Sem token,
  o script ainda consolida todas as rodadas já fechadas.
"""

import os, json, time, sys
from datetime import datetime, timezone
import urllib.request, urllib.error

API = "https://api.cartolafc.globo.com"
HERE = os.path.dirname(os.path.abspath(__file__))
TEAMS_FILE = os.path.join(HERE, "teams.json")
OUT_FILE = os.path.join(HERE, "site", "data.json")
TOTAL_ROUNDS = 38
GLB_TOKEN = os.environ.get("GLB_TOKEN", "").strip()


def http_get(url, retries=3):
    headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
    if GLB_TOKEN:
        headers["X-GLB-Token"] = GLB_TOKEN
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (404, 401):
                return None
            time.sleep(1.5 * (attempt + 1))
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    return None


def market_status():
    d = http_get(f"{API}/mercado/status")
    if not d:
        return None, None
    return d.get("rodada_atual"), d.get("status_mercado")


def team_round_score(team_id, rnd):
    """Pontuação de um time numa rodada específica (rodadas fechadas são públicas)."""
    d = http_get(f"{API}/time/id/{team_id}/{rnd}")
    if not d:
        return None
    pts = d.get("pontos")
    if pts is None and isinstance(d.get("time"), dict):
        pts = d["time"].get("pontos")
    try:
        return round(float(pts), 2) if pts is not None else None
    except (TypeError, ValueError):
        return None


def main():
    if not os.path.exists(TEAMS_FILE):
        print("ERRO: teams.json não encontrado.", file=sys.stderr)
        sys.exit(1)
    teams_meta = json.load(open(TEAMS_FILE, encoding="utf-8"))

    rodada_atual, status = market_status()
    if not rodada_atual:
        # fallback: tenta preservar o data.json existente
        rodada_atual = TOTAL_ROUNDS
    # rodada em andamento ainda não fechou: consolidamos até a anterior,
    # mas tentamos a corrente também (vem null se não disponível).
    last_to_fetch = min(int(rodada_atual), TOTAL_ROUNDS)

    teams_out = []
    for t in teams_meta:
        scores = [None] * TOTAL_ROUNDS
        for rnd in range(1, last_to_fetch + 1):
            s = team_round_score(t["id"], rnd)
            scores[rnd - 1] = s
            time.sleep(0.05)  # gentileza com a API
        teams_out.append({"id": t["id"], "name": t["name"], "scores": scores})
        print(f"  ok: {t['name']}")

    # última rodada com qualquer dado
    last_round = 0
    for rnd in range(TOTAL_ROUNDS):
        if any(tm["scores"][rnd] is not None for tm in teams_out):
            last_round = rnd + 1

    out = {
        "season": 2026,
        "league": "ABB LEAGUE 2026",
        "total_rounds": TOTAL_ROUNDS,
        "last_round": last_round,
        "market_status": status,
        "updated": datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC"),
        "teams": teams_out,
    }
    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    json.dump(out, open(OUT_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\ndata.json gerado · {len(teams_out)} times · rodada {last_round}")


if __name__ == "__main__":
    main()
