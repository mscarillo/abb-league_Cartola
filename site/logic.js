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

// Champions fase classificatória: rodadas 20-24. 32 melhores -> grupos; 33-48 -> UEFA
// direto nas oitavas (49º em diante, eliminado). Alinhado ao critério já usado na
// coluna "Destino" do index.html (pos<=32 Grupos, pos<=48 UEFA, senão Eliminado).
function championsClassif(teams, lastRound) {
  const rank = aggRanking(teams, 20, 24);
  const done = lastRound >= 24;
  return {
    done, rank,
    grupos: rank.slice(0, 32),
    uefa: rank.slice(32, 48),
  };
}

// Champions: define as Oitavas de Final automaticamente a partir dos 2 classificados de
// cada grupo (regra da liga, definida em 28/08/2026 — não é mais sorteio manual como foi
// na Libertadores): pega os 16 classificados (1º e 2º de cada um dos 8 grupos), rankeia
// todos juntos pela pontuação da fase de grupos e casa 1ºx16º, 2ºx15º, 3ºx14º ... 8ºx9º
// (mata-mata espelhado, mesmo padrão usado na Tolima e nas Oitavas da UEFA).
function seedOitavasFromGrupos(teams, grupos, oitavasRounds) {
  if (!grupos || !grupos.length) return [];
  const qualified = [];
  grupos.forEach(g => {
    const ranked = g.teams
      .map(n => ({ name: n, ...matchScore(teams, n, g.rounds) }))
      .sort((x, y) => y.sum - x.sum);
    ranked.slice(0, 2).forEach(t => qualified.push({ name: t.name, sum: t.sum }));
  });
  qualified.sort((x, y) => y.sum - x.sum);
  const n = qualified.length; // 16 (8 grupos x 2 classificados)
  const out = [];
  for (let i = 0; i < n / 2; i++) {
    out.push({
      tag: 'O' + (i + 1),
      home: qualified[i].name,        // melhor colocado do par
      away: qualified[n - 1 - i].name, // pior colocado do par
      rounds: oitavasRounds,
    });
  }
  return out;
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
// ---------- Visão geral das copas (usado no Boletim da Rodada) ----------
// Nomes/ordem/pluralização de cada fase, usados tanto no resumo detalhado quanto na
// frase corrida do boletim.
const CUP_ORDER = [
  ['libertadores', 'ABB Libertadores'],
  ['sulamericana', 'ABB Sul-Americana'],
  ['champions', 'ABB Champions'],
  ['uefa', 'ABB UEFA'],
  ['mundial', 'ABB Mundial'],
];
const CUP_EMOJI = { libertadores: '🌎', sulamericana: '🥈', champions: '⭐', uefa: '🇪🇺', mundial: '🌍' };
const PHASE_ORDER = ['classif', 'grupos', 'oitavas', 'quartas', 'semis', 'finais'];
const PHASE_LABEL = { classif: 'Classificatória', grupos: 'Fase de Grupos', oitavas: 'Oitavas de Final', quartas: 'Quartas de Final', semis: 'Semifinais', finais: 'Final' };
const PHASE_LABEL_LOWER = { classif: 'a classificatória', grupos: 'a fase de grupos', oitavas: 'as oitavas de final', quartas: 'as quartas de final', semis: 'as semifinais', finais: 'a final' };
const PHASE_PLURAL = { classif: false, grupos: false, oitavas: true, quartas: true, semis: true, finais: false };

function fmtNum(n) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function phaseEntries(cup, pk) {
  if (pk === 'classif') return (cup.classif && cup.classif.rounds) ? [cup.classif] : [];
  return cup[pk] || [];
}
// "definida" = já sabemos os times (grupos sorteados, ou confronto de mata-mata com
// home/away preenchidos), mesmo que a fase ainda não tenha sido disputada.
function phaseIsDefined(pk, entries) {
  if (!entries.length) return false;
  if (pk === 'classif' || pk === 'grupos') return true;
  return entries.some(m => m.home || m.away);
}
function firstDefinedPhase(cup) {
  for (const pk of PHASE_ORDER) {
    const entries = phaseEntries(cup, pk);
    if (entries.length) return { pk, entries };
  }
  return null;
}
function phaseAfter(cup, pk0) {
  const idx = PHASE_ORDER.indexOf(pk0);
  for (let i = idx + 1; i < PHASE_ORDER.length; i++) {
    const entries = phaseEntries(cup, PHASE_ORDER[i]);
    if (entries.length) return { pk: PHASE_ORDER[i], entries };
  }
  return null;
}
function koWinnerOf(teams, m) {
  if (!m.home || !m.away) return null;
  const h = matchScore(teams, m.home, m.rounds), a = matchScore(teams, m.away, m.rounds);
  if (h.played === 0 || a.played === 0) return null;
  return h.sum >= a.sum ? m.home : m.away;
}
function describePhase(pk, entries) {
  const rounds = entries[0].rounds;
  const plural = PHASE_PLURAL[pk];
  if (phaseIsDefined(pk, entries)) {
    return `${PHASE_LABEL[pk]} já ${plural ? 'definidas' : 'definida'}${rounds ? ` (rod. ${rounds[0]}–${rounds[1]})` : ''}`;
  }
  return `${PHASE_LABEL[pk]} a partir da rodada ${rounds[0]}`;
}
// Encontra a fase mais avançada de uma copa que já começou (lastRound >= rounds[0]) e,
// junto, a próxima fase já conhecida — base de tudo que é mostrado no boletim sobre copas.
function cupPhaseSnapshot(cup, lastRound) {
  let current = null;
  for (let i = PHASE_ORDER.length - 1; i >= 0; i--) {
    const pk = PHASE_ORDER[i];
    const entries = phaseEntries(cup, pk);
    if (!entries.length) continue;
    const rounds = entries[0].rounds;
    if (!rounds || lastRound < rounds[0]) continue;
    current = { pk, entries, rounds, done: lastRound >= rounds[1] };
    break;
  }
  const next = current ? phaseAfter(cup, current.pk) : firstDefinedPhase(cup);
  return { current, next };
}

// Uma linha detalhada por copa (usado em "Também nas Copas"): sempre mostra as 5 copas,
// com o status mais específico possível — inclusive fases já definidas mas ainda não
// iniciadas (ex.: "Fase de Grupos já definida", "Oitavas de Final já definidas").
function cupOverviewLines(cups, teams, lastRound) {
  if (!cups) return [];
  const out = [];
  CUP_ORDER.forEach(([key, label]) => {
    const cup = cups[key];
    if (!cup) return;
    const emoji = CUP_EMOJI[key] || '🏆';
    const { current, next } = cupPhaseSnapshot(cup, lastRound);
    let text, kind = 'normal';
    if (!current) {
      kind = 'dim';
      if (!next) {
        text = `ainda sem confrontos definidos.`;
      } else if (phaseIsDefined(next.pk, next.entries)) {
        text = `${describePhase(next.pk, next.entries)}, aguardando início.`;
      } else {
        text = `ainda não começou — ${describePhase(next.pk, next.entries)}.`;
      }
    } else if (current.pk === 'finais' && current.done) {
      const champ = koWinnerOf(teams, current.entries[0]);
      kind = 'champion';
      text = champ ? `🏆 <b>campeã definida: ${champ}</b>!` : `final encerrada, apurando o resultado.`;
    } else if (current.pk === 'finais') {
      const f = current.entries[0];
      text = `disputando a <b>Final</b> (rod. ${current.rounds[0]}–${current.rounds[1]})${f.home && f.away ? `: ${f.home} x ${f.away}` : ''}.`;
    } else if (current.done) {
      const lbl = PHASE_LABEL[current.pk] + (PHASE_PLURAL[current.pk] ? ' encerradas' : ' encerrada');
      text = next ? `${lbl} — ${describePhase(next.pk, next.entries)}.` : `${lbl}.`;
      if (current.rounds[1] === lastRound) text += ' ✅ (fechou nesta rodada)';
    } else {
      text = `${PHASE_LABEL[current.pk]} em andamento (rod. ${current.rounds[0]}–${current.rounds[1]}).`;
      if (current.rounds[0] === lastRound) text += ' 🔔 (começa nesta rodada)';
    }
    out.push({ key, cup: label, kind, html: `${emoji} <b>${label}</b>: ${text}` });
  });
  return out;
}

// Frase corrida (uma linha só, mencionando as 5 copas) para entrar no texto narrativo do
// boletim (composeStory), ao lado do resumo do desempenho da rodada.
function cupsStoryLine(cups, teams, lastRound) {
  if (!cups) return '';
  const clauses = CUP_ORDER.map(([key, label]) => {
    const cup = cups[key];
    if (!cup) return null;
    const { current } = cupPhaseSnapshot(cup, lastRound);
    if (!current) return `${label} ainda não começou`;
    if (current.pk === 'finais' && current.done) {
      const champ = koWinnerOf(teams, current.entries[0]);
      return champ ? `${label} já tem campeã definida: <b>${champ}</b>` : `${label} decidiu o título nesta rodada`;
    }
    const lbl = PHASE_LABEL_LOWER[current.pk];
    return current.done ? `${label} encerrou ${lbl}` : `${label} disputa ${lbl} (rod. ${current.rounds[0]}–${current.rounds[1]})`;
  }).filter(Boolean);
  if (!clauses.length) return '';
  const last = clauses.pop();
  return `Nas copas continentais, ${clauses.join('; ')}; e ${last}.`;
}

// Resumo "Resultados das Copas até a rodada N": inclui TODAS as copas com algo a mostrar,
// desde a classificatória (Libertadores/Champions) até a final — inclusive fases já
// sorteadas/definidas mas ainda não disputadas (ex.: grupos da Champions, oitavas da UEFA).
function cupDigest(cups, teams, lastRound) {
  if (!cups) return [];
  const out = [];
  CUP_ORDER.forEach(([key, label]) => {
    const cup = cups[key];
    if (!cup) return;
    const phases = [];

    // Classificatória (Libertadores e Champions)
    if (cup.classif && cup.classif.rounds) {
      const [a, b] = cup.classif.rounds;
      if (lastRound >= b) {
        const rank = aggRanking(teams, a, b).filter(x => x.played > 0);
        phases.push({ phase: 'Classificatória', status: 'Encerrada', items: classifDestinySummary(key, rank) });
      } else if (lastRound >= a) {
        phases.push({ phase: 'Classificatória', status: 'Em andamento', items: [] });
      }
    }

    // Fase de grupos
    if (cup.grupos && cup.grupos.length) {
      const [a, b] = cup.grupos[0].rounds;
      if (lastRound >= b) {
        const items = cup.grupos.map(g => {
          const rk = g.teams.map(n => ({ name: n, ...matchScore(teams, n, g.rounds) })).sort((x, y) => y.sum - x.sum);
          const top2 = rk.slice(0, 2).map(t => `${t.name} (${fmtNum(t.sum)})`).join(', ');
          return `${g.group}: ${top2}`;
        });
        phases.push({ phase: 'Fase de Grupos', status: 'Encerrada', items });
      } else if (lastRound >= a) {
        phases.push({ phase: 'Fase de Grupos', status: 'Em andamento', items: [] });
      } else {
        const items = cup.grupos.map(g => `${g.group}: ${g.teams.join(', ')}`);
        phases.push({ phase: 'Fase de Grupos', status: 'Sorteada', items });
      }
    }

    // Mata-mata: oitavas, quartas, semis, final
    ['oitavas', 'quartas', 'semis', 'finais'].forEach(pk => {
      const entries = cup[pk];
      if (!entries || !entries.length) return;
      if (!phaseIsDefined(pk, entries)) return; // confrontos ainda não conhecidos
      const rounds = entries[0].rounds;
      const started = lastRound >= rounds[0];
      const done = started && lastRound >= rounds[1];
      let status, items;
      if (!started) {
        status = 'Definida';
        items = entries.map(m => `${m.tag}: ${m.home || '?'} x ${m.away || '?'}`);
      } else {
        status = done ? 'Encerrada' : 'Em andamento';
        items = entries.map(m => {
          if (!m.home || !m.away) return `${m.tag}: ${m.home || m.away || '—'}`;
          const h = matchScore(teams, m.home, m.rounds), aw = matchScore(teams, m.away, m.rounds);
          if (h.played === 0 && aw.played === 0) return `${m.tag}: ${m.home} x ${m.away}`;
          if (!done) return `${m.tag}: ${m.home} (${fmtNum(h.sum)}) x ${m.away} (${fmtNum(aw.sum)})`;
          const w = h.sum >= aw.sum ? m.home : m.away;
          const ws = h.sum >= aw.sum ? h.sum : aw.sum;
          return `${m.tag}: ${w} venceu (${fmtNum(ws)} pts)`;
        });
      }
      phases.push({ phase: PHASE_LABEL[pk], status, items });
    });

    if (phases.length) out.push({ cup: label, phases });
  });
  return out;
}

// "Quem foi pra onde" na classificatória, usando os mesmos cortes já aplicados na coluna
// "Destino" da tabela de classificatória (ver index.html).
function classifDestinySummary(key, rank) {
  if (key === 'libertadores') {
    const grupos = rank.filter(r => r.pos <= 24).length;
    const tolima = rank.filter(r => r.pos > 24 && r.pos <= 40).length;
    const sul = rank.filter(r => r.pos > 40 && r.pos <= 48).length;
    const elim = rank.filter(r => r.pos > 48).length;
    return [
      `${grupos} classificados direto para os Grupos`,
      `${tolima} na Fase Tolima (repescagem)`,
      `${sul} classificados direto para a Sul-Americana`,
      elim ? `${elim} eliminados` : null,
    ].filter(Boolean);
  }
  if (key === 'champions') {
    const grupos = rank.filter(r => r.pos <= 32).length;
    const uefa = rank.filter(r => r.pos > 32 && r.pos <= 48).length;
    const elim = rank.filter(r => r.pos > 48).length;
    return [
      `${grupos} classificados para a Fase de Grupos`,
      `${uefa} classificados direto para as Oitavas da UEFA`,
      elim ? `${elim} eliminados` : null,
    ].filter(Boolean);
  }
  return [];
}

// Fases de copa ativas numa rodada específica (começando, em andamento ou terminando) —
// mantida por compatibilidade (não é mais usada por index.html, que passou a usar
// cupOverviewLines/cupsStoryLine, mas fica disponível caso seja útil de novo).
function cupRoundSpotlight(cups, teams, r) {
  if (!cups) return [];
  const phaseOrder = [
    ['classif', 'Classificatória'], ['grupos', 'Fase de Grupos'], ['oitavas', 'Oitavas de Final'],
    ['quartas', 'Quartas de Final'], ['semis', 'Semifinais'], ['finais', 'Final'],
  ];
  const out = [];
  for (const [ckey, clabel] of CUP_ORDER) {
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

// Mata-mata: casamento padrão em bracket espelhado, confirmado comparando os brackets já
// disputados (Libertadores e Sulamericana batem exatamente igual): Q1=O1xO8, Q2=O2xO7,
// Q3=O3xO6, Q4=O4xO5; S1=Q1xQ2, S2=Q3xQ4; F1=S1xS2. Dada a fase anterior já resolvida
// (times definidos) e o molde da fase seguinte (tags/rounds prontos, times ainda null),
// calcula quem avança — só depois que a fase anterior tiver sido efetivamente disputada.
const BRACKET_PAIRS = {
  4: [[0, 7], [1, 6], [2, 5], [3, 4]], // 8 confrontos anteriores -> 4 (oitavas -> quartas)
  2: [[0, 1], [2, 3]],                 // 4 -> 2 (quartas -> semis)
  1: [[0, 1]],                         // 2 -> 1 (semis -> final)
};
function advanceBracket(teams, prevMatches, nextTemplate, lastRound) {
  if (!prevMatches || !prevMatches.length || !nextTemplate || !nextTemplate.length) return nextTemplate;
  const prevRounds = prevMatches[0].rounds;
  if (!prevRounds || lastRound < prevRounds[1]) return nextTemplate; // fase anterior não terminou
  const winnerOf = m => {
    if (!m.home || !m.away) return null;
    const h = matchScore(teams, m.home, m.rounds), a = matchScore(teams, m.away, m.rounds);
    if (h.played === 0 || a.played === 0) return null;
    return h.sum >= a.sum ? m.home : m.away;
  };
  const winners = prevMatches.map(winnerOf);
  const pairs = BRACKET_PAIRS[nextTemplate.length];
  if (!pairs) return nextTemplate;
  return nextTemplate.map((m, i) => {
    const [hi, ai] = pairs[i];
    return { ...m, home: winners[hi] || null, away: winners[ai] || null };
  });
}

// Resolve, para TODAS as copas, as fases de mata-mata ainda não preenchidas manualmente no
// data.json: Oitavas da Champions via seedOitavasFromGrupos (regra da liga, a partir dos
// classificados de grupo) e Quartas/Semis/Final de qualquer copa via advanceBracket (bracket
// espelhado), encadeando fase a fase. Só entra em ação quando a fase ainda está totalmente
// vazia (home/away null) — um confronto já definido manualmente (ex.: sorteio real feito à
// mão, como na Libertadores) nunca é sobrescrito. Chame uma vez, logo após carregar o
// data.json, e use o resultado no lugar de `cups` no restante do site.
function resolveCupsKO(cups, teams, lastRound) {
  if (!cups) return cups;
  const out = {};
  Object.keys(cups).forEach(key => {
    const cup = cups[key];
    const rc = Object.assign({}, cup);
    let prev = null;
    ['oitavas', 'quartas', 'semis', 'finais'].forEach(pk => {
      let matches = cup[pk];
      if (pk === 'oitavas' && key === 'champions' && cup.grupos && cup.grupos.length) {
        const gEnd = cup.grupos[0].rounds[1];
        const allEmpty = !matches || !matches.length || matches.every(m => !m.home && !m.away);
        if (lastRound >= gEnd && allEmpty) {
          const oRounds = (matches && matches.length) ? matches[0].rounds : [gEnd + 1, gEnd + 2];
          matches = seedOitavasFromGrupos(teams, cup.grupos, oRounds);
        }
      }
      if (pk !== 'oitavas' && matches && matches.length && prev && prev.length) {
        const allEmpty = matches.every(m => !m.home && !m.away);
        if (allEmpty) matches = advanceBracket(teams, prev, matches, lastRound);
      }
      if (matches) { rc[pk] = matches; if (matches.length) prev = matches; }
    });
    out[key] = rc;
  });
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = { abbLeagueTable, roundWinners, monthlyWinners, monthlyWinnersByCalendar, monthOfRound, roundMonthMap, libertadoresClassif, championsClassif, seedOitavasFromGrupos, advanceBracket, resolveCupsKO, buildBulletin, aggRanking, matchScore, scoreName, phasePlayed, cupDigest, cupRoundSpotlight, cupOverviewLines, cupsStoryLine, prizePlan, PRIZE_ROUND, PRIZE_MONTH, PRIZE_ENTRY, MONTH_NAMES, ROUND_MONTH_FALLBACK };
}
