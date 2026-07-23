/* ==========================================================================
   Choicease — magic.js  (v2)
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

   v2: every task hands the engine a `cancelIf` probe describing when its
   result would no longer be wanted. The engine checks it right before the
   task's turn in the generation queue, so a job whose window has closed is
   skipped instead of burning minutes of CPU and starving the tasks behind it
   — the failure mode that kept v1's seeds and sanity check from ever landing
   on slower devices. Also new: missing-options suggestions for the results
   page. Removed: option-description drafting.
   ========================================================================== */

import {
  decision, getDecisionEpoch, canSeed, consumeSeed,
  applySeededWeights, applySeededRatings,
} from './state.js';
import {
  aiSupported, ensureAiLoading, retryAiLoad,
  aiCriteria, aiWeights, aiRatings, aiSanityCheck, aiMissingOptions,
} from './ai.js';

/* Background tasks may wait a long time for the model to finish downloading —
   validity is re-checked at application time, so waiting is harmless. */
const WAIT_LONG = 300000; // 5 min — first-visit model download can be slow

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
    missingCache = { fp: null, list: null };
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

  // The result is wanted only while the user is still standing, untouched,
  // on their first visit to Tab 4 of this very decision.
  const stillWanted = () => mySeq === weightsSeq
    && epoch === getDecisionEpoch()
    && currentStep === 4
    && canSeed('weights');

  aiWeights(decision, { waitMs: WAIT_LONG, cancelIf: () => !stillWanted() })
    .then((map) => {
      if (!stillWanted()) return;
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

  // A prefetch stays wanted while the user is anywhere in this decision's
  // flow (they haven't rated anything and the inputs haven't changed) — it
  // is NOT tied to being on Tab 5, that's the whole point of prefetching.
  const stillWanted = () => epoch === getDecisionEpoch()
    && canSeed('ratings')
    && ratingsAreBlank()
    && ratingsFingerprint() === fp;

  aiRatings(decision, { waitMs: WAIT_LONG, cancelIf: () => !stillWanted() })
    .then((map) => {
      if (!stillWanted()) return;
      ratingsCache = { fp, map };
      // If the user is already sitting on Tab 5, untouched, apply live.
      if (currentStep === 5) {
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

    // Chips are wanted only while this is still the title and the user
    // hasn't already assembled three criteria of their own.
    const stillWanted = () => norm(decision.title) === fp
      && (decision.criteria?.length || 0) < 3;

    aiCriteria(dec, { waitMs: WAIT_LONG, cancelIf: () => !stillWanted() })
      .then((set) => {
        if (!stillWanted()) return;
        chipsCache = { fp, set };
        if (chipsOnReady) chipsOnReady();
      })
      .catch(() => { /* silent fallback: no chips, exactly as today */ })
      .finally(() => { if (chipsInflight === fp) chipsInflight = null; });
  }
  return null;
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

  aiSanityCheck(dec, digest, { waitMs: WAIT_LONG, cancelIf: () => mySeq !== sanitySeq })
    .then((text) => {
      const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 420);
      if (!clean) return;
      sanityCache = { fp, text: clean };
      if (mySeq === sanitySeq) onText(clean);
    })
    .catch(() => { /* silent: the results page is complete without it */ });
}

/* --------------- Results tab — options worth considering ----------------- */

let missingSeq = 0;
let missingCache = { fp: null, list: null };

/**
 * Asks the model whether any strong options are missing from the list, once
 * the full decision (frame, options, criteria, weights) is known. `onList`
 * receives 1–3 { name, why } suggestions; an empty answer renders nothing.
 * The user can go back and add any of them — nothing is ever added for them.
 */
export function requestMissingOptions(dec, onList) {
  if (!enabled() || typeof onList !== 'function') return;
  const fp = JSON.stringify([
    norm(dec.title),
    (dec.options || []).map((o) => norm(o.name)),
    (dec.criteria || []).map((c) => norm(c.name)),
  ]);
  const mySeq = ++missingSeq;

  if (missingCache.fp === fp && missingCache.list) {
    if (missingCache.list.length) onList(missingCache.list);
    return;
  }
  kickLoad();

  aiMissingOptions(dec, { waitMs: WAIT_LONG, cancelIf: () => mySeq !== missingSeq })
    .then((list) => {
      const clean = Array.isArray(list) ? list : [];
      missingCache = { fp, list: clean };
      if (mySeq === missingSeq && clean.length) onList(clean);
    })
    .catch(() => { /* silent: no suggestion is a perfectly fine outcome */ });
}
