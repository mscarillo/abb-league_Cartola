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

// ---------- Mata-mata: pontuação de um time num par de rodadas ----------
let _SCORE_INDEX = null;
function scoreName(teams, name) {
  if (!_SCORE_INDEX || _SCORE_INDEX._teams !== teams) {
    _SCORE_INDEX = { _teams: teams };
    teams.forEach(t => { _SCORE_INDEX[t.name] = t.scores; });
  }
  return _SCORE_INDEX[name] || null;
}

// soma das rodadas [a,b] para um time (por nome). Retorna {sum, played, parts}
function matchScore(teams, name, rounds) {
  const sc = scoreName(teams, name);
  const [a, b] = rounds;
  const parts = [];
  let sum = 0, played = 0;
  if (sc) {
    for (let r = a; r <= b; r++) {
      const v = sc[r - 1];
      parts.push(v);
      if (v !== null && v !== undefined) { sum += v; played++; }
    }
  }
  return { sum: Math.round(sum * 100) / 100, played, parts };
}

// uma fase já tem rodadas jogadas?
function phasePlayed(lastRound, rounds) {
  return lastRound >= rounds[0];
}

// ---------- Prêmios e meses ----------
const PRIZE_ROUND = 35.26;   // R$ por vencedor de rodada
const PRIZE_MONTH = 42.63;   // R$ por vencedor de mês

// Estrutura completa de premiação (regras ABB League 2026).
// Base: 67 inscrições × R$ 50 = R$ 3.350. Percentuais conforme o PDF de regras.
const PRIZE_ENTRY = 50;
function prizePlan(numTeams) {
  const total = (numTeams || 67) * PRIZE_ENTRY;
  const pct = p => Math.round(total * p) / 100;
  return {
    total,
    numTeams: numTeams || 67,
    // classificação final dos pontos corridos (1º ao 7º)
    league: [
      { pos: 1, label: 'Campeão', pctTxt: '10%', value: pct(10) },
      { pos: 2, label: 'Vice-Campeão', pctTxt: '4%', value: pct(4) },
      { pos: 3, label: '3º Colocado', pctTxt: '3%', value: pct(3) },
      { pos: 4, label: '4º Colocado', pctTxt: '2%', value: pct(2) },
      { pos: 5, label: '5º Colocado', pctTxt: '1%', value: pct(1) },
      { pos: 6, label: '6º Colocado', pctTxt: '0,5%', value: pct(0.5) },
      { pos: 7, label: '7º Colocado', pctTxt: '0,5%', value: pct(0.5) },
    ],
    special: [
      { key: 'rico', label: 'O Mais Rico', pctTxt: '1%', value: pct(1) },
      { key: 'maiorVencedor', label: 'Maior Vencedor de Rodadas e Meses', pctTxt: '1%', value: pct(1) },
      { key: 'maiorPontuacao', label: 'Maior Pontuação entre Vencedores de Rodada', pctTxt: '1%', value: pct(1) },
    ],
    recurring: [
      { key: 'mes', label: 'Vencedor de Cada Mês', pctTxt: '14% ÷ 11', value: PRIZE_MONTH, note: '11 meses' },
      { key: 'rodada', label: 'Vencedor de Cada Rodada', pctTxt: '40% ÷ 38', value: PRIZE_ROUND, note: '38 rodadas' },
    ],
    cups: [
      { key: 'libertadores', label: 'Campeão Libertadores', pctTxt: '5%', value: pct(5) },
      { key: 'sulamericana', label: 'Campeão Sul-Americana', pctTxt: '3%', value: pct(3) },
      { key: 'champions', label: 'Campeão Champions', pctTxt: '5%', value: pct(5) },
      { key: 'uefa', label: 'Campeão UEFA', pctTxt: '3%', value: pct(3) },
      { key: 'mundial', label: 'Campeão Mundial', pctTxt: '6%', value: pct(6) },
    ],
  };
}

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Mapa-base rodada -> mês (1=Jan ... 12=Dez), conforme o calendário CBF 2026.
// Usado como fallback quando o data.json ainda não traz as datas reais da API.
// Confere com o boletim manual (rodada 18 = Maio).
const ROUND_MONTH_FALLBACK = {
  1:1,  2:2, 3:2, 4:2, 5:3, 6:3, 7:3, 8:3, 9:3,
  10:4, 11:4, 12:4, 13:4,
  14:5, 15:5, 16:5, 17:5, 18:5,
  19:7, 20:7, 21:7, 22:7,           // retorno pós-Copa do Mundo
  23:8, 24:8, 25:8, 26:8,
  27:9, 28:9, 29:9, 30:9,
  31:10, 32:10, 33:10, 34:10,
  35:11, 36:11, 37:11, 38:12
};

// Resolve o mês de cada rodada: usa data real (data.round_months) se houver,
// senão o mapa-base. data.round_months = { "1": 1, "2": 2, ... } (mês 1-12).
function roundMonthMap(data) {
  const real = data && data.round_months;
  const map = {};
  for (let r = 1; r <= (data.total_rounds || 38); r++) {
    if (real && real[r] != null) map[r] = real[r];
    else if (real && real[String(r)] != null) map[r] = real[String(r)];
    else map[r] = ROUND_MONTH_FALLBACK[r] || null;
  }
  return map;
}

// Campeões do mês agrupando pelas rodadas reais de cada mês (não por blocos fixos).
// Retorna [{ month: 5, name:'Maio', rounds:[14,..,18], winner:{name,sum}, ranking:[...] }]
function monthlyWinnersByCalendar(data, teams, lastRound) {
  const mm = roundMonthMap(data);
  // agrupa rodadas jogadas por mês
  const byMonth = {};
  for (let r = 1; r <= lastRound; r++) {
    const m = mm[r];
    if (m == null) continue;
    (byMonth[m] = byMonth[m] || []).push(r);
  }
  const months = Object.keys(byMonth).map(Number).sort((a, b) => a - b);
  return months.map(m => {
    const rounds = byMonth[m];
    const ranking = teams.map(t => {
      let sum = 0, played = 0;
      rounds.forEach(r => {
        const v = t.scores[r - 1];
        if (v != null) { sum += v; played++; }
      });
      return { name: t.name, id: t.id, sum: Math.round(sum * 100) / 100, played };
    }).filter(x => x.played > 0).sort((a, b) => b.sum - a.sum);
    return {
      month: m, name: MONTH_NAMES[m - 1] || ('Mês ' + m),
      rounds, winner: ranking[0] || null, ranking: ranking.slice(0, 5)
    };
  });
}

// dado uma rodada, retorna o mês a que ela pertence (e nome)
function monthOfRound(data, r) {
  const mm = roundMonthMap(data);
  const m = mm[r];
  return { month: m, name: m ? (MONTH_NAMES[m - 1] || ('Mês ' + m)) : '—' };
}

// Resultados das copas até uma dada rodada: por fase, lista de confrontos decididos
// + classificados. Usado no boletim para "vencedores e classificados de cada etapa".
function cupDigest(cups, teams, lastRound) {
  if (!cups) return [];
  const order = [
    ['libertadores', 'ABB Libertadores'],
    ['sulamericana', 'ABB Sul-Americana'],
    ['champions', 'ABB Champions'],
    ['uefa', 'ABB UEFA'],
    ['mundial', 'ABB Mundial'],
  ];
  const phaseOrder = [
    ['grupos', 'Fase de Grupos'],
    ['oitavas', 'Oitavas de Final'],
    ['quartas', 'Quartas de Final'],
    ['semis', 'Semifinais'],
    ['finais', 'Final'],
  ];
  const out = [];
  for (const [key, label] of order) {
    const cup = cups[key];
    if (!cup) continue;
    const phases = [];
    // grupos: classificados (2 por grupo) se a fase já terminou
    if (cup.grupos && cup.grupos.length) {
      const [a, b] = cup.grupos[0].rounds;
      if (lastRound >= b) {
        const classif = [];
        cup.grupos.forEach(g => {
          const rk = g.teams.map(n => ({ name: n, ...matchScore(teams, n, g.rounds) }))
            .sort((x, y) => y.sum - x.sum);
          rk.slice(0, 2).forEach(t => classif.push({ name: t.name, sum: t.sum, group: g.group }));
        });
        phases.push({ phase: 'Fase de Grupos', status: 'Encerrada', classif });
      } else if (lastRound >= a) {
        phases.push({ phase: 'Fase de Grupos', status: 'Em andamento', classif: [] });
      }
    }
    // mata-mata
    for (const [pk, plabel] of phaseOrder) {
      if (pk === 'grupos') continue;
      if (!cup[pk] || !cup[pk].length) continue;
      const rounds = cup[pk][0].rounds;
      if (lastRound < rounds[0]) continue;
      const done = lastRound >= rounds[1];
      const winners = [];
      cup[pk].forEach(m => {
        if (!m.home && !m.away) return;
        const a = m.home ? matchScore(teams, m.home, m.rounds) : { sum: 0, played: 0 };
        const bb = m.away ? matchScore(teams, m.away, m.rounds) : { sum: 0, played: 0 };
        if (a.played > 0 && bb.played > 0) {
          const w = a.sum >= bb.sum ? m.home : m.away;
          const ws = a.sum >= bb.sum ? a.sum : bb.sum;
          winners.push({ tag: m.tag, name: w, sum: ws });
        }
      });
      phases.push({ phase: plabel, status: done ? 'Encerrada' : 'Em andamento', classif: winners });
    }
    if (phases.length) out.push({ cup: label, phases });
  }
  return out;
}

// Fases de copa ativas numa rodada específica (começando, em andamento ou terminando)
// — usado para destacar, no boletim da rodada, o que está acontecendo nas copas em
// paralelo aos pontos corridos.
function cupRoundSpotlight(cups, teams, r) {
  if (!cups) return [];
  const cupOrder = [
    ['libertadores', 'ABB Libertadores'],
    ['sulamericana', 'ABB Sul-Americana'],
    ['champions', 'ABB Champions'],
    ['uefa', 'ABB UEFA'],
    ['mundial', 'ABB Mundial'],
  ];
  const phaseOrder = [
    ['classif', 'Classificatória'],
    ['grupos', 'Fase de Grupos'],
    ['oitavas', 'Oitavas de Final'],
    ['quartas', 'Quartas de Final'],
    ['semis', 'Semifinais'],
    ['finais', 'Final'],
  ];
  const out = [];
  for (const [ckey, clabel] of cupOrder) {
    const cup = cups[ckey];
    if (!cup) continue;
    for (const [pk, plabel] of phaseOrder) {
      const entries = pk === 'classif' ? (cup.classif ? [cup.classif] : []) : (cup[pk] || []);
      if (!entries.length) continue;
      const rounds = entries[0].rounds;
      if (!rounds) continue;
      const [a, b] = rounds;
      if (r < a || r > b) continue; // fase não ativa nesta rodada
      const isFinal = pk === 'finais';
      const isStart = r === a;
      const isEnd = r === b;
      let result = null;
      if (isEnd) {
        if (pk === 'classif' || pk === 'grupos') {
          result = { type: 'classificacao' };
        } else {
          const winners = [];
          entries.forEach(m => {
            if (!m.home || !m.away) return;
            const ha = matchScore(teams, m.home, m.rounds), aw = matchScore(teams, m.away, m.rounds);
            if (ha.played > 0 && aw.played > 0) winners.push(ha.sum >= aw.sum ? m.home : m.away);
          });
          result = { type: 'matomata', winners };
        }
      }
      out.push({ cup: clabel, phase: plabel, isFinal, isStart, isEnd, rounds: [a, b], result });
    }
  }
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = { abbLeagueTable, roundWinners, monthlyWinners, monthlyWinnersByCalendar, monthOfRound, roundMonthMap, libertadoresClassif, championsClassif, buildBulletin, aggRanking, matchScore, scoreName, phasePlayed, cupDigest, cupRoundSpotlight, prizePlan, PRIZE_ROUND, PRIZE_MONTH, PRIZE_ENTRY, MONTH_NAMES, ROUND_MONTH_FALLBACK };
}
