/* ==========================================================================
   Choicease — ai.js
   The single seam between the app and on-device AI (WebLLM).
   Nothing else in the app imports WebLLM directly; everything goes through
   the functions here. Every function either returns clean, validated data or
   throws AI_UNAVAILABLE, so callers can fall back to the existing non-AI path
   with a single try/catch.

   Privacy: the model runs entirely in the browser via WebGPU. No decision
   data ever leaves the device — consistent with the app's core promise.

   Design rules honoured here:
   - Lazy: the model is only fetched when first genuinely needed.
   - Non-blocking: load happens in the background; callers that need a result
     "now" get AI_UNAVAILABLE if it isn't ready, and fall back silently.
   - Structured: the model is always asked for strict JSON; we parse
     defensively and reject anything malformed rather than guess.
   ========================================================================== */

/* WebLLM is loaded from a CDN as an ES module, on demand. If the import
   fails (offline, blocked, unsupported browser) we degrade to non-AI. */
const WEBLLM_CDN = 'https://esm.run/@mlc-ai/web-llm';

/* Qwen2.5-3B-Instruct: strong instruction-following and reliable JSON for a
   ~2GB quantized download; a good quality/size balance for on-device use.
   (Kept as a single constant so it is trivial to swap later.) */
const MODEL_ID = 'Qwen2.5-3B-Instruct-q4f16_1-MLC';

/* Sentinel thrown whenever AI cannot serve a request for any reason. Callers
   match on this to fall back to the existing regex/default behaviour. */
export const AI_UNAVAILABLE = 'AI_UNAVAILABLE';

/* Engine lifecycle state. `status` is one of:
   'idle'      — never started
   'loading'   — model is downloading / initializing
   'ready'     — usable
   'failed'    — permanently unavailable this session */
const state = {
  status: 'idle',
  engine: null,
  loadPromise: null,
  progress: 0, // 0..1, best-effort
};

/* Listeners for load-progress UI (e.g. the "warming up" indicator). Each is
   called with { status, progress }. Registration returns an unsubscribe fn. */
const progressListeners = new Set();

export function onAiProgress(listener) {
  progressListeners.add(listener);
  // Immediately push current state so late subscribers are in sync.
  try { listener({ status: state.status, progress: state.progress }); } catch { /* ignore */ }
  return () => progressListeners.delete(listener);
}

function emitProgress() {
  for (const listener of progressListeners) {
    try { listener({ status: state.status, progress: state.progress }); } catch { /* ignore */ }
  }
}

/* True only when WebGPU exists; WebLLM cannot run without it. Cheap to call. */
export function aiSupported() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export function aiStatus() {
  return state.status;
}

export function aiReady() {
  return state.status === 'ready' && state.engine != null;
}

/* --------------------------------------------------------------------------
   Loading
   -------------------------------------------------------------------------- */

/**
 * Begin loading the model if it isn't already loading/ready. Safe to call
 * repeatedly and from multiple places — the work happens at most once.
 * Does not throw; failures move status to 'failed'. Returns the shared
 * load promise (resolving to true on success, false on failure) so callers
 * can await readiness if they wish.
 */
export function ensureAiLoading() {
  if (state.status === 'ready') return Promise.resolve(true);
  if (state.status === 'failed') return Promise.resolve(false);
  if (state.loadPromise) return state.loadPromise;

  if (!aiSupported()) {
    state.status = 'failed';
    emitProgress();
    return Promise.resolve(false);
  }

  state.status = 'loading';
  state.progress = 0;
  emitProgress();

  state.loadPromise = (async () => {
    try {
      const webllm = await import(/* @vite-ignore */ WEBLLM_CDN);
      const engine = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => {
          // report.progress is 0..1 (best-effort; not all phases report it)
          if (typeof report?.progress === 'number') {
            state.progress = Math.max(0, Math.min(1, report.progress));
            emitProgress();
          }
        },
      });
      state.engine = engine;
      state.status = 'ready';
      state.progress = 1;
      emitProgress();
      return true;
    } catch {
      state.engine = null;
      state.status = 'failed';
      emitProgress();
      return false;
    }
  })();

  return state.loadPromise;
}

/* --------------------------------------------------------------------------
   Low-level request helper
   -------------------------------------------------------------------------- */

/**
 * Run a single-turn chat completion and return the raw string content.
 * Throws AI_UNAVAILABLE if the engine isn't ready or the call fails.
 * `waitMs` optionally allows a short wait for an in-flight load to finish;
 * by default we do NOT wait (callers that can't block pass 0).
 */
async function complete(system, user, { waitMs = 0, temperature = 0.4 } = {}) {
  if (state.status !== 'ready') {
    if (waitMs > 0 && state.status === 'loading' && state.loadPromise) {
      const timeout = new Promise((res) => setTimeout(() => res(false), waitMs));
      const ok = await Promise.race([state.loadPromise, timeout]);
      if (!ok || state.status !== 'ready') throw AI_UNAVAILABLE;
    } else {
      throw AI_UNAVAILABLE;
    }
  }
  try {
    const reply = await state.engine.chat.completions.create({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
      // Nudge the runtime toward pure JSON where supported; we still parse
      // defensively below in case the field is ignored.
      response_format: { type: 'json_object' },
    });
    const content = reply?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw AI_UNAVAILABLE;
    return content;
  } catch (err) {
    if (err === AI_UNAVAILABLE) throw err;
    throw AI_UNAVAILABLE;
  }
}

/**
 * Parse a model reply into JSON, tolerating stray prose or code fences.
 * Returns the parsed value or throws AI_UNAVAILABLE.
 */
function parseJson(text) {
  if (typeof text !== 'string') throw AI_UNAVAILABLE;
  let s = text.trim();
  // Strip Markdown code fences if the model added them despite instructions.
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  // If there is surrounding prose, extract the outermost JSON object/array.
  if (s[0] !== '{' && s[0] !== '[') {
    const objStart = s.indexOf('{');
    const arrStart = s.indexOf('[');
    let start = -1;
    if (objStart === -1) start = arrStart;
    else if (arrStart === -1) start = objStart;
    else start = Math.min(objStart, arrStart);
    if (start === -1) throw AI_UNAVAILABLE;
    const open = s[start];
    const close = open === '{' ? '}' : ']';
    const end = s.lastIndexOf(close);
    if (end <= start) throw AI_UNAVAILABLE;
    s = s.slice(start, end + 1);
  }
  try {
    return JSON.parse(s);
  } catch {
    throw AI_UNAVAILABLE;
  }
}

/* Small helpers for describing a decision to the model without leaking ids. */
function optionsText(decision) {
  return (decision.options || [])
    .map((o) => `- ${o.name}${o.description ? ` (${o.description})` : ''}`)
    .join('\n');
}
function criteriaText(decision) {
  return (decision.criteria || [])
    .map((c) => `- ${c.name}${c.description ? ` (${c.description})` : ''}`)
    .join('\n');
}
function frameText(decision) {
  const title = decision.title || 'an important choice';
  const ctx = decision.description ? `\nContext: ${decision.description}` : '';
  return `Decision: "${title}".${ctx}`;
}

const clampInt = (n, lo, hi, fallback) => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(hi, Math.max(lo, v));
};
const clampNum = (n, lo, hi) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.min(hi, Math.max(lo, v));
};

/* --------------------------------------------------------------------------
   Task: criteria suggestions (Tab 3 AI fallback)
   Returns [{ name, description }] (2..7 items) or throws AI_UNAVAILABLE.
   -------------------------------------------------------------------------- */
export async function aiCriteria(decision, { waitMs = 0 } = {}) {
  const system =
    'You help structure decisions. Reply ONLY with JSON, no prose. ' +
    'Schema: {"criteria":[{"name":"string (2-4 words)","description":"string (one short line)"}]}. ' +
    'Return 5 to 7 criteria that genuinely differentiate the options.';
  const user =
    `${frameText(decision)}\n` +
    `${decision.options?.length ? `Options being compared:\n${optionsText(decision)}\n` : ''}` +
    'Suggest criteria to judge the options on.';

  const raw = await complete(system, user, { waitMs });
  const data = parseJson(raw);
  const list = Array.isArray(data) ? data : data.criteria;
  if (!Array.isArray(list)) throw AI_UNAVAILABLE;

  const out = [];
  for (const item of list) {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    if (!name) continue;
    const description = typeof item?.description === 'string' ? item.description.trim() : '';
    out.push({ name, description });
    if (out.length >= 7) break;
  }
  if (out.length < 2) throw AI_UNAVAILABLE;
  return out;
}

/* --------------------------------------------------------------------------
   Task: default importance weights (Tab 4 seeding)
   Given the decision's criteria, return { [criterionName]: 1..5 }.
   Caller maps names back to ids. Throws AI_UNAVAILABLE on any shortfall.
   -------------------------------------------------------------------------- */
export async function aiWeights(decision, { waitMs = 0 } = {}) {
  if (!decision.criteria?.length) throw AI_UNAVAILABLE;
  const system =
    'You help weight decision criteria. Reply ONLY with JSON, no prose. ' +
    'Schema: {"weights":[{"name":"exact criterion name","importance":1-5}]}. ' +
    '1 = marginal, 3 = moderate, 5 = critical. Avoid making everything equal.';
  const user =
    `${frameText(decision)}\nCriteria:\n${criteriaText(decision)}\n` +
    'Give an importance level (1-5) for each criterion above, using its exact name.';

  const raw = await complete(system, user, { waitMs });
  const data = parseJson(raw);
  const list = Array.isArray(data) ? data : data.weights;
  if (!Array.isArray(list)) throw AI_UNAVAILABLE;

  const byName = new Map();
  for (const item of list) {
    const name = typeof item?.name === 'string' ? item.name.trim().toLowerCase() : '';
    if (!name) continue;
    const importance = clampInt(item?.importance, 1, 5, null);
    if (importance == null) continue;
    byName.set(name, importance);
  }
  // Require a weight for at least most criteria; otherwise fall back entirely.
  const result = {};
  let matched = 0;
  for (const c of decision.criteria) {
    const key = c.name.trim().toLowerCase();
    if (byName.has(key)) { result[c.id] = byName.get(key); matched += 1; }
  }
  if (matched < decision.criteria.length) throw AI_UNAVAILABLE;
  return result; // { criterionId: 1..5 }
}

/* --------------------------------------------------------------------------
   Task: default option ratings (Tab 5 seeding)
   Returns { "optionName||criterionName": 0..5 } for cells where general
   knowledge plausibly applies. Cells the model omits are left for the caller
   to keep at the app's honest midpoint default. Throws only if unusable.
   -------------------------------------------------------------------------- */
export async function aiRatings(decision, { waitMs = 0 } = {}) {
  if (!decision.options?.length || !decision.criteria?.length) throw AI_UNAVAILABLE;
  const system =
    'You help rate options against criteria. Reply ONLY with JSON, no prose. ' +
    'Schema: {"ratings":[{"option":"exact option name","criterion":"exact criterion name","score":0-5}]}. ' +
    '0 = unacceptable, 2.5 = middling, 5 = excellent; decimals allowed. ' +
    'Only include a cell when general knowledge supports a rating. ' +
    'OMIT any cell that depends on the user\'s private situation — do not guess.';
  const user =
    `${frameText(decision)}\nOptions:\n${optionsText(decision)}\n\nCriteria:\n${criteriaText(decision)}\n` +
    'Rate the cells you reasonably can, using exact option and criterion names.';

  const raw = await complete(system, user, { waitMs });
  const data = parseJson(raw);
  const list = Array.isArray(data) ? data : data.ratings;
  if (!Array.isArray(list)) throw AI_UNAVAILABLE;

  const optByName = new Map(decision.options.map((o) => [o.name.trim().toLowerCase(), o.id]));
  const critByName = new Map(decision.criteria.map((c) => [c.name.trim().toLowerCase(), c.id]));

  const result = {}; // `${optionId}-${criterionId}` -> 0..5
  for (const item of list) {
    const oName = typeof item?.option === 'string' ? item.option.trim().toLowerCase() : '';
    const cName = typeof item?.criterion === 'string' ? item.criterion.trim().toLowerCase() : '';
    const optionId = optByName.get(oName);
    const criterionId = critByName.get(cName);
    if (optionId == null || criterionId == null) continue;
    const score = clampNum(item?.score, 0, 5);
    if (score == null) continue;
    result[`${optionId}-${criterionId}`] = Math.round(score * 10) / 10;
  }
  if (Object.keys(result).length === 0) throw AI_UNAVAILABLE;
  return result;
}

/* --------------------------------------------------------------------------
   Task: concise option description (kept intentionally short)
   Returns a single short string or throws AI_UNAVAILABLE.
   -------------------------------------------------------------------------- */
export async function aiOptionDescription(decision, optionName, { waitMs = 0 } = {}) {
  const name = (optionName || '').trim();
  if (!name) throw AI_UNAVAILABLE;
  const system =
    'Reply ONLY with JSON: {"description":"string"}. ' +
    'Write ONE concise phrase (max ~12 words) describing the option in this ' +
    'decision context. No marketing, no full sentence needed.';
  const user = `${frameText(decision)}\nOption: "${name}".\nGive a concise description.`;

  const raw = await complete(system, user, { waitMs });
  const data = parseJson(raw);
  const description = typeof data?.description === 'string' ? data.description.trim() : '';
  if (!description) throw AI_UNAVAILABLE;
  return description.slice(0, 250);
}

/* --------------------------------------------------------------------------
   Task: sanity-check the computed result (Results tab)
   `analysis` is the caller's structured summary (ranking, weights, drivers).
   Returns a short plain-text critique string, or throws AI_UNAVAILABLE.
   -------------------------------------------------------------------------- */
export async function aiSanityCheck(decision, analysis, { waitMs = 0 } = {}) {
  const system =
    'You are a decision-analysis reviewer. Reply ONLY with JSON: ' +
    '{"critique":"string"}. In 2-4 short sentences, point out blind spots, ' +
    'missing criteria, possible bias, or whether the top choices are effectively ' +
    'tied. React only to the numbers given; do not invent facts about the options.';
  const user =
    `${frameText(decision)}\n\nComputed analysis (JSON):\n${JSON.stringify(analysis)}\n` +
    'Give a brief, honest sanity check.';

  const raw = await complete(system, user, { waitMs, temperature: 0.5 });
  const data = parseJson(raw);
  const critique = typeof data?.critique === 'string' ? data.critique.trim() : '';
  if (!critique) throw AI_UNAVAILABLE;
  return critique;
}
