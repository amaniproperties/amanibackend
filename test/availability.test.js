import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUnitAvailability as normalizeUnit } from '../src/utils/unit-availability.js';

const TODAY = '2026-09-23';

function unit(overrides = {}) {
  return {
    id: 'unit-1',
    unit_code: 'A1',
    property_id: 'property-1',
    status: 'occupied',
    availability_date: null,
    unit_tenancies: [],
    unit_reservations: [],
    ...overrides
  };
}

test('vacated tenancy with stale occupied unit becomes available now', () => {
  const result = normalizeUnit(unit({
    unit_tenancies: [{ status: 'vacated', tenancy_notices: [] }]
  }), { todayValue: TODAY });
  assert.equal(result.is_available_now, true);
  assert.equal(result.public_availability_status, 'vacant');
});

test('future vacate notice becomes coming soon using vacate date, not notice date', () => {
  const result = normalizeUnit(unit({
    unit_tenancies: [{
      status: 'occupied',
      tenancy_notices: [{
        status: 'active',
        notice_type: 'vacate',
        notice_date: '2026-09-01',
        vacate_date: '2026-10-01'
      }]
    }]
  }), { todayValue: TODAY });
  assert.equal(result.is_available_now, false);
  assert.equal(result.is_coming_soon, true);
  assert.equal(result.public_available_from, '2026-10-01');
});

test('due vacate notice becomes available now', () => {
  const result = normalizeUnit(unit({
    unit_tenancies: [{
      status: 'occupied',
      tenancy_notices: [{
        status: 'active',
        notice_type: 'vacate',
        notice_date: '2026-08-01',
        vacate_date: '2026-09-23'
      }]
    }]
  }), { todayValue: TODAY });
  assert.equal(result.is_available_now, true);
  assert.equal(result.public_availability_status, 'vacant');
});

test('maintenance unit is marketable but maintenance is never exposed publicly', () => {
  const result = normalizeUnit(unit({ status: 'maintenance' }), { todayValue: TODAY });
  assert.equal(result.is_available_now, true);
  assert.equal(result.public_availability_status, 'vacant');
  assert.notEqual(result.public_availability_status, 'maintenance');
});

test('defaulted tenant still occupies unit until due move-out', () => {
  const result = normalizeUnit(unit({
    unit_tenancies: [{ status: 'defaulted', tenancy_notices: [] }]
  }), { todayValue: TODAY });
  assert.equal(result.is_available_now, false);
});

test('active reservation blocks an otherwise vacant unit', () => {
  const result = normalizeUnit(unit({
    status: 'vacant',
    unit_reservations: [{ status: 'active', reservation_expiry_date: '2026-09-30' }]
  }), { todayValue: TODAY });
  assert.equal(result.is_available_now, false);
  assert.equal(result.public_availability_status, 'reserved');
});

test('expired reservation does not block a vacant unit', () => {
  const result = normalizeUnit(unit({
    status: 'vacant',
    unit_reservations: [{ status: 'active', reservation_expiry_date: '2026-09-20' }]
  }), { todayValue: TODAY });
  assert.equal(result.is_available_now, true);
});
