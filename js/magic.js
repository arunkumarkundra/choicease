/* ==========================================================================
   Choicease — magic.js
   The invisible conductor between the app and the on-device AI engine.

   Everything here is a courtesy, never a dependency: every path is wrapped so
   that when AI is loading, unsupported, offline, or wrong, the app behaves
   exactly as it does today (regex chips, flat weights, midpoint ratings, no
   critique). The user never clicks anything, never waits for anything, and
   never sees a broken or empty state.

   The one law for Tabs 4 & 5 — initiation only, never revision — is enforced
   twice:
   1. Gates in state.js: seeding is armed only for a brand-new decision,
      disarmed the moment the user edits that kind of value, and disarmed for
      every imported / shared / resumed decision. The gate is consumed when
      the user leaves the tab: AI proposes a starting point once, then stays
      out.
   2. Blank-slate invariants: even with an armed gate, weights are seeded only
      while every weight is still the flat default (3), and ratings only while
      not a single rating has been stored. AI only ever writes on a blank
      slate.
   ========================================================================== */

import {
  decision, getDecisionEpoch, canSeed, consumeSeed,
  applySeededWeights, applySeededRatings, applyDraftedDescription,
} from './state.js';
import {
  aiSupported, ensureAiLoading, retryAiLoad,
  aiCriteria, aiWeights, aiRatings, aiOptionDescription, aiSanityCheck,
} from './ai.js';

/* Background tasks may wait a long time for the model to finish downloading —
   validity is re-checked at application time, so waiting is harmless. */
const WAIT_LONG = 300000; // 5 min — first-visit model download can be slow
const WAIT_MED = 120000;

/* ------------------------------ Enablement ------------------------------- */

/** AI is silently skipped on unsupported browsers, when the user has asked
    the browser to save data, or on clearly constrained devices. Everything
    then behaves exactly as the app does today. */
function enabled() {
  if (!aiSupported()) return false;
  try {
    const conn = navigator.connection;
    if (conn?.saveData) return false;
    if (conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return false;
    if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory < 2) return false;
  } catch { /* fingerprint-resistant browsers: assume capable */ }
  return true;
}

function kickLoad() {
  if (enabled()) ensureAiLoading();
}

/** Called once from boot. Starts the model download in idle time so it never
    competes with the app's own startup, and retries once or twice if the
    browser was offline and comes back. */
export function initMagic() {
  if (!enabled()) return;
  const start = () => ensureAiLoading();
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(start, { timeout: 6000 });
  } else {
    setTimeout(start, 2500);
  }
  try {
    window.addEventListener('online', () => { if (enabled()) retryAiLoad(); });
  } catch { /* non-browser environment (tests) */ }
}

/* --------------------------- Step choreography --------------------------- */

let currentStep = 0;
let lastEpoch = -1;
let renderers = {}; // { rerenderWeights, rerenderRatings }

/**
 * Called by the wizard on every step change, BEFORE the step renders — so a
 * synchronous seed (cached ratings) lands in state first and the normal
 * render simply shows it: no flicker, no second paint.
 */
export function magicStepChange(step, stepRenderers = {}) {
  const prev = currentStep;
  currentStep = step;
  renderers = { ...renderers, ...stepRenderers };

  const epoch = getDecisionEpoch();
  const sameDecision = epoch === lastEpoch;
  if (!sameDecision) {
    // A new decision began while we were standing somewhere (e.g. "Start
    // afresh" re-arms the gates and *then* navigates home). The tab we are
    // leaving belonged to the previous decision, so its exit must not
    // consume the new decision's one-time windows — and no cached result
    // from the old decision may ever leak into the new one.
    lastEpoch = epoch;
    ratingsCache = { fp: null, map: null };
    chipsCache = { fp: null, set: null };
    sanityCache = { fp: null, text: null };
  }

  if (step >= 2) kickLoad(); // the user is invested; warm the engine

  // Initiation only: the one-time window for a tab closes when the user
  // leaves it. After that, AI stays out — even if a result arrives later.
  if (sameDecision) {
    if (prev === 4 && step !== 4) consumeSeed('weights');
    if (prev === 5 && step !== 5) consumeSeed('ratings');
  }

  if (step === 4) beginWeightsSeed();
  if (step === 5) beginRatingsSeed();
}

/* --------------------- Tab 4 — default weights seeding ------------------- */

let weightsSeq = 0;

function weightsAreFlatDefault() {
  return decision.criteria.length >= 2
    && decision.criteria.every((c) => (decision.weights[c.id] || 3) === 3);
}

function beginWeightsSeed() {
  if (!enabled() || !canSeed('weights')) return;
  if (!weightsAreFlatDefault()) return; // blank-slate invariant

  const epoch = getDecisionEpoch();
  const mySeq = ++weightsSeq;
  kickLoad();

  aiWeights(decision, { waitMs: WAIT_LONG })
    .then((map) => {
      if (mySeq !== weightsSeq) return;               // superseded
      if (epoch !== getDecisionEpoch()) return;       // decision was replaced
      if (currentStep !== 4) return;                  // window closed
      if (!canSeed('weights')) return;                // the user took over
      if (applySeededWeights(map) > 0 && typeof renderers.rerenderWeights === 'function') {
        renderers.rerenderWeights();
      }
    })
    .catch(() => { /* silent fallback: flat defaults stay */ });

  // The user will weigh for a little while — pre-think their ratings so
  // Tab 5 can open already seeded. (Options and criteria are final by now.)
  prefetchRatings();
}

/* --------------------- Tab 5 — default ratings seeding ------------------- */

let ratingsCache = { fp: null, map: null };
let ratingsInflight = null;

const norm = (s) => String(s || '').trim().toLowerCase();

function ratingsFingerprint() {
  return JSON.stringify([
    norm(decision.title),
    decision.options.map((o) => [o.id, norm(o.name)]),
    decision.criteria.map((c) => [c.id, norm(c.name)]),
  ]);
}

function ratingsAreBlank() {
  return Object.keys(decision.ratings || {}).length === 0;
}

function prefetchRatings() {
  if (!enabled() || !canSeed('ratings') || !ratingsAreBlank()) return;
  if (!decision.options.length || decision.criteria.length < 2) return;
  const fp = ratingsFingerprint();
  if (ratingsCache.fp === fp || ratingsInflight === fp) return;
  ratingsInflight = fp;
  const epoch = getDecisionEpoch();
  kickLoad();

  aiRatings(decision, { waitMs: WAIT_LONG })
    .then((map) => {
      if (epoch !== getDecisionEpoch()) return;
      if (ratingsFingerprint() !== fp) return; // options/criteria edited since
      ratingsCache = { fp, map };
      // If the user is already sitting on Tab 5, untouched, apply live.
      if (currentStep === 5 && canSeed('ratings') && ratingsAreBlank()) {
        if (applySeededRatings(map) > 0 && typeof renderers.rerenderRatings === 'function') {
          renderers.rerenderRatings();
        }
      }
    })
    .catch(() => { /* silent fallback: midpoint defaults stay */ })
    .finally(() => { if (ratingsInflight === fp) ratingsInflight = null; });
}

function beginRatingsSeed() {
  if (!enabled() || !canSeed('ratings') || !ratingsAreBlank()) return;
  const fp = ratingsFingerprint();
  if (ratingsCache.fp === fp && ratingsCache.map) {
    // Prefetched on Tab 4 — apply synchronously; the render that follows
    // this call simply shows the seeded values. Zero flicker.
    applySeededRatings(ratingsCache.map);
    return;
  }
  prefetchRatings(); // arrival path above applies live if still on Tab 5
}

/* ------------------ Tab 3 — AI starter-criteria fallback ----------------- */

let chipsCache = { fp: null, set: null };
let chipsInflight = null;
let chipsOnReady = null;

/**
 * Synchronous by design: returns a cached AI starter set for the current
 * title (shaped exactly like a STARTER_CRITERIA entry), or null. When null
 * and worth trying, it quietly starts one generation; `onReady` re-renders
 * the chips when the set is available. Regex remains first priority — the
 * wizard only calls this when suggestStarterSet() found no match — and the
 * chips look identical either way.
 */
export function aiStarterSet(dec, onReady) {
  if (!enabled()) return null;
  if ((dec.criteria?.length || 0) >= 3) return null; // same bar as regex chips
  const fp = norm(dec.title);
  if (!fp || fp.length < 8) return null; // too little signal to be useful

  if (chipsCache.fp === fp) return chipsCache.set;

  chipsOnReady = typeof onReady === 'function' ? onReady : null;
  if (chipsInflight !== fp) {
    chipsInflight = fp;
    kickLoad();
    aiCriteria(dec, { waitMs: WAIT_LONG })
      .then((set) => {
        if (norm(decision.title) !== fp) return; // title changed meanwhile
        chipsCache = { fp, set };
        if (chipsOnReady) chipsOnReady();
      })
      .catch(() => { /* silent fallback: no chips, exactly as today */ })
      .finally(() => { if (chipsInflight === fp) chipsInflight = null; });
  }
  return null;
}

/* --------------- Tab 2 — concise option description drafting ------------- */

let descJobs = 0;

/**
 * Drafts a short description for the most recently added option, only when
 * the user left the description blank. Applied only if, by the time the
 * draft is ready, the option still exists, still has the same name, and its
 * description is still empty — a filled or edited field is never overwritten.
 */
export function draftNewestOptionDescription(onApplied) {
  if (!enabled()) return;
  const option = decision.options[decision.options.length - 1];
  if (!option || option.description) return;
  if (descJobs >= 3) return; // don't pile up work during rapid entry
  descJobs += 1;
  const snap = { id: option.id, name: option.name, epoch: getDecisionEpoch() };
  kickLoad();

  aiOptionDescription(decision, snap.name, { waitMs: WAIT_MED })
    .then((text) => {
      if (snap.epoch !== getDecisionEpoch()) return;
      if (applyDraftedDescription(snap.id, snap.name, text) && typeof onApplied === 'function') {
        onApplied();
      }
    })
    .catch(() => { /* silent: the field simply stays blank, as today */ })
    .finally(() => { descJobs -= 1; });
}

/* ------------------- Results tab — silent sanity check ------------------- */

let sanitySeq = 0;
let sanityCache = { fp: null, text: null };

/**
 * Asks the model for a brief critique of the computed result. `digest` is a
 * compact, structured summary built by the results layer; `onText` receives
 * the critique only if this request is still the latest one (the user hasn't
 * recomputed since). Identical results reuse the cached critique instantly.
 */
export function requestSanityCheck(dec, digest, onText) {
  if (!enabled() || typeof onText !== 'function') return;
  const fp = JSON.stringify(digest);
  const mySeq = ++sanitySeq;

  if (sanityCache.fp === fp && sanityCache.text) {
    onText(sanityCache.text);
    return;
  }
  kickLoad();

  aiSanityCheck(dec, digest, { waitMs: WAIT_LONG })
    .then((text) => {
      const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 420);
      if (!clean) return;
      sanityCache = { fp, text: clean };
      if (mySeq === sanitySeq) onText(clean);
    })
    .catch(() => { /* silent: the results page is complete without it */ });
}
