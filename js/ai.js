/* ==========================================================================
   Choicease — ai.js  (v2)
   The single seam between the app and on-device AI.

   Engine: Transformers.js (Hugging Face) running Qwen2.5-0.5B-Instruct in
   ONNX. Unlike WebGPU-only runtimes, Transformers.js uses WebGPU when it is
   actually usable and falls back to a WASM (CPU) backend everywhere else — so
   this works on Safari, Chrome, Firefox, and mobile, not just Chrome desktop.
   The model downloads once (~0.4 GB at q4) from the Hugging Face CDN and is
   cached by the browser; nothing the user types ever leaves the device.

   Nothing else in the app imports the AI library directly; everything goes
   through the functions here. Every task function either returns clean,
   validated data or throws AI_UNAVAILABLE, so callers fall back to the
   existing non-AI path with a single catch.

   v2 changes (field-tested against v1):
   - Index-based schemas for weights and ratings: the model answers with
     criterion/option NUMBERS, not names. Small models frequently paraphrase
     names ("Team & culture" → "Team and culture"), which made v1's exact-name
     matching fail all-or-nothing; numbers match exactly and the replies are
     5–10× shorter, so seeds land while the user is still on the tab.
   - Stale-job cancellation: every task accepts a `cancelIf` probe that is
     checked before its turn in the generation queue. A job whose window has
     already closed (user left the tab, decision changed) is skipped instead
     of burning minutes of CPU and starving everything queued behind it.
   - Criteria suggestions must carry a concise description (like the regex
     starter sets); items without one are dropped.
   - New task: missing-options suggestions for the results page.
   - Removed: option-description drafting (retired from the product).
   ========================================================================== */

/* Transformers.js is loaded from jsDelivr as an ES module, on demand. If the
   import fails (offline, blocked) we degrade silently to non-AI. */
const TRANSFORMERS_SRC = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';

/* Qwen2.5-0.5B-Instruct (ONNX, q4): the configuration proven to work on
   Safari, mobile, and desktop. ~0.4 GB, fast enough on the WASM (CPU) backend
   to run everywhere. For noticeably better judgement on capable devices,
   'onnx-community/Qwen2.5-1.5B-Instruct' is a drop-in swap (~1 GB, heavier on
   mobile/WASM). */
const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
const MODEL_DTYPE = 'q4';

/* Sentinel thrown whenever AI cannot serve a request for any reason. Callers
   match on this (or simply catch) to fall back to the existing regex/default
   behaviour. */
export const AI_UNAVAILABLE = 'AI_UNAVAILABLE';

/* Safety net: the AI library can spawn internal promises we don't directly
   await; if one rejects it can surface as an "Unhandled Promise Rejection" in
   the console even though the app handles the failure via status flags. We
   swallow only AI/WASM-related rejections here so they don't alarm users,
   while leaving all other app errors untouched. Registered once; never
   rethrows. */
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
   'failed'    — unavailable this session (may be retried via retryAiLoad) */
const state = {
  status: 'idle',
  generator: null,
  loadPromise: null,
  progress: 0, // 0..1, best-effort
};

/* Listeners for load-progress (kept for diagnostics / future use). Each is
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
   capability check (WebAssembly present). */
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

      // Prefer WebGPU when an adapter is actually obtainable, but always keep
      // WASM as the second attempt: some browsers expose navigator.gpu while
      // their WebGPU support is incomplete, and a failed WebGPU init must not
      // take the whole engine down with it.
      const tryDevices = [];
      try {
        if (typeof navigator !== 'undefined' && navigator.gpu
            && await navigator.gpu.requestAdapter()) {
          tryDevices.push('webgpu');
        }
      } catch { /* no usable WebGPU */ }
      tryDevices.push('wasm');

      const progress_callback = (p) => {
        if (p && p.status === 'progress' && p.total) {
          state.progress = Math.max(0, Math.min(1, p.loaded / p.total));
          emitProgress();
        }
      };

      let generator = null;
      let lastErr = null;
      for (const device of tryDevices) {
        try {
          // Keep heavy WASM inference off the main thread (ORT proxy worker)
          // so typing and scrolling never jam while the model thinks. The
          // proxy does not apply to — and can conflict with — the WebGPU
          // path, so it is enabled for the WASM attempt only.
          try { T.env.backends.onnx.wasm.proxy = (device === 'wasm'); } catch { /* older builds */ }
          generator = await T.pipeline('text-generation', MODEL_ID, {
            dtype: MODEL_DTYPE,
            device,
            progress_callback,
          });
          break;
        } catch (err) {
          lastErr = err;
          generator = null;
        }
      }
      if (!generator) throw lastErr || new Error('AI engine could not initialize');

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

/* A failed load (e.g. the user was offline) may be retried a couple of times
   — the orchestrator calls this when the browser comes back online. */
let retriesLeft = 2;

export function retryAiLoad() {
  if (state.status === 'ready') return Promise.resolve(true);
  if (state.status !== 'failed' || retriesLeft <= 0) return Promise.resolve(false);
  retriesLeft -= 1;
  state.status = 'idle';
  state.loadPromise = null;
  return ensureAiLoading();
}

/* --------------------------------------------------------------------------
   Low-level request helper
   -------------------------------------------------------------------------- */

/* Generations are serialized: background tasks (chips, weights, ratings,
   sanity check, missing options) queue up rather than competing for the CPU.
   Stale jobs cancel themselves before their turn, so the queue keeps moving. */
let generationQueue = Promise.resolve();

function serialize(job) {
  const run = generationQueue.then(job, job);
  generationQueue = run.catch(() => { /* keep the chain alive */ });
  return run;
}

/**
 * Run a single-turn chat completion and return the raw string content.
 * Throws AI_UNAVAILABLE if the engine isn't ready or the call fails.
 * `waitMs` optionally allows waiting for an in-flight load to finish; by
 * default we do NOT wait (callers that can't block pass 0).
 * `cancelIf` is a cheap probe checked before the job runs (including right
 * before its turn in the queue): return true to skip the generation entirely.
 */
async function complete(system, user, { waitMs = 0, maxNewTokens = 320, cancelIf = null } = {}) {
  const cancelled = () => {
    try { return !!(cancelIf && cancelIf()); } catch { return false; }
  };
  if (cancelled()) throw AI_UNAVAILABLE;

  if (state.status !== 'ready') {
    if (waitMs > 0 && state.status === 'loading' && state.loadPromise) {
      const timeout = new Promise((res) => setTimeout(() => res(false), waitMs));
      const ok = await Promise.race([state.loadPromise, timeout]);
      if (!ok || state.status !== 'ready') throw AI_UNAVAILABLE;
    } else {
      throw AI_UNAVAILABLE;
    }
  }
  if (cancelled()) throw AI_UNAVAILABLE;

  try {
    const out = await serialize(() => {
      // The queue may have held this job for a while — a last look before
      // spending real compute on it.
      if (cancelled()) throw AI_UNAVAILABLE;
      return state.generator(
        [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        { max_new_tokens: maxNewTokens, do_sample: false, return_full_text: false },
      );
    });
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

/* Small helpers for describing a decision to the model. Numbered lists give
   the model stable indices to answer with — names never need to round-trip. */
function optionsText(decision) {
  return (decision.options || [])
    .map((o) => `- ${o.name}${o.description ? ` (${o.description})` : ''}`)
    .join('\n');
}
function numberedOptions(decision) {
  return (decision.options || [])
    .map((o, i) => `${i + 1}. ${o.name}${o.description ? ` (${o.description})` : ''}`)
    .join('\n');
}
function numberedCriteria(decision) {
  return (decision.criteria || [])
    .map((c, i) => `${i + 1}. ${c.name}${c.description ? ` (${c.description})` : ''}`)
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
   Returns { label, criteria: [{ name, description }] } (3..7 items), shaped
   exactly like a STARTER_CRITERIA entry so the existing chip renderer can use
   it unchanged. Every item must carry a concise description — like the regex
   starter sets — or it is dropped. Throws AI_UNAVAILABLE otherwise.
   -------------------------------------------------------------------------- */
export async function aiCriteria(decision, { waitMs = 0, cancelIf = null } = {}) {
  const system =
    'You help structure decisions. Reply ONLY with JSON, no prose. ' +
    'Schema: {"label":"2-3 word decision type","criteria":[{"name":"2-4 words","description":"what it measures, under 8 words"}]}. ' +
    'Give 5 to 7 criteria that genuinely differentiate the specific options listed. ' +
    'Every criterion needs a description. Never restate an option as a criterion. ' +
    'Example: {"label":"laptop purchase","criteria":[{"name":"Battery life","description":"Hours away from a socket"},{"name":"Build quality","description":"Durability and finish"}]}';
  const user =
    `${frameText(decision)}\n` +
    `${decision.options?.length ? `Options being compared:\n${optionsText(decision)}\n` : ''}` +
    'Suggest criteria to judge the options on.';

  const raw = await complete(system, user, { waitMs, cancelIf, maxNewTokens: 360 });
  const data = parseJson(raw);
  const list = Array.isArray(data) ? data : data.criteria;
  if (!Array.isArray(list)) throw AI_UNAVAILABLE;

  const out = [];
  const seen = new Set();
  for (const item of list) {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    const description = typeof item?.description === 'string' ? item.description.trim() : '';
    if (!name || !description) continue; // description is required, like the regex sets
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: name.slice(0, 100), description: description.slice(0, 250) });
    if (out.length >= 7) break;
  }
  if (out.length < 3) throw AI_UNAVAILABLE;

  const rawLabel = !Array.isArray(data) && typeof data?.label === 'string' ? data.label.trim() : '';
  const label = rawLabel ? rawLabel.replace(/["'`]/g, '').slice(0, 28) : 'tricky';
  return { label, criteria: out };
}

/* --------------------------------------------------------------------------
   Task: default importance weights (Tab 4 seeding)
   The model answers with criterion NUMBERS, so a paraphrased name can never
   break the match, and the reply is a few dozen tokens. Returns
   { [criterionId]: 1..5 }; criteria the model skipped keep their flat default.
   Throws AI_UNAVAILABLE when fewer than half (min 2) are usable.
   -------------------------------------------------------------------------- */
export async function aiWeights(decision, { waitMs = 0, cancelIf = null } = {}) {
  const n = decision.criteria?.length || 0;
  if (n < 2) throw AI_UNAVAILABLE;
  const system =
    'You assign importance to decision criteria. Reply ONLY with JSON, no prose. ' +
    'Schema: {"weights":[{"i":<criterion number>,"v":<importance 1-5>}]}. ' +
    '1 = marginal, 3 = moderate, 5 = critical. Rate every numbered criterion. ' +
    'Differentiate: most decisions have one or two critical criteria and some minor ones. ' +
    'Example for 3 criteria: {"weights":[{"i":1,"v":5},{"i":2,"v":3},{"i":3,"v":2}]}';
  const user =
    `${frameText(decision)}\nCriteria:\n${numberedCriteria(decision)}\n` +
    `Give v for each i from 1 to ${n}.`;

  const raw = await complete(system, user, { waitMs, cancelIf, maxNewTokens: Math.min(220, 24 + n * 14) });
  const data = parseJson(raw);
  const list = Array.isArray(data) ? data : data.weights;
  if (!Array.isArray(list)) throw AI_UNAVAILABLE;

  const result = {}; // { criterionId: 1..5 }
  let matched = 0;
  for (const item of list) {
    const idx = clampInt(item?.i, 1, n, null);
    const v = clampInt(item?.v, 1, 5, null);
    if (idx == null || v == null) continue;
    const criterion = decision.criteria[idx - 1];
    if (!criterion || criterion.id in result) continue;
    result[criterion.id] = v;
    matched += 1;
  }
  if (matched < Math.max(2, Math.ceil(n / 2))) throw AI_UNAVAILABLE;
  return result;
}

/* --------------------------------------------------------------------------
   Task: default option ratings (Tab 5 seeding)
   Numbered options AND criteria; the model replies with tiny {o,c,v}
   triplets, so a full matrix costs a few hundred tokens at most. Returns
   { `${optionId}-${criterionId}`: 0..5 } for cells where general knowledge
   plausibly applies; omitted cells stay at the app's honest midpoint default.
   Throws only if nothing usable came back.
   -------------------------------------------------------------------------- */
export async function aiRatings(decision, { waitMs = 0, cancelIf = null } = {}) {
  const O = decision.options?.length || 0;
  const C = decision.criteria?.length || 0;
  if (!O || C < 2) throw AI_UNAVAILABLE;
  const system =
    'You rate options against criteria. Reply ONLY with JSON, no prose. ' +
    'Schema: {"ratings":[{"o":<option number>,"c":<criterion number>,"v":<score 0-5>}]}. ' +
    '0 = unacceptable, 2.5 = middling, 5 = excellent; decimals allowed. ' +
    'Include a cell ONLY when general knowledge supports it; ' +
    'OMIT any cell that depends on the user\'s private situation — do not guess. ' +
    'Example: {"ratings":[{"o":1,"c":2,"v":4},{"o":2,"c":1,"v":2.5}]}';
  const user =
    `${frameText(decision)}\nOptions:\n${numberedOptions(decision)}\n\nCriteria:\n${numberedCriteria(decision)}\n` +
    'Rate the cells you reasonably can.';

  const budget = Math.min(640, 32 + O * C * 10);
  const raw = await complete(system, user, { waitMs, cancelIf, maxNewTokens: budget });
  const data = parseJson(raw);
  const list = Array.isArray(data) ? data : data.ratings;
  if (!Array.isArray(list)) throw AI_UNAVAILABLE;

  const result = {}; // `${optionId}-${criterionId}` -> 0..5
  for (const item of list) {
    const oIdx = clampInt(item?.o, 1, O, null);
    const cIdx = clampInt(item?.c, 1, C, null);
    const score = clampNum(item?.v, 0, 5);
    if (oIdx == null || cIdx == null || score == null) continue;
    const option = decision.options[oIdx - 1];
    const criterion = decision.criteria[cIdx - 1];
    if (!option || !criterion) continue;
    result[`${option.id}-${criterion.id}`] = Math.round(score * 10) / 10;
  }
  if (Object.keys(result).length === 0) throw AI_UNAVAILABLE;
  return result;
}

/* --------------------------------------------------------------------------
   Task: missing-options suggestions (Results tab)
   Suggests up to 3 strong options people commonly consider for a decision
   like this that are NOT on the user's list. An empty array is a valid,
   honest answer ("nothing worth adding") and is returned as [] rather than
   thrown, so the caller simply shows nothing.
   -------------------------------------------------------------------------- */
export async function aiMissingOptions(decision, { waitMs = 0, cancelIf = null } = {}) {
  if (!decision.options?.length) throw AI_UNAVAILABLE;
  const system =
    'You spot strong alternatives for a decision. Reply ONLY with JSON, no prose. ' +
    'Schema: {"missing":[{"name":"2-5 words","why":"one short reason, under 10 words"}]}. ' +
    'Suggest at most 3 options people commonly weigh for this kind of decision ' +
    'that are NOT already on the list. Only genuinely strong, distinct candidates. ' +
    'If nothing worthwhile is missing, reply {"missing":[]}.';
  const user =
    `${frameText(decision)}\nOptions already on the list:\n${optionsText(decision)}\n` +
    `${decision.criteria?.length ? `Judged on:\n${numberedCriteria(decision)}\n` : ''}` +
    'Which strong options are missing, if any?';

  const raw = await complete(system, user, { waitMs, cancelIf, maxNewTokens: 160 });
  const data = parseJson(raw);
  const list = Array.isArray(data) ? data : data.missing;
  if (!Array.isArray(list)) throw AI_UNAVAILABLE;

  const existing = new Set(
    (decision.options || []).map((o) => o.name.trim().toLowerCase()),
  );
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    const why = typeof item?.why === 'string' ? item.why.trim() : '';
    if (!name) continue;
    const key = name.toLowerCase();
    if (existing.has(key) || seen.has(key)) continue; // never re-suggest listed options
    seen.add(key);
    out.push({ name: name.slice(0, 100), why: why.slice(0, 120) });
    if (out.length >= 3) break;
  }
  return out; // possibly [] — a valid "nothing to add"
}

/* --------------------------------------------------------------------------
   Task: sanity-check the computed result (Results tab)
   `analysis` is the caller's structured digest (ranking, weights, confidence).
   Returns a short plain-text critique string, or throws AI_UNAVAILABLE.
   -------------------------------------------------------------------------- */
export async function aiSanityCheck(decision, analysis, { waitMs = 0, cancelIf = null } = {}) {
  const system =
    'You are a decision-analysis reviewer. Reply ONLY with JSON: ' +
    '{"critique":"string"}. In 2-3 short sentences, point out blind spots, ' +
    'missing criteria, possible bias, or whether the top choices are effectively ' +
    'tied. React only to the numbers given; do not invent facts about the options.';
  const user =
    `${frameText(decision)}\n\nComputed analysis (JSON):\n${JSON.stringify(analysis)}\n` +
    'Give a brief, honest sanity check.';

  const raw = await complete(system, user, { waitMs, cancelIf, maxNewTokens: 200 });
  const data = parseJson(raw);
  const critique = typeof data?.critique === 'string' ? data.critique.trim() : '';
  if (!critique) throw AI_UNAVAILABLE;
  return critique;
}
