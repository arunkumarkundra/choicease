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
    `I wanted a more deliberate way to think through {title}.`,
    `A little structure helped me get clearer on {title}.`,
    `I broke down {title} to see the trade-offs more clearly.`,
    `Looking at {title} from a few different angles.`,
    `I put some shape around {title} before making the call.`,
    `A considered look at {title}.`,     
    `Thinking through {title}. Turns out writing down what actually matters, changes everything.`,
    `Had a decision to make: {title}. Gave it the structured treatment.`,
  ],
  landslide: [
    `{winner} came out well ahead for {title}.`,
    `For {title}, {winner} was the strongest fit by some distance.`,
    `{winner} was the clear front-runner for {title}.`,
    `The choice became fairly clear: {winner} for {title}.`,
    `For {title}, {winner} stood apart from the rest.`,
    `{winner} made the case for itself on {title}.`,
     `Decision made. {winner} wins {title} decisively.`,
  ],
  clear: [
    `I’d go with {winner} for {title}.`,
    `{winner} came out ahead of {runnerUp} for {title}.`,
    `After weighing the trade-offs, {winner} felt like the better fit for {title}.`,
    `For {title}, I’d lean towards {winner}.`,
    `{winner} had the edge for {title}.`,
    `The balance of factors pointed to {winner} for {title}.`,
    `{winner} was the more convincing choice for {title}.`,
    `For {title}, {winner} just made more sense than {runnerUp}.`,
  ],
  photofinish: [
    `{winner} and {runnerUp} were very close for {title}; I’d give {winner} the edge.`,
    `A close call on {title}: {winner} just edged {runnerUp}.`,
    `There wasn’t much between {winner} and {runnerUp} for {title}.`,
    `{winner} narrowly came out ahead for {title}.`,
    `For {title}, the difference between {winner} and {runnerUp} was slight.`,
    `A finely balanced choice: {winner} over {runnerUp} for {title}.`,
    `{winner} was the marginal pick for {title}; {runnerUp} was close behind.`,
    `{winner} barely edges {runnerUp} for {title}.`,
    `{winner} has the edge for {title}, though {runnerUp} is not far away.`,
     `Too close to call. {winner} and {runnerUp} are neck-and-neck on {title}.`,
  ],
  fragile: [
    `I’d lean {winner} for {title}, though a small shift in priorities could change it.`,
    `{winner} came out ahead for {title}, but it remains a close judgment.`,
    `For {title}, {winner} works best—provided the current priorities hold.`,
    `A tentative lean towards {winner} for {title}.`,
    `{winner} is the better fit for {title}, but the result is sensitive to what matters most.`,
    `For now, {winner} leads for {title}. A different emphasis could alter the answer.`,
  ],
  upset: [
    `{winner} came out ahead for {title}—not the result I expected.`,
    `A slightly unexpected outcome: {winner} for {title}.`,
    `For {title}, {winner} won on the overall balance rather than {heaviest} alone.`,
    `{winner} wasn’t the obvious pick for {title}, but the wider picture favoured it.`,
    `The result for {title} was more nuanced than I expected: {winner}.`,
    `{winner} emerged as the best fit for {title}, despite not leading on {heaviest}.`,
    `Surprise result: {winner} takes {title} even though it's not the strongest on {heaviest}.`,
    `Went in expecting a different winner, but {winner} edged {title}.`,
  ],
};

const STAT_LINES = [
  `{options} options · {criteria} criteria · properly weighed`,
  `Weighed {options} options across {criteria} criteria.`,
  `{criteria} criteria, {options} options.`,
  `Based on {options} options and {criteria} criteria.`,
  `Ranked {options} options on {criteria} criteria.`,
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
    '{title}': `"${decision.title || 'a tough call'}"`,
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
