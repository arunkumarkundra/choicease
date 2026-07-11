/* ==========================================================================
   Choicease — sharecopy.js
   Variety engine for share messages. The situation is derived from real
   decision signals (confidence, gap, ties, fragility, whether the winner is
   weak on a heavy criterion, or an "upset" vs the heaviest criterion), then a
   line is chosen at random from that situation's pool. Questions lead where
   the result invites debate — questions drive replies.

   All copy lives here so it is easy to tweak. Two builders are exported:
     buildBody(analysis, ctx)  -> the situation-flavored middle lines
     Everything else (title line, link line, hashtag) stays in share.js so
     link/hashtag placement per platform is unchanged.
   ========================================================================== */

/* ------------------------ situation classification ---------------------- */

/**
 * @returns one of: 'solo' | 'landslide' | 'clear' | 'photofinish'
 *                  | 'fragile' | 'upset'
 */
export function classifySituation(analysis, decision) {
  const ranked = analysis?.ranked || [];
  if (ranked.length < 2) return 'solo';

  const top = ranked[0];
  const conf = analysis.confidence || {};
  const gapPct = conf.gapPct ?? 0;

  if (top.isTied || gapPct < 2.5) return 'photofinish';

  // Fragile: a small weight nudge flips it, or the winner is weak (<=2.5) on a
  // heavy (>=25%) criterion.
  const nearestFlip = (analysis.flipPoints || []).find((f) => f.distance !== null);
  const flipFragile = nearestFlip && nearestFlip.distance <= 8;
  const weakOnHeavy = decision.criteria.some((c) => {
    const cell = top.criteriaScores?.[c.id];
    return cell && cell.rating <= 2.5 && cell.weightPct >= 25;
  });
  if (flipFragile || weakOnHeavy) return 'fragile';

  // Upset: the winner is NOT the option that scores highest on the single
  // heaviest criterion — a mild surprise worth teasing.
  const heaviest = [...decision.criteria].sort(
    (a, b) => (decision.normalizedWeights[b.id] || 0) - (decision.normalizedWeights[a.id] || 0),
  )[0];
  if (heaviest) {
    let bestId = null;
    let bestRating = -1;
    for (const r of ranked) {
      const rating = r.criteriaScores?.[heaviest.id]?.rating ?? 0;
      if (rating > bestRating) { bestRating = rating; bestId = r.option.id; }
    }
    if (bestId !== null && bestId !== top.option.id && (conf.level !== 'Low')) return 'upset';
  }

  if (conf.level === 'High' && gapPct >= 14) return 'landslide';
  return 'clear';
}

/* --------------------------- copy pools --------------------------------- */
/* Tokens: {winner} {runnerUp} {title} {fit} {options} {criteria} {heaviest}
   Keep each line tweet-friendly. ~half end in a question by design. */

const POOLS = {
  solo: [
    `Weighing {title}? I mapped it out properly instead of just going with my gut.`,
    `Thinking through {title}. Turns out writing down what actually matters changes everything.`,
    `Had a decision to make: {title}. Gave it the structured treatment.`,
  ],
  landslide: [
    `🏆 {winner} — and it wasn't close.`,
    `Called it: {winner} runs away with {title}. {runnerUp} never stood a chance.`,
    `{winner} takes {title} in a landslide ({fit}% fit).`,
    `Decision made ✅ {winner} wins {title} decisively.`,
  ],
  clear: [
    `🏆 {winner} takes {title} — {fit}% fit, and the numbers back it up. Do you agree?`,
    `After weighing {options} options on {criteria} criteria: {winner} wins. Would you have picked it?`,
    `{winner} comes out on top for {title}, edging {runnerUp}. Solid pick — or am I missing something?`,
    `Decision made ✅ {winner} over {runnerUp} for {title}. Curious what you'd have chosen.`,
    `🏆 {winner} wins {title}. Properly weighed, not gut-felt — but I'd love a second opinion.`,
  ],
  photofinish: [
    `📸 Photo finish: {winner} barely edges {runnerUp} for {title}. Honestly — which would YOU pick?`,
    `Too close to call. {winner} and {runnerUp} are neck-and-neck on {title}. Break the tie for me?`,
    `{winner} wins {title}… by a hair over {runnerUp}. I keep flip-flopping. What would you do?`,
    `Dead heat between {winner} and {runnerUp}. The math barely picked one. Your call could swing it.`,
    `This one's a coin-flip: {winner} vs {runnerUp} for {title}. Help me decide?`,
  ],
  fragile: [
    `🏆 {winner} wins {title} — but it's got a soft spot. Am I overthinking this, or is it the right call?`,
    `The numbers say {winner} for {title}. One small change and it flips, though. Would you risk it?`,
    `{winner} takes it, but only just — nudge one priority and {runnerUp} wins. What matters most to you here?`,
    `Leaning {winner} for {title}. It's not bulletproof. Talk me into it — or out of it?`,
  ],
  upset: [
    `Plot twist: {winner} won {title} — not the option I expected. Didn't see that coming. Did you?`,
    `Surprise result: {winner} takes {title} even though it's not the strongest on {heaviest}. Convinced, or skeptical?`,
    `Went in expecting a different winner, but {winner} edged {title}. Talk me out of it?`,
    `{winner}?! Not where I thought {title} would land. The criteria don't lie though. Your take?`,
  ],
};

const STAT_LINES = [
  `{options} options · {criteria} criteria · properly weighed, not gut-felt`,
  `Weighed {options} options across {criteria} criteria to get here.`,
  `{criteria} criteria, {options} options, zero coin-flips.`,
  `Ranked {options} options on the {criteria} things that actually matter.`,
];

/* ------------------------------ builder --------------------------------- */

/**
 * Situation-flavored body lines (no title header, no link, no hashtag — those
 * are assembled by share.js so per-platform URL placement stays intact).
 * @returns {{ situation: string, lead: string, stat: string|null }}
 */
export function buildBody(analysis, decision, rng = Math.random) {
  const situation = classifySituation(analysis, decision);
  const ranked = analysis?.ranked || [];
  const top = ranked[0];
  const runnerUp = ranked[1];

  const heaviest = [...(decision.criteria || [])].sort(
    (a, b) => (decision.normalizedWeights[b.id] || 0) - (decision.normalizedWeights[a.id] || 0),
  )[0];

  const tokens = {
    '{winner}': top?.option.name || 'the winner',
    '{runnerUp}': runnerUp?.option.name || 'the runner-up',
    '{title}': decision.title || 'a tough call',
    '{fit}': top ? String(Math.round((top.totalScore / 5) * 100)) : '',
    '{options}': String(decision.options?.length || 0),
    '{criteria}': String(decision.criteria?.length || 0),
    '{heaviest}': heaviest?.name || 'the top criterion',
  };
  const fill = (s) => s.replace(/\{\w+\}/g, (m) => (m in tokens ? tokens[m] : m));

  const pool = POOLS[situation] || POOLS.clear;
  const lead = fill(pick(pool, rng));

  // Solo and photo-finish carry their own punch; a stat line would dilute them.
  const stat = (situation === 'solo' || situation === 'photofinish')
    ? null
    : fill(pick(STAT_LINES, rng));

  return { situation, lead, stat };
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}
