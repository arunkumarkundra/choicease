/* ==========================================================================
   Choicease — ai.js
   The single seam between the app and on-device AI.

   Engine: Transformers.js (Hugging Face) running Qwen2.5-1.5B-Instruct in ONNX.
   Unlike WebGPU-only runtimes, Transformers.js uses WebGPU when available and
   falls back to a WASM (CPU) backend everywhere else — so this works on Safari,
   Chrome, Firefox, and mobile, not just Chrome desktop. The model downloads
   once (~1GB at q4) from the Hugging Face CDN and is cached by the browser;
   nothing the user types ever leaves the device.

   Nothing else in the app imports the AI library directly; everything goes
   through the functions here. Every task function either returns clean,
   validated data or throws AI_UNAVAILABLE, so callers fall back to the existing
   non-AI path with a single try/catch.

   Design rules honoured here:
   - Lazy + non-blocking: the model loads in the background; callers that need a
     result "now" get AI_UNAVAILABLE if it isn't ready yet, and fall back.
   - Structured: the model is always asked for strict JSON; we parse defensively
     and reject anything malformed rather than guess.
   ========================================================================== */

/* Transformers.js is loaded from jsDelivr as an ES module, on demand. If the
   import fails (offline, blocked) we degrade silently to non-AI. */
const TRANSFORMERS_SRC = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';

/* Qwen2.5-1.5B-Instruct (ONNX, q4): a good quality/size balance for on-device
   use — strong enough for criteria/weights/ratings suggestions while staying
   small enough (~1GB) to run under the WASM backend on mobile. To trade quality
   for a smaller/faster download, switch to 'onnx-community/Qwen2.5-0.5B-Instruct'. */
const MODEL_ID = 'onnx-community/Qwen2.5-1.5B-Instruct';
const MODEL_DTYPE = 'q4';

/* Sentinel thrown whenever AI cannot serve a request for any reason. Callers
   match on this to fall back to the existing regex/default behaviour. */
export const AI_UNAVAILABLE = 'AI_UNAVAILABLE';

/* Safety net: the AI library can spawn internal promises we don't directly
   await; if one rejects it can surface as an "Unhandled Promise Rejection" in
   the console even though the app handles the failure via status flags. We
   swallow only AI/WASM-related rejections here so they don't alarm users, while
   leaving all other app errors untouched. Registered once and never rethrows. */
if (typeof window !== 'undefined' && !window.__choiceaseAiRejectionGuard) {
  window.__choiceaseAiRejectionGuard = true;
  window.addEventListener('unhandledrejection', (event) => {
    const msg = String(event?.reason?.message || event?.reason || '');
    if (/transformers|onnx|wasm|webgpu|ort-|std::string|BindingError/i.test(msg)) {
      try { console.warn('[Choicease AI] suppressed model error:', msg); } catch { /* ignore */ }
      event.preventDefault();
    }
  });
}

/* Engine lifecycle state. `status` is one of:
   'idle'      — never started
   'loading'   — model is downloading / initializing
   'ready'     — usable
   'failed'    — permanently unavailable this session */
const state = {
  status: 'idle',
  generator: null,
  loadPromise: null,
  progress: 0, // 0..1, best-effort
};

/* Listeners for load-progress UI (e.g. the "warming up" indicator). Each is
   called with { status, progress }. Registration returns an unsubscribe fn. */
const progressListeners = new Set();

export function onAiProgress(listener) {
  progressListeners.add(listener);
  try { listener({ status: state.status, progress: state.progress }); } catch { /* ignore */ }
  return () => progressListeners.delete(listener);
}

function emitProgress() {
  for (const listener of progressListeners) {
    try { listener({ status: state.status, progress: state.progress }); } catch { /* ignore */ }
  }
}

/* Transformers.js runs on a WASM backend when WebGPU is absent, so AI is
   effectively supported on any modern browser. We keep this as a light
   capability check (secure context + WebAssembly present). */
export function aiSupported() {
  return typeof WebAssembly !== 'undefined';
}

export function aiStatus() {
  return state.status;
}

export function aiReady() {
  return state.status === 'ready' && state.generator != null;
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
      const T = await import(TRANSFORMERS_SRC);
      // Only load remote models from the HF hub; never look for local files.
      if (T?.env) T.env.allowLocalModels = false;

      // Prefer WebGPU when actually usable; otherwise fall back to WASM (CPU).
      let device = 'wasm';
      try {
        if (typeof navigator !== 'undefined' && navigator.gpu
            && await navigator.gpu.requestAdapter()) {
          device = 'webgpu';
        }
      } catch { /* keep wasm */ }

      const generator = await T.pipeline('text-generation', MODEL_ID, {
        dtype: MODEL_DTYPE,
        device,
        progress_callback: (p) => {
          if (p && p.status === 'progress' && p.total) {
            state.progress = Math.max(0, Math.min(1, p.loaded / p.total));
            emitProgress();
          }
        },
      });

      state.generator = generator;
      state.status = 'ready';
      state.progress = 1;
      emitProgress();
      return true;
    } catch (err) {
      // AI is optional; the app falls back to non-AI. We log (not throw) so a
      // failure is diagnosable in the console without affecting the app.
      try { console.warn('[Choicease AI] model load failed:', err); } catch { /* ignore */ }
      state.generator = null;
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
async function complete(system, user, { waitMs = 0, maxNewTokens = 320 } = {}) {
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
    const out = await state.generator(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { max_new_tokens: maxNewTokens, do_sample: false, return_full_text: false },
    );
    // Transformers.js returns [{ generated_text: [...messages] | string }].
    let text = out;
    if (Array.isArray(out)) text = out[0] && out[0].generated_text;
    if (Array.isArray(text)) {
      const last = text[text.length - 1];
      text = last && last.content;
    }
    text = String(text || '');
    if (!text.trim()) throw AI_UNAVAILABLE;
    return text;
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
