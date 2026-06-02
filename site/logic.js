/* ABB LEAGUE 2026 — motor de cálculo
   Lê data.json (times + pontuações por rodada) e deriva:
   - Classificação ABB League (pontos corridos, 38 rodadas)
   - Libertadores / Sulamericana (1º turno) e Champions / UEFA (2º turno)
   - Vencedores de rodada e vencedores do "mês" (blocos de rodadas)
   - Boletim esportivo da rodada
   Regras conforme a aba "1-Regras" da planilha original.
*/

// soma de um intervalo de rodadas [a..b] (1-indexed, inclusive) só com rodadas já jogadas
function sumRange(scores, a, b) {
  let s = 0, played = 0;
  for (let r = a; r <= b; r++) {
    const v = scores[r - 1];
    if (v !== null && v !== undefined) { s += v; played++; }
  }
  return { sum: Math.round(s * 100) / 100, played };
}

function totalPlayed(scores, lastRound) {
  return sumRange(scores, 1, lastRound);
}

// ---------- ABB LEAGUE (pontos corridos) ----------
function abbLeagueTable(teams, lastRound) {
  const rows = teams.map(t => {
    const { sum, played } = totalPlayed(t.scores, lastRound);
    const vals = t.scores.slice(0, lastRound).filter(v => v !== null);
    const media = vals.length ? sum / vals.length : 0;
    const best = vals.length ? Math.max(...vals) : 0;
    return { id: t.id, name: t.name, total: sum, played, media: Math.round(media * 100) / 100, best };
  });
  rows.sort((a, b) => b.total - a.total);
  rows.forEach((r, i) => r.pos = i + 1);
  return rows;
}

// ---------- Vencedores por rodada ----------
function roundWinners(teams, lastRound) {
  const out = [];
  for (let r = 1; r <= lastRound; r++) {
    let best = null;
    for (const t of teams) {
      const v = t.scores[r - 1];
      if (v === null || v === undefined) continue;
      if (!best || v > best.score) best = { name: t.name, id: t.id, score: v };
    }
    if (best) out.push({ round: r, ...best });
  }
  return out;
}

// ---------- "Mês" = bloco de rodadas (4 por mês, configurável) ----------
function monthlyWinners(teams, lastRound, blockSize = 4) {
  const blocks = [];
  for (let start = 1; start <= lastRound; start += blockSize) {
    const end = Math.min(start + blockSize - 1, lastRound);
    let best = null;
    const ranking = teams.map(t => {
      const { sum, played } = sumRange(t.scores, start, end);
      return { name: t.name, id: t.id, sum, played };
    }).filter(x => x.played > 0).sort((a, b) => b.sum - a.sum);
    if (ranking.length) best = ranking[0];
    blocks.push({ index: blocks.length + 1, start, end, winner: best, ranking: ranking.slice(0, 5) });
  }
  return blocks;
}

// ---------- Classificatórias por somatório de rodadas ----------
function aggRanking(teams, a, b) {
  return teams.map(t => {
    const { sum, played } = sumRange(t.scores, a, b);
    return { id: t.id, name: t.name, sum, played };
  }).sort((x, y) => y.sum - x.sum)
    .map((r, i) => ({ ...r, pos: i + 1 }));
}

// Libertadores fase classificatória: rodadas 1-5. 24 melhores -> grupos direto;
// 25-40 -> fase Tolima (rod 6-7); 41-48 -> Sulamericana; 49-51 -> eliminados.
function libertadoresClassif(teams, lastRound) {
  const rank = aggRanking(teams, 1, 5);
  const done = lastRound >= 5;
  return {
    done, rank,
    classificadosDireto: rank.slice(0, 24),
    tolima: rank.slice(24, 40),
    sulamericana: rank.slice(40, 48),
    eliminados: rank.slice(48, 51),
  };
}

// Champions fase classificatória: rodadas 20-24. 32 melhores -> grupos; 33-49 -> UEFA.
function championsClassif(teams, lastRound) {
  const rank = aggRanking(teams, 20, 24);
  const done = lastRound >= 24;
  return {
    done, rank,
    grupos: rank.slice(0, 32),
    uefa: rank.slice(32, 49),
  };
}

// ---------- Boletim da rodada ----------
function buildBulletin(teams, lastRound, prevTable, blockSize = 4) {
  const r = lastRound;
  const table = abbLeagueTable(teams, r);
  const tablePrev = abbLeagueTable(teams, r - 1);
  const prevPos = {};
  tablePrev.forEach(row => prevPos[row.name] = row.pos);

  // pontuações da rodada
  const scoresThis = teams.map(t => ({ name: t.name, id: t.id, v: t.scores[r - 1] }))
    .filter(x => x.v !== null && x.v !== undefined)
    .sort((a, b) => b.v - a.v);

  const winner = scoresThis[0];
  const worst = scoresThis[scoresThis.length - 1];
  const avg = scoresThis.reduce((s, x) => s + x.v, 0) / (scoresThis.length || 1);

  // maiores subidas/quedas na tabela geral
  const movers = table.map(row => ({
    name: row.name, pos: row.pos,
    delta: (prevPos[row.name] || row.pos) - row.pos
  }));
  const climbers = [...movers].filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
  const fallers = [...movers].filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3);

  // fechou um "mês"?
  let monthClosed = null;
  if (r % blockSize === 0) {
    const blocks = monthlyWinners(teams, r, blockSize);
    monthClosed = blocks[blocks.length - 1];
  }

  return {
    round: r,
    leader: table[0],
    winner,
    worst,
    avg: Math.round(avg * 100) / 100,
    top5: scoresThis.slice(0, 5),
    climbers, fallers,
    monthClosed,
  };
}

if (typeof module !== 'undefined') {
  module.exports = { abbLeagueTable, roundWinners, monthlyWinners, libertadoresClassif, championsClassif, buildBulletin, aggRanking };
}
