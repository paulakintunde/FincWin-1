/**
 * sync-fingerprint.test.js
 * Tests the sync conflict fingerprint logic for the silent data-loss collision.
 *
 * The fingerprint only sums aggregate totals, so two states that delete and
 * re-add equivalent amounts produce the same fingerprint — causing auto-resolve
 * to silently prefer one device's version and discard the other's changes.
 *
 * These tests document the known weakness and verify that the collision scenario
 * is real, so a future fix can target this function directly.
 */
import { describe, it, expect } from 'vitest';

// ── Replicate the fingerprint function from sync.js ──────────────────────────
function stateFingerprint(s) {
  let totalExp = 0, expCount = 0, incCount = 0, totalInc = 0, loanTotal = 0, savTotal = 0;
  Object.values(s.months || {}).forEach(m => {
    (m.weeks || []).forEach(w => {
      (w.items || []).forEach(i => { totalExp += Number(i.amount) || 0; expCount++; });
    });
    (m.revenue || []).forEach(r => { totalInc += Number(r.amount) || 0; incCount++; });
  });
  (s.loans || []).forEach(l => { loanTotal += Number(l.amount) || 0; });
  (s.savings || []).forEach(g => { savTotal += Number(g.balance) || 0; });
  return [totalExp, totalInc, expCount, incCount, loanTotal, savTotal,
          (s.loans || []).length, (s.savings || []).length].join('|');
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeBaseState() {
  return {
    months: {
      'Jun 2026': {
        weeks: [
          { items: [{ name: 'Netflix', amount: 15 }, { name: 'Spotify', amount: 10 }] },
          { items: [] }, { items: [] }, { items: [] }
        ],
        revenue: [{ name: 'Salary', amount: 5000 }]
      }
    },
    loans: [{ name: 'Car', amount: 10000 }],
    savings: [{ name: 'Emergency', balance: 3000 }]
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('stateFingerprint — basic correctness', () => {
  it('produces a consistent fingerprint for the same state', () => {
    const s = makeBaseState();
    expect(stateFingerprint(s)).toBe(stateFingerprint(JSON.parse(JSON.stringify(s))));
  });

  it('produces different fingerprints when expense amounts differ', () => {
    const s1 = makeBaseState();
    const s2 = makeBaseState();
    s2.months['Jun 2026'].weeks[0].items[0].amount = 999;
    expect(stateFingerprint(s1)).not.toBe(stateFingerprint(s2));
  });

  it('produces different fingerprints when item count differs', () => {
    const s1 = makeBaseState();
    const s2 = makeBaseState();
    s2.months['Jun 2026'].weeks[0].items.push({ name: 'Extra', amount: 0 });
    expect(stateFingerprint(s1)).not.toBe(stateFingerprint(s2));
  });
});

describe('stateFingerprint — known collision (silent data loss risk)', () => {
  it('Device A and Device B produce the same fingerprint despite different items', () => {
    // Device A: deletes Netflix ($15) and adds Gym ($15) — net $0 change
    const deviceA = makeBaseState();
    deviceA.months['Jun 2026'].weeks[0].items = [
      { name: 'Spotify', amount: 10 },
      { name: 'Gym',     amount: 15 }   // replaced Netflix
    ];

    // Device B: deletes Gym (which didn't exist on base) and adds Gym - same count and total
    const deviceB = makeBaseState();
    deviceB.months['Jun 2026'].weeks[0].items = [
      { name: 'Netflix', amount: 15 },
      { name: 'Gym',     amount: 10 }   // replaced Spotify
    ];

    // Different items but identical aggregate totals → fingerprint collision
    expect(stateFingerprint(deviceA)).toBe(stateFingerprint(deviceB));
    // Confirm the items are actually different (this is the bug: different data, same fingerprint)
    expect(deviceA.months['Jun 2026'].weeks[0].items[0].name)
      .not.toBe(deviceB.months['Jun 2026'].weeks[0].items[0].name);
  });

  it('delete-one-add-one ($100 each) from two devices produces a collision', () => {
    const deviceA = makeBaseState();
    deviceA.months['Jun 2026'].weeks[1].items = [{ name: 'Dentist', amount: 100 }];
    deviceA.months['Jun 2026'].weeks[0].items = [
      { name: 'Spotify', amount: 10 }  // removed Netflix ($15), but that month already has no Netflix
    ];

    const deviceB = JSON.parse(JSON.stringify(deviceA));
    // Device B removes Dentist, adds Pharmacy at same amount
    deviceB.months['Jun 2026'].weeks[1].items = [{ name: 'Pharmacy', amount: 100 }];

    // Same total, same count — fingerprint collision
    expect(stateFingerprint(deviceA)).toBe(stateFingerprint(deviceB));
  });
});

describe('stateFingerprint — items that SHOULD differ but collide', () => {
  it('two states with swapped item names but same amounts fingerprint the same', () => {
    const s1 = { months: { 'Jun 2026': { weeks: [{ items: [
      { name: 'Rent', amount: 1200 }, { name: 'Food', amount: 300 }
    ] }], revenue: [] } }, loans: [], savings: [] };

    const s2 = { months: { 'Jun 2026': { weeks: [{ items: [
      { name: 'Food', amount: 1200 }, { name: 'Rent', amount: 300 }
    ] }], revenue: [] } }, loans: [], savings: [] };

    // Names swapped but totals match — auto-resolver would see no conflict
    expect(stateFingerprint(s1)).toBe(stateFingerprint(s2));
  });
});
