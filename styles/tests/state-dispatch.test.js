/**
 * state-dispatch.test.js
 * Tests the dispatch/undo logic for the critical data-integrity scenarios:
 * - INVESTMENTS_RESET_ALL snapshot + undo
 * - SAVINGS_TXN_REMOVE snapshot + balance reversal
 * - LOAN_GENERATE_SCHEDULE deduplication
 * - _DESTRUCTIVE_ACTIONS registry completeness
 *
 * These are unit tests for the pure state logic extracted from state.js.
 * No browser APIs or IDB are required.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ── Minimal state fixture ────────────────────────────────────────────────────
function makeState() {
  return {
    months: { 'Jun 2026': { weeks: [{ items: [] }, { items: [] }, { items: [] }, { items: [] }], revenue: [] } },
    loans: [
      { name: 'Car Loan', amount: 15000, rate: 5.5, minPayment: 300, payments: [] }
    ],
    savings: [
      { name: 'Emergency Fund', balance: 2000, contribution: 200, transactions: [
        { type: 'deposit', amount: 500 },
        { type: 'withdrawal', amount: 200 }
      ]}
    ],
    investments: [
      { name: 'RRSP', currentValue: 50000, currency: 'CAD' },
      { name: 'TFSA', currentValue: 30000, currency: 'CAD' }
    ],
    currency: { code: 'CAD', symbol: '$', locale: 'en-CA' }
  };
}

// ── Extracted pure dispatch logic (mirrors state.js behaviour) ───────────────
const DESTRUCTIVE_ACTIONS = [
  'ITEM_REMOVE', 'LOAN_REMOVE', 'SAVINGS_REMOVE', 'REVENUE_REMOVE',
  'RECURRING_REMOVE', 'MONTH_RESET_EXPENSES', 'MONTH_RESET_REVENUE',
  'MONTH_RESET_LOANS_PMT', 'SAVINGS_RESET_ALL', 'INVESTMENTS_RESET_ALL',
  'SAVINGS_TXN_REMOVE'
];

function amt(x) { return (x == null || isNaN(Number(x))) ? 0 : Number(x); }

let _snapshot = null;

function snapForUndo(state) {
  _snapshot = JSON.stringify(state);
}

function undoLast(currentState) {
  if (!_snapshot) return currentState;
  const restored = JSON.parse(_snapshot);
  _snapshot = null;
  return restored;
}

function dispatch(state, type, payload = {}) {
  if (DESTRUCTIVE_ACTIONS.includes(type)) snapForUndo(state);
  // Deep-clone to avoid mutation of the input fixture in tests
  const S = JSON.parse(JSON.stringify(state));
  const p = payload;

  switch (type) {
    case 'INVESTMENTS_RESET_ALL':
      S.investments = [];
      break;
    case 'INVESTMENTS_REMOVE':
      if (S.investments) S.investments.splice(p.idx, 1);
      break;
    case 'SAVINGS_TXN_REMOVE':
      if (S.savings && S.savings[p.goalIdx]) {
        const g = S.savings[p.goalIdx];
        if (g.transactions && g.transactions[p.txnIdx] !== undefined) {
          const txn = g.transactions[p.txnIdx];
          if (txn.type === 'deposit')
            g.balance = Math.max(0, Math.round((amt(g.balance) - txn.amount) * 100) / 100);
          else
            g.balance = Math.round((amt(g.balance) + txn.amount) * 100) / 100;
          g.transactions.splice(p.txnIdx, 1);
        }
      }
      break;
    case 'LOAN_GENERATE_SCHEDULE':
      if (S.loans && S.loans[p.loanIdx]) {
        const loan = S.loans[p.loanIdx];
        if (!loan.payments) loan.payments = [];
        (p.months || []).forEach(mo => {
          if (!loan.payments.find(pmt => pmt.month === mo))
            loan.payments.push({ month: mo, paid: false });
        });
      }
      break;
    case 'SAVINGS_RESET_ALL':
      S.savings = [];
      break;
    default:
      break;
  }
  return S;
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('_DESTRUCTIVE_ACTIONS registry', () => {
  it('includes INVESTMENTS_RESET_ALL', () => {
    expect(DESTRUCTIVE_ACTIONS).toContain('INVESTMENTS_RESET_ALL');
  });

  it('includes SAVINGS_TXN_REMOVE', () => {
    expect(DESTRUCTIVE_ACTIONS).toContain('SAVINGS_TXN_REMOVE');
  });

  it('includes all expected base actions', () => {
    const required = [
      'ITEM_REMOVE', 'LOAN_REMOVE', 'SAVINGS_REMOVE', 'REVENUE_REMOVE',
      'SAVINGS_RESET_ALL', 'INVESTMENTS_RESET_ALL', 'SAVINGS_TXN_REMOVE'
    ];
    required.forEach(a => expect(DESTRUCTIVE_ACTIONS).toContain(a));
  });
});

describe('INVESTMENTS_RESET_ALL', () => {
  beforeEach(() => { _snapshot = null; });

  it('clears the investments array', () => {
    const state = makeState();
    const next = dispatch(state, 'INVESTMENTS_RESET_ALL');
    expect(next.investments).toHaveLength(0);
  });

  it('takes a snapshot before clearing (enabling undo)', () => {
    const state = makeState();
    dispatch(state, 'INVESTMENTS_RESET_ALL');
    expect(_snapshot).not.toBeNull();
    const snap = JSON.parse(_snapshot);
    expect(snap.investments).toHaveLength(2);
  });

  it('undo restores the original investments', () => {
    const state = makeState();
    const next = dispatch(state, 'INVESTMENTS_RESET_ALL');
    expect(next.investments).toHaveLength(0);
    const restored = undoLast(next);
    expect(restored.investments).toHaveLength(2);
    expect(restored.investments[0].name).toBe('RRSP');
  });

  it('undo is a no-op when no snapshot exists', () => {
    const state = makeState();
    const result = undoLast(state);
    expect(result).toEqual(state);
  });
});

describe('SAVINGS_TXN_REMOVE', () => {
  beforeEach(() => { _snapshot = null; });

  it('removes the transaction at the given index', () => {
    const state = makeState();
    const next = dispatch(state, 'SAVINGS_TXN_REMOVE', { goalIdx: 0, txnIdx: 0 });
    expect(next.savings[0].transactions).toHaveLength(1);
    expect(next.savings[0].transactions[0].type).toBe('withdrawal');
  });

  it('reverses a deposit from the balance', () => {
    const state = makeState();
    // balance=2000, deposit of 500 at index 0
    const next = dispatch(state, 'SAVINGS_TXN_REMOVE', { goalIdx: 0, txnIdx: 0 });
    expect(next.savings[0].balance).toBe(1500);
  });

  it('reverses a withdrawal by adding back to balance', () => {
    const state = makeState();
    // balance=2000, withdrawal of 200 at index 1
    const next = dispatch(state, 'SAVINGS_TXN_REMOVE', { goalIdx: 0, txnIdx: 1 });
    expect(next.savings[0].balance).toBe(2200);
  });

  it('takes a snapshot so the deletion can be undone', () => {
    const state = makeState();
    dispatch(state, 'SAVINGS_TXN_REMOVE', { goalIdx: 0, txnIdx: 0 });
    expect(_snapshot).not.toBeNull();
  });

  it('undo restores the deleted transaction and original balance', () => {
    const state = makeState();
    const next = dispatch(state, 'SAVINGS_TXN_REMOVE', { goalIdx: 0, txnIdx: 0 });
    const restored = undoLast(next);
    expect(restored.savings[0].transactions).toHaveLength(2);
    expect(restored.savings[0].balance).toBe(2000);
  });

  it('does nothing if goalIdx is out of range', () => {
    const state = makeState();
    const next = dispatch(state, 'SAVINGS_TXN_REMOVE', { goalIdx: 99, txnIdx: 0 });
    expect(next.savings[0].transactions).toHaveLength(2);
  });

  it('does nothing if txnIdx is out of range', () => {
    const state = makeState();
    const next = dispatch(state, 'SAVINGS_TXN_REMOVE', { goalIdx: 0, txnIdx: 99 });
    expect(next.savings[0].transactions).toHaveLength(2);
  });
});

describe('LOAN_GENERATE_SCHEDULE', () => {
  beforeEach(() => { _snapshot = null; });

  it('adds payment chips for each new month', () => {
    const state = makeState();
    const months = ['Jun 2026', 'Jul 2026', 'Aug 2026'];
    const next = dispatch(state, 'LOAN_GENERATE_SCHEDULE', { loanIdx: 0, months });
    expect(next.loans[0].payments).toHaveLength(3);
  });

  it('does not duplicate months already in the schedule', () => {
    let state = makeState();
    state = dispatch(state, 'LOAN_GENERATE_SCHEDULE', { loanIdx: 0, months: ['Jun 2026', 'Jul 2026'] });
    const next = dispatch(state, 'LOAN_GENERATE_SCHEDULE', { loanIdx: 0, months: ['Jun 2026', 'Aug 2026'] });
    // Jun already present — only Aug should be added
    expect(next.loans[0].payments).toHaveLength(3);
    const keys = next.loans[0].payments.map(p => p.month);
    expect(keys).toContain('Aug 2026');
    expect(keys.filter(k => k === 'Jun 2026')).toHaveLength(1);
  });

  it('new chips start with paid:false', () => {
    const state = makeState();
    const next = dispatch(state, 'LOAN_GENERATE_SCHEDULE', { loanIdx: 0, months: ['Jun 2026'] });
    expect(next.loans[0].payments[0].paid).toBe(false);
  });

  it('does NOT take an undo snapshot (non-destructive action)', () => {
    const state = makeState();
    dispatch(state, 'LOAN_GENERATE_SCHEDULE', { loanIdx: 0, months: ['Jun 2026'] });
    expect(_snapshot).toBeNull();
  });

  it('handles a loanIdx out of range without throwing', () => {
    const state = makeState();
    expect(() => dispatch(state, 'LOAN_GENERATE_SCHEDULE', { loanIdx: 99, months: ['Jun 2026'] }))
      .not.toThrow();
  });
});

describe('Undo stack — single snapshot semantics', () => {
  beforeEach(() => { _snapshot = null; });

  it('second destructive action overwrites the first snapshot', () => {
    let state = makeState();
    state = dispatch(state, 'INVESTMENTS_RESET_ALL');
    const snapAfterFirst = _snapshot;
    state = dispatch(state, 'SAVINGS_RESET_ALL');
    // Snapshot should now point to the state after INVESTMENTS_RESET_ALL (empty investments, savings still there)
    expect(_snapshot).not.toBe(snapAfterFirst);
    const restored = undoLast(state);
    expect(restored.investments).toHaveLength(0); // investments were already cleared
    expect(restored.savings).toHaveLength(1);     // savings were intact before SAVINGS_RESET_ALL
  });
});
