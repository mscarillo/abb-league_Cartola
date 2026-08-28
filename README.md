# ABB LEAGUE 2026 — Central de Resultados

Site moderno que substitui sua planilha de controle do Cartola FC: classificação
dos pontos corridos, copas continentais (Libertadores, Sulamericana, Champions, UEFA),
premiações de rodada e de mês, e um **boletim esportivo automático** a cada rodada.

Tudo é recalculado no navegador a partir de um único arquivo `site/data.json`.
Para atualizar, basta regenerar esse arquivo — o pipeline da nuvem faz isso sozinho.

---

## Conteúdo do pacote

```
site/                 ← o site (publique esta pasta)
  index.html          ← página principal (visual)
  logic.js            ← motor de cálculo (classificações, copas, prêmios, boletim)
  data.json           ← dados atuais (até a rodada 18)
update_cartola.py     ← lê a API do Cartola e regenera site/data.json
teams.json            ← os 64 times da liga (id + nome), extraídos da sua planilha
.github/workflows/atualizar.yml  ← automação (atualiza + publica sozinho)
```

## Ver agora no seu computador

```bash
cd site
python3 -m http.server 8000
# abra http://localhost:8000
```
(Abrir o `index.html` por duplo-clique não funciona: o navegador bloqueia o
`fetch` de arquivos locais. Use o servidor acima — em hospedagem real funciona normal.)

---

## Publicar 100% automático (recomendado: GitHub Pages — grátis)

Escolhi GitHub Pages porque é gratuito, não exige servidor e já executa o
atualizador sozinho via GitHub Actions, sem precisar deixar seu PC ligado.

**Passo a passo:**

1. Crie um repositório no GitHub (ex.: `abb-league`).
2. Suba todo este conteúdo para o repositório (incluindo a pasta `.github`).
3. No GitHub: **Settings → Pages → Source: GitHub Actions**.
4. (Opcional, só para rodada **ao vivo**) **Settings → Secrets and variables →
   Actions → New repository secret**, nome `GLB_TOKEN`, valor = seu token GLBID
   do Cartola. Sem isso, o site atualiza normalmente com todas as rodadas já
   encerradas.
5. Vá em **Actions → "Atualizar ABB League" → Run workflow** para rodar a 1ª vez.

Pronto. A partir daí ele atualiza sozinho a cada 3 horas: lê a API do Cartola,
regrava o `data.json`, faz commit e republica o site.

### Como pegar o `GLB_TOKEN` (opcional)
Logado no Cartola pelo navegador (F12 → Application → Cookies → `GLBID`).
Use só se quiser que o placar apareça **durante** a rodada, antes do mercado fechar.

---

## Alternativa: Vercel / Netlify
Funciona também: aponte a pasta `site/` como diretório público. Porém a
automação de leitura da API precisaria de um cron externo (ex.: GitHub Actions
deste pacote continua sendo o jeito mais simples de gerar o `data.json`).

---

## Atualizar manualmente (sem nuvem)
```bash
python3 update_cartola.py     # regenera site/data.json lendo a API
```
Depois publique a pasta `site/` onde preferir.

---

## Regras implementadas (conforme a aba "1-Regras")
- **ABB League:** pontos corridos, soma das 38 rodadas.
- **Libertadores:** classificatória rod. 1–5 (top 24 diretos; 25º–40º fase Tolima;
  41º–48º vão para a Sulamericana; 49º–51º eliminados).
- **Champions:** classificatória rod. 20–24 (top 32 grupos; 33º–48º vão direto para as
  oitavas da UEFA; 49º em diante eliminado).
- **Vencedor de rodada:** maior pontuação de cada rodada.
- **Vencedor do mês:** maior soma em blocos de 4 rodadas (ajustável em `logic.js`,
  parâmetro `blockSize`).

As fases de mata-mata (oitavas → finais e o Mundial) usam somatório de pares de
rodadas e podem ser ligadas conforme as rodadas forem sendo jogadas — a base de
cálculo já está pronta em `logic.js`.
```
