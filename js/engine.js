/* ==========================================================================
   Choicease — engine.js
   Pure computation. No DOM access; fully unit-testable.
   Weights, scores, ranks, confidence, sensitivity, drivers, risks,
   regret minimization, satisficing, dominance, robustness.
   ========================================================================== */

export const RATING_LABELS = {
  0: 'Unacceptable', 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent',
};

export const IMPORTANCE_LABELS = {
  1: 'Marginal', 2: 'Minor', 3: 'Moderate', 4: 'Major', 5: 'Critical',
};

/**
 * Importance rating -> raw weight. Geometric progression (10^((r-1)/4)),
 * identical to the legacy engine, so imported decisions score exactly the same.
 */
export const IMPORTANCE_TO_WEIGHT = { 1: 1, 2: 1.78, 3: 3.16, 4: 5.62, 5: 10 };

/** Rating used when a cell was never rated. 2.5 = the exact midpoint of 0–5.
    (Standardized: the legacy app used 2, 2.5, and 3 in different code paths.) */
export const DEFAULT_RATING = 2.5;

/* ------------------------------ Weights ---------------------------------- */

export function normalizeWeights(importanceRatings) {
  const entries = Object.entries(importanceRatings || {});
  const total = entries.reduce(
    (sum, [, rating]) => sum + (IMPORTANCE_TO_WEIGHT[rating] || IMPORTANCE_TO_WEIGHT[3]),
    0,
  );
  const normalized = {};
  if (total <= 0) return normalized;
  for (const [id, rating] of entries) {
    const mapped = IMPORTANCE_TO_WEIGHT[rating] || IMPORTANCE_TO_WEIGHT[3];
    normalized[id] = (mapped / total) * 100;
  }
  return normalized;
}

export function ensureNormalizedWeights(decision) {
  decision.normalizedWeights = normalizeWeights(decision.weights);
  return decision.normalizedWeights;
}

/* ------------------------------ Scoring ---------------------------------- */

export function computeResults(decision, weightOverridePct = null) {
  const weightsPct = weightOverridePct
    ? renormalizePct(weightOverridePct)
    : (hasAllWeights(decision) ? decision.normalizedWeights : normalizeWeights(decision.weights));

  const results = decision.options.map((option) => {
    let totalScore = 0;
    const criteriaScores = {};
    for (const criterion of decision.criteria) {
      const rating = getRating(decision, option.id, criterion.id);
      const weight = (weightsPct[criterion.id] || 0) / 100;
      const weighted = rating * weight;
      criteriaScores[criterion.id] = {
        criterionName: criterion.name,
        rating,
        weightPct: weight * 100,
        weighted,
      };
      totalScore += weighted;
    }
    return {
      option: { id: option.id, name: option.name, description: option.description || '' },
      totalScore: Math.round(totalScore * 1e6) / 1e6,
      criteriaScores,
    };
  });

  results.sort((a, b) => b.totalScore - a.totalScore);
  return results;
}

export function getRating(decision, optionId, criterionId) {
  const value = decision.ratings[`${optionId}-${criterionId}`];
  return Number.isFinite(value) ? value : DEFAULT_RATING;
}

export function ratedCellCount(decision) {
  let count = 0;
  for (const o of decision.options) {
    for (const c of decision.criteria) {
      if (Number.isFinite(decision.ratings[`${o.id}-${c.id}`])) count += 1;
    }
  }
  return count;
}

function hasAllWeights(decision) {
  const nw = decision.normalizedWeights;
  if (!nw) return false;
  return decision.criteria.every((c) => Number.isFinite(nw[c.id]));
}

function renormalizePct(pcts) {
  const total = Object.values(pcts).reduce((s, v) => s + (Number(v) || 0), 0);
  const out = {};
  if (total <= 0) return out;
  for (const [id, v] of Object.entries(pcts)) out[id] = ((Number(v) || 0) / total) * 100;
  return out;
}

/* ------------------------------ Ranking ---------------------------------- */

export function assignRanks(results, epsilon = 1e-6) {
  const ranked = [];
  let i = 0;
  let rank = 1;
  while (i < results.length) {
    const group = [results[i]];
    let j = i + 1;
    while (j < results.length && Math.abs(results[j].totalScore - results[i].totalScore) < epsilon) {
      group.push(results[j]);
      j += 1;
    }
    for (const r of group) ranked.push({ ...r, rank, isTied: group.length > 1 });
    rank += group.length;
    i = j;
  }
  return ranked;
}

/* --------------------- Sensitivity: flip points -------------------------- */

export function computeFlipPoints(decision) {
  const basePct = normalizeWeights(decision.weights);
  const baseResults = computeResults(decision);
  if (baseResults.length < 2) return [];
  const baseWinnerId = baseResults[0].option.id;

  const flips = [];
  for (const criterion of decision.criteria) {
    const currentPct = basePct[criterion.id] || 0;
    let flipAt = null;
    let challenger = null;

    for (let w = 0; w <= 100; w += 1) {
      const trial = buildTrialWeights(basePct, criterion.id, w);
      const trialResults = computeResults(decision, trial);
      if (trialResults[0].option.id !== baseWinnerId) {
        if (flipAt === null || Math.abs(w - currentPct) < Math.abs(flipAt - currentPct)) {
          flipAt = w;
          challenger = trialResults[0].option.name;
        }
      }
    }

    const distance = flipAt === null ? null : Math.abs(flipAt - currentPct);
    flips.push({
      criterionId: criterion.id,
      criterionName: criterion.name,
      currentPct,
      flipAt,
      challenger,
      distance,
      criticality: distance === null ? 'stable' : distance <= 10 ? 'critical' : distance <= 25 ? 'moderate' : 'stable',
    });
  }

  flips.sort((a, b) => {
    if (a.distance === null && b.distance === null) return 0;
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  });
  return flips;
}

function buildTrialWeights(basePct, targetId, targetValue) {
  const othersTotal = Object.entries(basePct)
    .filter(([id]) => String(id) !== String(targetId))
    .reduce((s, [, v]) => s + v, 0);
  const remaining = 100 - targetValue;
  const trial = {};
  for (const [id, v] of Object.entries(basePct)) {
    if (String(id) === String(targetId)) {
      trial[id] = targetValue;
    } else {
      trial[id] = othersTotal > 0
        ? (v / othersTotal) * remaining
        : remaining / Math.max(1, Object.keys(basePct).length - 1);
    }
  }
  return trial;
}

/* ---------------------------- Confidence --------------------------------- */

export function computeConfidence(rankedResults, flipPoints, decision) {
  if (rankedResults.length < 2) {
    return { level: 'High', score: 3, reason: 'Only one option was evaluated.', gap: 0, gapPct: 0, coverage: 1 };
  }
  const top = rankedResults[0];
  const runnerUp = rankedResults[1];
  const gap = top.totalScore - runnerUp.totalScore;
  const gapPct = (gap / 5) * 100;

  const nearestFlip = flipPoints.find((f) => f.distance !== null);
  const fragile = nearestFlip && nearestFlip.distance <= 10;
  const somewhatFragile = nearestFlip && nearestFlip.distance <= 20;

  const expected = decision.options.length * decision.criteria.length;
  const actual = ratedCellCount(decision);
  const coverage = expected > 0 ? actual / expected : 1;

  let score;
  if (top.isTied) score = 1;
  else if (gapPct >= 8 && !fragile) score = 3;
  else if (gapPct >= 3 && !fragile) score = 2;
  else score = 1;
  if (score === 3 && (somewhatFragile || coverage < 0.9)) score = 2;

  const reasons = [];
  if (top.isTied) {
    reasons.push(`"${top.option.name}" is tied at the top — the analysis cannot separate the leaders`);
  } else {
    reasons.push(`the lead over "${runnerUp.option.name}" is ${gap.toFixed(2)} points (${gapPct.toFixed(0)}% of the scale)`);
  }
  if (nearestFlip && nearestFlip.distance !== null) {
    if (fragile) {
      reasons.push(`the result flips if "${nearestFlip.criterionName}" shifts by ~${Math.round(nearestFlip.distance)} weight-points`);
    } else {
      reasons.push(`the nearest flip point ("${nearestFlip.criterionName}") is ${Math.round(nearestFlip.distance)} weight-points away`);
    }
  } else {
    reasons.push('no single criterion weight change (0–100%) overturns the result');
  }
  if (coverage < 0.999) {
    reasons.push(`${Math.round((1 - coverage) * 100)}% of ratings used the 2.5 default`);
  }

  const level = score === 3 ? 'High' : score === 2 ? 'Medium' : 'Low';
  return { level, score, reason: reasons.join('; ') + '.', gap, gapPct, coverage };
}

/* ------------------------------ Drivers ---------------------------------- */

export function computeDrivers(rankedResults, decision, count = 8) {
  if (rankedResults.length < 2) return [];
  const top = rankedResults[0];
  const runnerUp = rankedResults[1];
  const drivers = decision.criteria.map((criterion) => {
    const a = top.criteriaScores[criterion.id];
    const b = runnerUp.criteriaScores[criterion.id];
    const delta = (a?.weighted || 0) - (b?.weighted || 0);
    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      weightPct: a?.weightPct || 0,
      topRating: a?.rating ?? DEFAULT_RATING,
      runnerUpRating: b?.rating ?? DEFAULT_RATING,
      delta,
    };
  });
  drivers.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  return drivers.slice(0, count);
}

/* ------------------------------- Risks ----------------------------------- */

export function computeRisks(rankedResults, decision) {
  if (!rankedResults.length) return [];
  const top = rankedResults[0];
  const risks = [];
  for (const criterion of decision.criteria) {
    const cell = top.criteriaScores[criterion.id];
    if (!cell) continue;
    if (cell.rating <= 2 && cell.weightPct >= 8) {
      risks.push({
        criterionName: criterion.name,
        rating: cell.rating,
        ratingLabel: RATING_LABELS[Math.round(cell.rating)] || '',
        weightPct: cell.weightPct,
        severity: cell.rating <= 1 && cell.weightPct >= 15 ? 'high' : 'medium',
        severityScore: cell.weightPct * (2.5 - cell.rating),
      });
    }
  }
  risks.sort((a, b) => b.severityScore - a.severityScore);
  return risks;
}

/* ---------------------- Regret minimization ------------------------------ */
/* For each criterion, the regret of an option = (best rating on that criterion
   − its rating) × weight. Minimax regret ranks by the smallest worst-case
   weighted regret; total regret is also reported. */

export function computeRegret(decision) {
  const weightsPct = normalizeWeights(decision.weights);
  const bestPerCriterion = {};
  for (const c of decision.criteria) {
    bestPerCriterion[c.id] = Math.max(
      ...decision.options.map((o) => getRating(decision, o.id, c.id)),
    );
  }
  const rows = decision.options.map((option) => {
    let maxRegret = 0;
    let maxRegretCriterion = null;
    let totalRegret = 0;
    const perCriterion = {};
    for (const c of decision.criteria) {
      const rating = getRating(decision, option.id, c.id);
      const regret = (bestPerCriterion[c.id] - rating) * ((weightsPct[c.id] || 0) / 100);
      perCriterion[c.id] = regret;
      totalRegret += regret;
      if (regret > maxRegret) {
        maxRegret = regret;
        maxRegretCriterion = c.name;
      }
    }
    return {
      option: { id: option.id, name: option.name },
      maxRegret: Math.round(maxRegret * 1e6) / 1e6,
      maxRegretCriterion,
      totalRegret: Math.round(totalRegret * 1e6) / 1e6,
      perCriterion,
    };
  });
  rows.sort((a, b) => a.maxRegret - b.maxRegret || a.totalRegret - b.totalRegret);
  return rows;
}

/* --------------------------- Satisficing --------------------------------- */
/* Which options clear a minimum acceptable rating on EVERY criterion.
   thresholds: { criterionId: number } or a single number applied to all. */

export function computeSatisficing(decision, thresholds = 3) {
  const getThreshold = (criterionId) =>
    typeof thresholds === 'number' ? thresholds : (thresholds[criterionId] ?? 3);

  return decision.options.map((option) => {
    const failures = [];
    for (const c of decision.criteria) {
      const rating = getRating(decision, option.id, c.id);
      const bar = getThreshold(c.id);
      if (rating < bar) {
        failures.push({ criterionId: c.id, criterionName: c.name, rating, threshold: bar });
      }
    }
    return { option: { id: option.id, name: option.name }, passes: failures.length === 0, failures };
  });
}

/* ---------------------------- Dominance ---------------------------------- */
/* Option B is dominated by A if A rates ≥ B on every criterion and > B on at
   least one — B can be eliminated regardless of how weights are chosen. */

export function computeDominance(decision) {
  const dominated = [];
  for (const b of decision.options) {
    for (const a of decision.options) {
      if (a.id === b.id) continue;
      let allGte = true;
      let anyGt = false;
      for (const c of decision.criteria) {
        const ra = getRating(decision, a.id, c.id);
        const rb = getRating(decision, b.id, c.id);
        if (ra < rb - 1e-9) { allGte = false; break; }
        if (ra > rb + 1e-9) anyGt = true;
      }
      if (allGte && anyGt) {
        dominated.push({ dominated: b.name, dominatedId: b.id, by: a.name });
        break; // one dominator is enough to flag it
      }
    }
  }
  return dominated;
}

/* --------------------- Sweep winners (who can ever be #1?) --------------- */
/* Sweeps every criterion's weight 0-100% (others rescaled) and records every
   option that tops the ranking somewhere, with a first example of how.
   An option absent from this map cannot reach #1 under any single-criterion
   emphasis — the backbone of safe elimination. */

export function computeSweepWinners(decision) {
  const basePct = normalizeWeights(decision.weights);
  const winners = new Map(); // optionId -> null (current winner) | {criterionName, weightPct}
  const base = assignRanks(computeResults(decision));
  for (const r of base) {
    if (r.rank === 1) winners.set(r.option.id, null);
  }
  for (const criterion of decision.criteria) {
    for (let w = 0; w <= 100; w += 1) {
      const trial = buildTrialWeights(basePct, criterion.id, w);
      const top = computeResults(decision, trial)[0].option;
      if (!winners.has(top.id)) {
        winners.set(top.id, { criterionName: criterion.name, weightPct: w });
      }
    }
  }
  return winners;
}

/* ----------------------------- Eliminator -------------------------------- */
/* "What can be safely cut from the list?" An option is only ELIMINATED when
   the evidence is airtight; compensable weakness goes to a watchlist instead.
   Rules (any one eliminates):
     A. Dominated — another option is equal-or-better on every criterion.
     B. Deal-breakers + no path to #1 — worst-in-field ratings (<= DEAL_BREAKER_RATING)
        on criteria carrying >= DEAL_BREAKER_WEIGHT_PCT of weight, AND the sweep
        (plus robustness scenarios, when provided) never crowns it.
     C. No path to #1 at all — never wins the sweep and 0% of robustness scenarios,
        regardless of deal-breakers.
   Deal-breakers WITH a path to #1 -> watchlist, with the rescue condition shown. */

export const DEAL_BREAKER_RATING = 2;
export const DEAL_BREAKER_WEIGHT_PCT = 50;

export function computeEliminator(decision, { robustness = null } = {}) {
  const evaluated = decision.options.length;
  if (evaluated < 2 || decision.criteria.length === 0) {
    return { eliminated: [], watchlist: [], shortlist: decision.options.map((o) => o.name), evaluated };
  }
  const weightsPct = normalizeWeights(decision.weights);
  const dominance = computeDominance(decision);
  const sweepWinners = computeSweepWinners(decision);
  const shareByOption = robustness
    ? Object.fromEntries(robustness.winShare.map((w) => [String(w.option.id), w.share]))
    : null;

  const minPerCriterion = {};
  for (const c of decision.criteria) {
    minPerCriterion[c.id] = Math.min(
      ...decision.options.map((o) => getRating(decision, o.id, c.id)),
    );
  }

  const eliminated = [];
  const watchlist = [];

  for (const option of decision.options) {
    const canWin = sweepWinners.has(option.id);
    if (canWin && sweepWinners.get(option.id) === null) continue; // current winner: never eliminable

    const dominatedBy = dominance.find((d) => d.dominatedId === option.id)?.by || null;

    const dealBreakers = [];
    for (const c of decision.criteria) {
      const rating = getRating(decision, option.id, c.id);
      if (rating <= DEAL_BREAKER_RATING && rating <= minPerCriterion[c.id] + 1e-9) {
        dealBreakers.push({
          criterionName: c.name,
          rating,
          weightPct: weightsPct[c.id] || 0,
        });
      }
    }
    dealBreakers.sort((a, b) => b.weightPct - a.weightPct);
    const dealBreakerWeightPct = dealBreakers.reduce((s, d) => s + d.weightPct, 0);
    const hasDealBreakers = dealBreakerWeightPct >= DEAL_BREAKER_WEIGHT_PCT;

    const robustShare = shareByOption ? (shareByOption[String(option.id)] || 0) : null;
    const neverWins = !canWin && (robustShare === null || robustShare === 0);

    const entryBase = {
      option: { id: option.id, name: option.name },
      dominatedBy,
      dealBreakers,
      dealBreakerWeightPct,
      canWin,
      robustShare,
    };

    if (dominatedBy) {
      eliminated.push({ ...entryBase, rule: 'dominated' });
    } else if (hasDealBreakers && neverWins) {
      eliminated.push({ ...entryBase, rule: 'dealBreakers' });
    } else if (neverWins) {
      eliminated.push({ ...entryBase, rule: 'neverWins' });
    } else if (hasDealBreakers && canWin) {
      watchlist.push({ ...entryBase, rescue: sweepWinners.get(option.id) });
    }
  }

  const eliminatedIds = new Set(eliminated.map((e) => e.option.id));
  const shortlist = decision.options.filter((o) => !eliminatedIds.has(o.id)).map((o) => o.name);
  return { eliminated, watchlist, shortlist, evaluated };
}

/* ---------------------------- Robustness --------------------------------- */
/* Perturb every criterion weight by a random factor in [1−jitter, 1+jitter],
   renormalize, recompute the winner. Deterministic via seeded PRNG. */

export function computeRobustness(decision, { trials = 500, jitter = 0.2, seed = 42 } = {}) {
  const basePct = normalizeWeights(decision.weights);
  if (decision.options.length < 2 || decision.criteria.length === 0) {
    return { trials: 0, winShare: [], winnerHoldRate: 1 };
  }
  const rng = mulberry32(seed);
  const wins = new Map();
  for (let t = 0; t < trials; t += 1) {
    const perturbed = {};
    for (const [id, v] of Object.entries(basePct)) {
      perturbed[id] = v * (1 - jitter + rng() * 2 * jitter);
    }
    const winner = computeResults(decision, perturbed)[0].option;
    wins.set(winner.id, (wins.get(winner.id) || 0) + 1);
  }
  const baseWinner = computeResults(decision)[0].option;
  const winShare = decision.options
    .map((o) => ({ option: { id: o.id, name: o.name }, share: (wins.get(o.id) || 0) / trials }))
    .sort((a, b) => b.share - a.share);
  return {
    trials,
    jitter,
    winShare,
    winnerHoldRate: (wins.get(baseWinner.id) || 0) / trials,
    baseWinnerName: baseWinner.name,
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------- Full analysis --------------------------------- */

export function analyzeDecision(decision) {
  ensureNormalizedWeights(decision);
  const results = computeResults(decision);
  const ranked = assignRanks(results);
  const flipPoints = computeFlipPoints(decision);
  const confidence = computeConfidence(ranked, flipPoints, decision);
  const drivers = computeDrivers(ranked, decision);
  const risks = computeRisks(ranked, decision);
  const regret = computeRegret(decision);
  const dominance = computeDominance(decision);
  const robustness = computeRobustness(decision);
  const eliminator = computeEliminator(decision, { robustness });
  return { ranked, flipPoints, confidence, drivers, risks, regret, dominance, robustness, eliminator };
}
