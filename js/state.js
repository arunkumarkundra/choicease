/* ==========================================================================
   Choicease — state.js
   Single source of truth for the decision being built.
   No DOM access in this module.
   ========================================================================== */

export const LIMITS = {
  TITLE: 100,
  DESCRIPTION: 500,
  NAME: 100,
  ITEM_DESCRIPTION: 250,
  MIN_OPTIONS: 2,
  MIN_CRITERIA: 2,
  SOFT_MIN_OPTIONS: 3,  // bias nudge: too few options below this
  SOFT_MAX_OPTIONS: 8,  // gentle comparison-fatigue note above this
  SOFT_MAX_CRITERIA: 7, // cognitive-load nudge above this
};

export const SCHEMA_VERSION = '1.1'; // kept identical to legacy exports for compatibility

/** The one mutable store for the app. */
export const decision = createEmptyDecision();

export function createEmptyDecision() {
  return {
    title: '',
    description: '',
    options: [],   // { id, name, description }
    criteria: [],  // { id, name, description }
    weights: {},   // criterionId -> importance rating 1..5
    normalizedWeights: {}, // criterionId -> percentage (0..100)
    ratings: {},   // `${optionId}-${criterionId}` -> 0..5 (0.1 precision)
    timestamp: null,
  };
}

/** Replace store contents in place (keeps the exported reference stable). */
export function replaceDecision(next) {
  const empty = createEmptyDecision();
  for (const key of Object.keys(empty)) {
    decision[key] = next[key] !== undefined ? next[key] : empty[key];
  }
}

export function resetDecision() {
  replaceDecision(createEmptyDecision());
  clearDraft();
  rearmSeeds(); // a brand-new decision may be seeded once
  bumpEpoch();  // and any in-flight AI result for the old one is void
}

/* --------------------------------------------------------------------------
   Sanitization — user text is stored as plain text; rendering always escapes.
   -------------------------------------------------------------------------- */

export function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return '';
  let out = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  out = out.replace(/\s+/g, ' ').trim();
  if (maxLength) out = out.slice(0, maxLength);
  return out;
}

let idCounter = 0;
export function makeId() {
  // Time-based, matches legacy numeric-string style; counter avoids same-ms collisions.
  idCounter = (idCounter + 1) % 1000;
  return Number(`${Date.now()}${String(idCounter).padStart(3, '0')}`);
}

/* --------------------------------------------------------------------------
   Mutations
   -------------------------------------------------------------------------- */

export function setFrame(title, description) {
  decision.title = sanitizeText(title, LIMITS.TITLE);
  decision.description = sanitizeText(description, LIMITS.DESCRIPTION);
  saveDraft();
}

export function addOption(name, description) {
  const clean = sanitizeText(name, LIMITS.NAME);
  if (!clean) return { ok: false, error: 'Enter a name for the option.' };
  const duplicate = decision.options.some(
    (o) => o.name.toLowerCase() === clean.toLowerCase(),
  );
  if (duplicate) return { ok: false, error: `"${clean}" is already on the list.` };

  decision.options.push({
    id: makeId(),
    name: clean,
    description: sanitizeText(description, LIMITS.ITEM_DESCRIPTION),
  });
  saveDraft();
  return { ok: true };
}

export function removeOption(optionId) {
  decision.options = decision.options.filter((o) => o.id !== optionId);
  for (const key of Object.keys(decision.ratings)) {
    if (key.startsWith(`${optionId}-`)) delete decision.ratings[key];
  }
  saveDraft();
}

export function addCriterion(name, description) {
  const clean = sanitizeText(name, LIMITS.NAME);
  if (!clean) return { ok: false, error: 'Enter a name for the criterion.' };
  const duplicate = decision.criteria.some(
    (c) => c.name.toLowerCase() === clean.toLowerCase(),
  );
  if (duplicate) return { ok: false, error: `"${clean}" is already on the list.` };

  const id = makeId();
  decision.criteria.push({
    id,
    name: clean,
    description: sanitizeText(description, LIMITS.ITEM_DESCRIPTION),
  });
  decision.weights[id] = 3; // sensible default: medium importance, visible and overridable
  saveDraft();
  return { ok: true };
}

export function removeCriterion(criterionId) {
  decision.criteria = decision.criteria.filter((c) => c.id !== criterionId);
  delete decision.weights[criterionId];
  delete decision.normalizedWeights[criterionId];
  for (const key of Object.keys(decision.ratings)) {
    if (key.endsWith(`-${criterionId}`)) delete decision.ratings[key];
  }
  saveDraft();
}

export function updateOption(optionId, name, description) {
  const option = decision.options.find((o) => o.id === optionId);
  if (!option) return { ok: false, error: 'Option not found.' };
  const clean = sanitizeText(name, LIMITS.NAME);
  if (!clean) return { ok: false, error: 'The option needs a name.' };
  const duplicate = decision.options.some(
    (o) => o.id !== optionId && o.name.toLowerCase() === clean.toLowerCase(),
  );
  if (duplicate) return { ok: false, error: `"${clean}" is already on the list.` };
  option.name = clean;
  option.description = sanitizeText(description, LIMITS.ITEM_DESCRIPTION);
  saveDraft();
  return { ok: true };
}

export function updateCriterion(criterionId, name, description) {
  const criterion = decision.criteria.find((c) => c.id === criterionId);
  if (!criterion) return { ok: false, error: 'Criterion not found.' };
  const clean = sanitizeText(name, LIMITS.NAME);
  if (!clean) return { ok: false, error: 'The criterion needs a name.' };
  const duplicate = decision.criteria.some(
    (c) => c.id !== criterionId && c.name.toLowerCase() === clean.toLowerCase(),
  );
  if (duplicate) return { ok: false, error: `"${clean}" is already on the list.` };
  criterion.name = clean;
  criterion.description = sanitizeText(description, LIMITS.ITEM_DESCRIPTION);
  saveDraft();
  return { ok: true };
}

export function setImportance(criterionId, rating) {
  const r = Math.min(5, Math.max(1, Math.round(Number(rating) || 3)));
  decision.weights[criterionId] = r;
  seedGate.weights = false; // the user has taken over — AI stays out
  saveDraft();
}

export function setRating(optionId, criterionId, value) {
  let v = Number(value);
  if (!Number.isFinite(v)) v = 3;
  v = Math.min(5, Math.max(0, Math.round(v * 10) / 10));
  decision.ratings[`${optionId}-${criterionId}`] = v;
  seedGate.ratings = false; // the user has taken over — AI stays out
  saveDraft();
  return v;
}

/* --------------------------------------------------------------------------
   Draft autosave — "the app already knew": work survives an accidental reload.
   Stored locally only; nothing leaves the browser.
   -------------------------------------------------------------------------- */

const DRAFT_KEY = 'choicease.draft.v1';

export function saveDraft() {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...decision, savedAt: new Date().toISOString() }),
    );
  } catch {
    /* storage may be unavailable (private mode); the app still works */
  }
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || (!data.title && !data.options?.length && !data.criteria?.length)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/* --------------------------------------------------------------------------
   AI seeding gate — initiation only, never revision.
   Each kind ('weights' | 'ratings') may be seeded at most once, and only on a
   brand-new decision built in this session. Importing, opening a shared link,
   or resuming a draft disarms both gates; any user edit of a kind disarms
   that kind; leaving the tab consumes its window (handled by magic.js).
   Nothing here is persisted or exported — the gate is a per-session,
   per-decision courtesy window, invisible to every schema.
   -------------------------------------------------------------------------- */

const seedGate = { weights: true, ratings: true };
let decisionEpoch = 0;

export function getDecisionEpoch() { return decisionEpoch; }
export function canSeed(kind) { return seedGate[kind] === true; }
export function consumeSeed(kind) { if (kind in seedGate) seedGate[kind] = false; }

function disarmSeeds() { seedGate.weights = false; seedGate.ratings = false; }
function rearmSeeds() { seedGate.weights = true; seedGate.ratings = true; }
function bumpEpoch() { decisionEpoch += 1; }

/** Apply AI-proposed importance levels ({ criterionId: 1..5 }). One shot:
    the gate is consumed whether or not anything applied. Blank-slate
    invariant: refuses unless every weight is still the flat default (3). */
export function applySeededWeights(map) {
  if (!canSeed('weights')) return 0;
  const allFlat = decision.criteria.length >= 2
    && decision.criteria.every((c) => (decision.weights[c.id] || 3) === 3);
  consumeSeed('weights');
  if (!allFlat) return 0;
  let applied = 0;
  for (const c of decision.criteria) {
    const v = map?.[c.id];
    if (Number.isInteger(v) && v >= 1 && v <= 5) {
      decision.weights[c.id] = v;
      applied += 1;
    }
  }
  if (applied) saveDraft();
  return applied;
}

/** Apply AI-proposed ratings ({ `optionId-criterionId`: 0..5 }). One shot.
    Blank-slate invariant: refuses unless no rating has been stored yet. */
export function applySeededRatings(map) {
  if (!canSeed('ratings')) return 0;
  const blank = Object.keys(decision.ratings || {}).length === 0;
  consumeSeed('ratings');
  if (!blank) return 0;
  const optIds = new Set(decision.options.map((o) => o.id));
  const critIds = new Set(decision.criteria.map((c) => c.id));
  let applied = 0;
  for (const [key, raw] of Object.entries(map || {})) {
    const [o, c] = key.split('-').map(Number);
    if (!optIds.has(o) || !critIds.has(c)) continue;
    let v = Number(raw);
    if (!Number.isFinite(v)) continue;
    v = Math.min(5, Math.max(0, Math.round(v * 10) / 10));
    decision.ratings[key] = v;
    applied += 1;
  }
  if (applied) saveDraft();
  return applied;
}

/** Fill a blank option description with an AI draft. Never overwrites: the
    option must still exist, still carry the name it had when the draft was
    requested, and its description must still be empty. */
export function applyDraftedDescription(optionId, nameAtDraft, text) {
  const option = decision.options.find((o) => o.id === optionId);
  if (!option || option.description) return false;
  if (option.name !== nameAtDraft) return false;
  const clean = sanitizeText(text, LIMITS.ITEM_DESCRIPTION);
  if (!clean) return false;
  option.description = clean;
  saveDraft();
  return true;
}

/* --------------------------------------------------------------------------
   Import validation (shared by JSON and QR import) — backward compatible
   with every legacy Choicease export.
   -------------------------------------------------------------------------- */

export function validateImportedData(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.options) || !Array.isArray(data.criteria)) return false;
  const validItem = (item) =>
    item && (typeof item.id === 'number' || typeof item.id === 'string') &&
    typeof item.name === 'string' && item.name.trim().length > 0;
  if (!data.options.every(validItem) || !data.criteria.every(validItem)) return false;
  return true;
}

export function loadImportedData(data) {
  const next = createEmptyDecision();
  next.title = sanitizeText(data.title || '', LIMITS.TITLE);
  next.description = sanitizeText(data.description || '', LIMITS.DESCRIPTION);
  next.options = (data.options || []).map((o) => ({
    id: o.id, // preserve original ids — ratings reference them
    name: sanitizeText(o.name || '', LIMITS.NAME),
    description: sanitizeText(o.description || '', LIMITS.ITEM_DESCRIPTION),
  }));
  next.criteria = (data.criteria || []).map((c) => ({
    id: c.id,
    name: sanitizeText(c.name || '', LIMITS.NAME),
    description: sanitizeText(c.description || '', LIMITS.ITEM_DESCRIPTION),
  }));
  next.weights = { ...(data.weights || {}) };
  // Every criterion needs an importance rating; default absent ones to 3.
  for (const c of next.criteria) {
    if (!(c.id in next.weights)) next.weights[c.id] = 3;
  }
  next.ratings = {};
  for (const [key, value] of Object.entries(data.ratings || {})) {
    const v = parseFloat(value);
    if (Number.isFinite(v)) next.ratings[key] = Math.min(5, Math.max(0, v));
  }
  next.normalizedWeights = { ...(data.normalizedWeights || {}) };
  next.timestamp = data.timestamp || null;
  replaceDecision(next);
  disarmSeeds(); // imported / shared / resumed decisions are never AI-seeded
  bumpEpoch();   // any in-flight AI result belongs to the previous decision
  saveDraft();
}

/** Snapshot in the exact legacy export schema (JSON, QR). */
export function exportSnapshot() {
  return {
    title: decision.title,
    description: decision.description,
    timestamp: new Date().toISOString(),
    options: decision.options,
    criteria: decision.criteria,
    weights: decision.weights,
    normalizedWeights: decision.normalizedWeights,
    ratings: decision.ratings,
    version: SCHEMA_VERSION,
  };
}
