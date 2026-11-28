import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAllMatches,
  computeVisualSignatureSimilarity,
  tokenizeText,
} from './matchingEngine';
import { CampusItem, DEFAULT_MATCHING_CONFIG } from '../types/reclaim';

const makeItem = (overrides: Partial<CampusItem>): CampusItem => ({
  id: 'id-1',
  type: 'lost',
  itemName: 'Item',
  category: 'Wallets & IDs',
  description: 'Generic item description for testing',
  location: 'Main Library 2nd Floor',
  campusZone: 'main-library',
  dateOccurred: '2026-11-25',
  status: 'open',
  hasPhoto: false,
  reporterId: 'user-1',
  reporterName: 'Test Student',
  createdAt: '2026-11-25T10:00:00Z',
  updatedAt: '2026-11-25T10:00:00Z',
  ...overrides,
});

test('tokenizer normalizes synonyms and stems keywords accurately', () => {
  const tokens = tokenizeText('Blue insulated flask with soccer decals and cracked bezel');
  assert.ok(tokens.includes('blue'));
  assert.ok(tokens.includes('bottle'));
  assert.ok(tokens.includes('football'));
  assert.ok(tokens.includes('sticker'));
  assert.ok(tokens.includes('damage'));
  assert.ok(tokens.includes('corner'));
});

test('identifies all three user benchmark lost-and-found pairs as high potential matches without photos', () => {
  const items: CampusItem[] = [
    makeItem({
      id: 'lost-wallet',
      type: 'lost',
      itemName: 'Black Leather Wallet',
      category: 'Wallets & IDs',
      description: 'Black leather wallet with a small silver logo lost near reading tables',
      location: 'Main Library 2nd Floor',
      campusZone: 'main-library',
      dateOccurred: '2026-11-24',
    }),
    makeItem({
      id: 'found-wallet',
      type: 'found',
      itemName: 'Black Wallet',
      category: 'Wallets & IDs',
      description: 'Black wallet with silver logo turned in at front desk',
      location: 'Main Library Desk',
      campusZone: 'main-library',
      dateOccurred: '2026-11-25',
    }),
    makeItem({
      id: 'lost-bottle',
      type: 'lost',
      itemName: 'Blue Water Bottle',
      category: 'Water Bottles & Gear',
      description: 'Blue water bottle with a sticker of a football on the side',
      location: 'Commons Quad Benches',
      campusZone: 'commons-quad',
      dateOccurred: '2026-11-24',
    }),
    makeItem({
      id: 'found-bottle',
      type: 'found',
      itemName: 'Blue Bottle',
      category: 'Water Bottles & Gear',
      description: 'Blue bottle with football sticker left on stone bench',
      location: 'Commons Quad North',
      campusZone: 'commons-quad',
      dateOccurred: '2026-11-24',
    }),
    makeItem({
      id: 'lost-calc',
      type: 'lost',
      itemName: 'Scientific Calculator',
      category: 'Calculators & Lab Gear',
      description: 'Scientific calculator with a cracked corner used in calculus lab',
      location: 'Science Hall Room 204',
      campusZone: 'science-hall',
      dateOccurred: '2026-11-23',
    }),
    makeItem({
      id: 'found-calc',
      type: 'found',
      itemName: 'Calculator',
      category: 'Calculators & Lab Gear',
      description: 'Calculator with damage near one corner found after lecture',
      location: 'Science Hall Lecture Room',
      campusZone: 'science-hall',
      dateOccurred: '2026-11-24',
    }),
  ];

  const matches = computeAllMatches(items, DEFAULT_MATCHING_CONFIG);

  const walletMatch = matches.find(
    (m) => m.lostItem.id === 'lost-wallet' && m.foundItem.id === 'found-wallet'
  );
  const bottleMatch = matches.find(
    (m) => m.lostItem.id === 'lost-bottle' && m.foundItem.id === 'found-bottle'
  );
  const calcMatch = matches.find(
    (m) => m.lostItem.id === 'lost-calc' && m.foundItem.id === 'found-calc'
  );
  const crossMismatch = matches.find(
    (m) => m.lostItem.id === 'lost-wallet' && m.foundItem.id === 'found-bottle'
  );

  assert.ok(walletMatch && walletMatch.tier === 'high', `Expected high wallet match, got ${walletMatch?.finalScore}`);
  assert.ok(bottleMatch && bottleMatch.tier === 'high', `Expected high bottle match, got ${bottleMatch?.finalScore}`);
  assert.ok(calcMatch && calcMatch.tier === 'high', `Expected high calculator match, got ${calcMatch?.finalScore}`);
  assert.ok(crossMismatch && crossMismatch.tier === 'low', `Expected low mismatch, got ${crossMismatch?.finalScore}`);
});

test('secondary visual similarity never overrides a low text match', () => {
  const identicalSig = '0.25,0.25,0.25,0.25,0.5,0.5,0.5,0.5';
  assert.equal(Math.round((computeVisualSignatureSimilarity(identicalSig, identicalSig) ?? 0) * 100), 100);

  const items: CampusItem[] = [
    makeItem({
      id: 'lost-a',
      type: 'lost',
      itemName: 'Red Wool Scarf',
      category: 'Clothing & Apparel',
      description: 'Knitted red wool winter scarf with fringe edges',
      location: 'Athletics Complex',
      campusZone: 'athletics-complex',
      dateOccurred: '2026-11-10',
      hasPhoto: true,
      visualSignature: identicalSig,
    }),
    makeItem({
      id: 'found-b',
      type: 'found',
      itemName: 'USB-C Power Adapter',
      category: 'Electronics',
      description: 'White 65W laptop charger brick with coiled cable',
      location: 'Engineering Lab',
      campusZone: 'engineering-lab',
      dateOccurred: '2026-11-25',
      hasPhoto: true,
      visualSignature: identicalSig,
    }),
  ];

  const [match] = computeAllMatches(items, DEFAULT_MATCHING_CONFIG);
  assert.equal(match.breakdown.visualSimilarityScore, 100);
  assert.equal(match.breakdown.visualBonusApplied, 0);
  assert.equal(match.tier, 'low');
  assert.ok(match.finalScore < 30);
});

test('admin threshold configuration dynamically reclassifies match tiers', () => {
  const items: CampusItem[] = [
    makeItem({
      id: 'l1',
      type: 'lost',
      itemName: 'Silver Wireless Headphones',
      category: 'Electronics',
      description: 'Matte silver wireless over-ear headphones in gray case',
      location: 'Student Union Lounge',
      campusZone: 'student-union',
      dateOccurred: '2026-11-25',
    }),
    makeItem({
      id: 'f1',
      type: 'found',
      itemName: 'Bluetooth Headset',
      category: 'Electronics',
      description: 'Silver bluetooth headphones left near lounge sofa',
      location: 'Student Union Cafeteria',
      campusZone: 'student-union',
      dateOccurred: '2026-11-26',
    }),
  ];

  const strictMatches = computeAllMatches(items, {
    ...DEFAULT_MATCHING_CONFIG,
    highThreshold: 92,
    possibleThreshold: 60,
  });
  assert.equal(strictMatches[0].tier, 'possible');

  const relaxedMatches = computeAllMatches(items, {
    ...DEFAULT_MATCHING_CONFIG,
    highThreshold: 65,
    possibleThreshold: 40,
  });
  assert.equal(relaxedMatches[0].tier, 'high');
});
