import {
  CAMPUS_ZONES,
  CampusItem,
  CampusZoneId,
  DEFAULT_MATCHING_CONFIG,
  MatchResult,
  MatchTier,
  MatchingConfig,
} from '../types/reclaim';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'as', 'is', 'was', 'were', 'are', 'be', 'been', 'it',
  'its', 'this', 'that', 'these', 'those', 'near', 'around', 'inside', 'very',
  'some', 'one', 'my', 'i', 'lost', 'found', 'left', 'item', 'has', 'have',
  'had', 'there', 'their', 'about', 'into', 'out', 'up', 'down', 'over',
]);

// Domain-specific synonym groups canonicalized to a shared concept token
const SYNONYM_MAP: Record<string, string> = {
  // Wallets & cards
  billfold: 'wallet',
  purse: 'wallet',
  cardholder: 'wallet',
  pocketbook: 'wallet',
  leather: 'leather',
  faux: 'leather',
  // Logos & markings
  emblem: 'logo',
  badge: 'logo',
  insignia: 'logo',
  monogram: 'logo',
  symbol: 'logo',
  decal: 'sticker',
  label: 'sticker',
  patch: 'sticker',
  // Bottles & drinkware
  flask: 'bottle',
  tumbler: 'bottle',
  thermos: 'bottle',
  hydroflask: 'bottle',
  canteen: 'bottle',
  waterbottle: 'bottle',
  insulated: 'bottle',
  // Sports
  soccer: 'football',
  soccerball: 'football',
  // Damage / condition
  cracked: 'damage',
  crack: 'damage',
  damaged: 'damage',
  chipped: 'damage',
  broken: 'damage',
  scratched: 'damage',
  scuffed: 'damage',
  dent: 'damage',
  dented: 'damage',
  fractured: 'damage',
  shattered: 'damage',
  edge: 'corner',
  bezel: 'corner',
  // Calculators & electronics
  graphing: 'scientific',
  calc: 'calculator',
  earphone: 'headphone',
  earphones: 'headphone',
  earbud: 'headphone',
  earbuds: 'headphone',
  headset: 'headphone',
  headsets: 'headphone',
  headphone: 'headphone',
  headphones: 'headphone',
  airpod: 'headphone',
  airpods: 'headphone',
  overear: 'headphone',
  wireless: 'bluetooth',
  notebook: 'laptop',
  macbook: 'laptop',
  ultrabook: 'laptop',
  chromebook: 'laptop',
  pendrive: 'usb',
  thumbdrive: 'usb',
  flashdrive: 'usb',
  // Colors
  cobalt: 'blue',
  navy: 'blue',
  azure: 'blue',
  charcoal: 'black',
  graphite: 'black',
  obsidian: 'black',
  ebony: 'black',
  metallic: 'silver',
  chrome: 'silver',
  stainless: 'silver',
  crimson: 'red',
  maroon: 'red',
  emerald: 'green',
  // Sizes
  tiny: 'small',
  mini: 'small',
  little: 'small',
  compact: 'small',
  // Bags
  rucksack: 'backpack',
  knapsack: 'backpack',
  bookbag: 'backpack',
  satchel: 'bag',
  tote: 'bag',
  pouch: 'case',
  sleeve: 'case',
  // Keys & IDs
  keychain: 'key',
  keyring: 'key',
  keys: 'key',
  fob: 'key',
  lanyard: 'id',
  idcard: 'id',
  studentid: 'id',
};

const RELATED_CATEGORIES: Record<string, string[]> = {
  'Electronics': ['Calculators & Lab Gear', 'Accessories'],
  'Calculators & Lab Gear': ['Electronics', 'Books & Stationery'],
  'Wallets & IDs': ['Keys & Cards', 'Bags & Personal'],
  'Keys & Cards': ['Wallets & IDs'],
  'Water Bottles & Gear': ['Bags & Personal', 'Sports & Athletics'],
  'Sports & Athletics': ['Water Bottles & Gear', 'Clothing & Apparel'],
  'Bags & Personal': ['Wallets & IDs', 'Clothing & Apparel'],
  'Books & Stationery': ['Calculators & Lab Gear'],
};

/**
 * Lightweight deterministic stemmer suited for English item descriptions.
 */
export function stemWord(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

/**
 * Normalizes, tokenizes, removes stopwords, stems, and maps synonyms.
 */
export function tokenizeText(text: string): string[] {
  if (!text) return [];
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  const tokens: string[] = [];
  for (const raw of cleaned.split(' ')) {
    if (!raw || raw.length < 2 || STOP_WORDS.has(raw)) continue;
    const directSynonym = SYNONYM_MAP[raw];
    if (directSynonym) {
      tokens.push(directSynonym);
      continue;
    }
    const stemmed = stemWord(raw);
    if (STOP_WORDS.has(stemmed)) continue;
    tokens.push(SYNONYM_MAP[stemmed] ?? stemmed);
  }
  return tokens;
}

/**
 * Computes Jaccard similarity (0..1) over unique canonical tokens.
 */
export function computeJaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const tok of setA) {
    if (setB.has(tok)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Computes Dice / overlap containment coefficient (0..1) so concise found descriptions
 * still score strongly against longer detailed lost descriptions.
 */
export function computeContainmentSimilarity(tokensA: string[], tokensB: string[]): number {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const tok of setA) {
    if (setB.has(tok)) intersection += 1;
  }
  const minSize = Math.min(setA.size, setB.size);
  return minSize === 0 ? 0 : intersection / minSize;
}

/**
 * Builds inverse document frequency (IDF) map over a corpus of token arrays.
 */
export function buildIdfMap(corpusTokenLists: string[][]): Map<string, number> {
  const docCount = Math.max(corpusTokenLists.length, 1);
  const docFreq = new Map<string, number>();

  for (const tokens of corpusTokenLists) {
    const unique = new Set(tokens);
    for (const token of unique) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [token, df] of docFreq.entries()) {
    // Smoothed IDF so terms appearing across a small demo corpus never collapse to 0
    idf.set(token, Math.log((docCount + 1) / (df + 0.5)) + 1);
  }
  return idf;
}

/**
 * Computes TF-IDF weighted Cosine similarity (0..1).
 */
export function computeTfIdfCosine(
  tokensA: string[],
  tokensB: string[],
  idfMap: Map<string, number>
): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const tfA = new Map<string, number>();
  const tfB = new Map<string, number>();

  for (const t of tokensA) tfA.set(t, (tfA.get(t) ?? 0) + 1);
  for (const t of tokensB) tfB.set(t, (tfB.get(t) ?? 0) + 1);

  const allTerms = new Set([...tfA.keys(), ...tfB.keys()]);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const term of allTerms) {
    const idf = idfMap.get(term) ?? 1.5;
    const wA = ((tfA.get(term) ?? 0) / tokensA.length) * idf;
    const wB = ((tfB.get(term) ?? 0) / tokensB.length) * idf;
    dot += wA * wB;
    normA += wA * wA;
    normB += wB * wB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Computes normalized Levenshtein similarity (0..1) for short strings like item names.
 */
export function computeLevenshteinSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const m = s1.length;
  const n = s2.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }

  const distance = dp[n];
  return Math.max(0, 1 - distance / Math.max(m, n));
}

export function computeNameSimilarity(nameA: string, nameB: string, idfMap: Map<string, number>): number {
  const tokensA = tokenizeText(nameA);
  const tokensB = tokenizeText(nameB);
  const jaccard = computeJaccardSimilarity(tokensA, tokensB);
  const containment = computeContainmentSimilarity(tokensA, tokensB);
  const cosine = computeTfIdfCosine(tokensA, tokensB, idfMap);
  const levenshtein = computeLevenshteinSimilarity(nameA, nameB);

  return Math.min(1, 0.35 * jaccard + 0.30 * containment + 0.20 * cosine + 0.15 * levenshtein);
}

export function computeCategorySimilarity(catA: string, catB: string): number {
  const a = catA.trim().toLowerCase();
  const b = catB.trim().toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 1;

  const related = RELATED_CATEGORIES[catA] ?? [];
  if (related.some((r) => r.toLowerCase() === b)) return 0.55;

  const reverseRelated = RELATED_CATEGORIES[catB] ?? [];
  if (reverseRelated.some((r) => r.toLowerCase() === a)) return 0.55;

  return 0;
}

export function computeLocationSimilarity(
  locA: string,
  zoneA: CampusZoneId,
  locB: string,
  zoneB: CampusZoneId
): number {
  const tokA = tokenizeText(locA);
  const tokB = tokenizeText(locB);
  const textOverlap = computeJaccardSimilarity(tokA, tokB);

  if (zoneA === zoneB) {
    return Math.min(1, 0.72 + 0.28 * textOverlap);
  }

  const zoneMeta = CAMPUS_ZONES.find((z) => z.id === zoneA);
  if (zoneMeta?.adjacentZones.includes(zoneB)) {
    return Math.min(1, 0.38 + 0.32 * textOverlap);
  }

  return Math.min(1, textOverlap * 0.5);
}

export function computeDateProximity(lostDateStr: string, foundDateStr: string): number {
  const lostTime = Date.parse(lostDateStr);
  const foundTime = Date.parse(foundDateStr);
  if (Number.isNaN(lostTime) || Number.isNaN(foundTime)) return 0.5;

  const diffDays = (foundTime - lostTime) / (1000 * 60 * 60 * 24);

  // Found more than 3 days BEFORE item was reported lost is unlikely
  if (diffDays < -3) return 0.08;
  // Small date reporting slip (-3..0 days)
  if (diffDays < 0) return Math.max(0.35, 1 + diffDays * 0.2);
  // Same day or within 1 day
  if (diffDays <= 1) return 1;
  // Smooth decay up to 21 days
  if (diffDays <= 21) return Math.max(0.15, 1 - (diffDays - 1) / 22);
  return 0.05;
}

/**
 * Compares two compact visual feature signatures (comma-separated floats) via cosine similarity.
 * Returns null if either item does not have a photo signature.
 */
export function computeVisualSignatureSimilarity(sigA?: string, sigB?: string): number | null {
  if (!sigA || !sigB) return null;
  const vecA = sigA.split(',').map(Number).filter((n) => !Number.isNaN(n));
  const vecB = sigB.split(',').map(Number).filter((n) => !Number.isNaN(n));
  if (vecA.length === 0 || vecA.length !== vecB.length) return null;

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  if (magA === 0 || magB === 0) return null;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(magA) * Math.sqrt(magB))));
}

export function classifyMatchTier(
  score: number,
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): { tier: MatchTier; tierLabel: string } {
  if (score >= config.highThreshold) {
    return { tier: 'high', tierLabel: 'High potential match' };
  }
  if (score >= config.possibleThreshold) {
    return { tier: 'possible', tierLabel: 'Possible match' };
  }
  return { tier: 'low', tierLabel: 'Low similarity' };
}

/**
 * Evaluates a single Lost vs Found item pair using the ReClaim weighted text matching engine.
 * Image similarity is strictly supplementary and can NEVER override a low text match.
 */
export function scoreItemPair(
  lostItem: CampusItem,
  foundItem: CampusItem,
  idfMap: Map<string, number>,
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): MatchResult {
  const lostDescTokens = tokenizeText(`${lostItem.description} ${lostItem.itemName}`);
  const foundDescTokens = tokenizeText(`${foundItem.description} ${foundItem.itemName}`);

  const jaccard = computeJaccardSimilarity(lostDescTokens, foundDescTokens);
  const containment = computeContainmentSimilarity(lostDescTokens, foundDescTokens);
  const tfidfCosine = computeTfIdfCosine(lostDescTokens, foundDescTokens, idfMap);

  // Description similarity combines TF-IDF cosine, Jaccard, and containment
  const descRaw = Math.min(1, 0.40 * tfidfCosine + 0.30 * jaccard + 0.30 * containment);
  const nameRaw = computeNameSimilarity(lostItem.itemName, foundItem.itemName, idfMap);
  const catRaw = computeCategorySimilarity(lostItem.category, foundItem.category);
  const locRaw = computeLocationSimilarity(
    lostItem.location,
    lostItem.campusZone,
    foundItem.location,
    foundItem.campusZone
  );
  const dateRaw = computeDateProximity(lostItem.dateOccurred, foundItem.dateOccurred);

  const totalWeight =
    config.descriptionWeight +
    config.nameWeight +
    config.categoryWeight +
    config.locationWeight +
    config.dateWeight || 100;

  const weightedText =
    (descRaw * config.descriptionWeight +
      nameRaw * config.nameWeight +
      catRaw * config.categoryWeight +
      locRaw * config.locationWeight +
      dateRaw * config.dateWeight) /
    totalWeight;

  // Guardrail: if description AND name share almost zero semantic signal, dampen spurious category/date coincidence
  const lexicalSignal = Math.max(descRaw, nameRaw);
  const guardedText = lexicalSignal < 0.12 ? weightedText * 0.45 : weightedText;
  const textScore = Math.round(Math.max(0, Math.min(100, guardedText * 100)));

  // Optional Secondary Visual Similarity (strictly supplementary, NEVER overrides text)
  const visualRaw = computeVisualSignatureSimilarity(
    lostItem.visualSignature,
    foundItem.visualSignature
  );
  const visualSimilarityScore = visualRaw !== null ? Math.round(visualRaw * 100) : null;

  // Supplementary visual bonus only applies if textScore already has meaningful relevance (>= 40)
  // and is capped at +5 points max so visual evidence can refine confidence without overriding text.
  let visualBonusApplied = 0;
  if (visualSimilarityScore !== null && textScore >= 40 && visualSimilarityScore >= 65) {
    visualBonusApplied = Math.min(5, Math.round(((visualSimilarityScore - 60) / 40) * 5));
  }

  const finalScore = Math.min(100, textScore + visualBonusApplied);
  const { tier, tierLabel } = classifyMatchTier(finalScore, config);

  // Extract matched canonical keywords for transparency in UI
  const foundSet = new Set(foundDescTokens);
  const matchedKeywords = Array.from(new Set(lostDescTokens.filter((t) => foundSet.has(t)))).slice(
    0,
    8
  );

  return {
    id: `${lostItem.id}__${foundItem.id}`,
    lostItem,
    foundItem,
    textScore,
    finalScore,
    tier,
    tierLabel,
    breakdown: {
      descriptionScore: Math.round(descRaw * 100),
      nameScore: Math.round(nameRaw * 100),
      categoryScore: Math.round(catRaw * 100),
      locationScore: Math.round(locRaw * 100),
      dateScore: Math.round(dateRaw * 100),
      jaccardScore: Math.round(jaccard * 100),
      tfidfCosineScore: Math.round(tfidfCosine * 100),
      visualSimilarityScore,
      visualBonusApplied,
      matchedKeywords,
    },
  };
}

/**
 * Computes all Lost <-> Found intelligent matches across the campus corpus, sorted by score descending.
 */
export function computeAllMatches(
  items: CampusItem[],
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): MatchResult[] {
  const activeItems = items.filter((i) => i.status !== 'archived');
  const lostItems = activeItems.filter((i) => i.type === 'lost');
  const foundItems = activeItems.filter((i) => i.type === 'found');

  if (lostItems.length === 0 || foundItems.length === 0) return [];

  const corpusTokens = activeItems.map((i) => tokenizeText(`${i.description} ${i.itemName}`));
  const idfMap = buildIdfMap(corpusTokens);

  const results: MatchResult[] = [];
  for (const lost of lostItems) {
    for (const found of foundItems) {
      results.push(scoreItemPair(lost, found, idfMap, config));
    }
  }

  return results.sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * Finds ranked potential matches for a specific lost or found item.
 */
export function findMatchesForItem(
  target: CampusItem,
  allItems: CampusItem[],
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): MatchResult[] {
  const activeItems = allItems.filter((i) => i.status !== 'archived');
  const corpusTokens = activeItems.map((i) => tokenizeText(`${i.description} ${i.itemName}`));
  const idfMap = buildIdfMap(corpusTokens);

  const oppositeType = target.type === 'lost' ? 'found' : 'lost';
  const candidates = activeItems.filter((i) => i.type === oppositeType && i.id !== target.id);

  return candidates
    .map((candidate) =>
      target.type === 'lost'
        ? scoreItemPair(target, candidate, idfMap, config)
        : scoreItemPair(candidate, target, idfMap, config)
    )
    .sort((a, b) => b.finalScore - a.finalScore);
}
