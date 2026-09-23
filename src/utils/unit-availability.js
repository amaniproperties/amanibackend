function arr(value) {
  return Array.isArray(value) ? value : [];
}

function dateValue(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toISOString().slice(0, 10);
}

function earliest(values) {
  return values.map(dateValue).filter(Boolean).sort()[0] || '';
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeUnitAvailability(
  unit,
  { todayValue = new Date().toISOString().slice(0,10), normalizeImagePath = (v => v) } = {}
) {
  const status = normalizeStatus(unit.status);
  const today = dateValue(todayValue);

  const tenancies = arr(unit.unit_tenancies);
  const occupyingTenancies = tenancies.filter(t =>
    ['occupied', 'defaulted'].includes(normalizeStatus(t.status))
  );

  const activeReservations = arr(unit.unit_reservations).filter(r => {
    if (normalizeStatus(r.status) !== 'active') return false;
    const expiry = dateValue(r.reservation_expiry_date);
    return !expiry || expiry >= today;
  });

  // Do not use notice_date as availability: it is when notice was submitted.
  const vacateDates = occupyingTenancies.flatMap(t => {
    const notices = arr(t.tenancy_notices)
      .filter(n =>
        ['active', 'completed'].includes(normalizeStatus(n.status)) &&
        ['vacate', 'termination', 'landlord_notice'].includes(normalizeStatus(n.notice_type))
      )
      .flatMap(n => [n.vacate_date, n.effective_date]);

    return [
      ...notices,
      t.intended_move_out_date,
      t.move_out_date,
      t.lease_end_date,
      t.contract_end_date
    ];
  });

  const nextDate = earliest([unit.availability_date, ...vacateDates]);

  const hasDueMoveOut = occupyingTenancies.some(t => {
    const dates = [
      t.move_out_date,
      ...arr(t.tenancy_notices)
        .filter(n =>
          ['active', 'completed'].includes(normalizeStatus(n.status)) &&
          ['vacate', 'termination', 'landlord_notice'].includes(normalizeStatus(n.notice_type))
        )
        .flatMap(n => [n.vacate_date, n.effective_date])
    ].map(dateValue).filter(Boolean);

    return dates.some(d => d <= today);
  });

  const hasOccupant = occupyingTenancies.length > 0 && !hasDueMoveOut;
  const isReserved = status === 'reserved' || activeReservations.length > 0;
  const isHardUnavailable = ['blocked', 'inactive'].includes(status);
  const maintenanceMarketable = status === 'maintenance';

  const availableNow =
    !isReserved &&
    !isHardUnavailable &&
    (
      status === 'vacant' ||
      maintenanceMarketable ||
      hasDueMoveOut ||
      (status === 'occupied' && !hasOccupant)
    );

  const comingSoon =
    !availableNow &&
    !isReserved &&
    !isHardUnavailable &&
    hasOccupant &&
    !!nextDate &&
    nextDate > today;

  return {
    ...unit,
    id: unit.id,
    unit_id: unit.id,
    unit_name: unit.unit_code || unit.unit_title || unit.unit_name || 'Unit',
    thumbnail: normalizeImagePath(unit.thumbnail, unit.property_id),
    public_availability_status: availableNow
      ? 'vacant'
      : comingSoon
        ? 'coming_soon'
        : isReserved
          ? 'reserved'
          : 'not_available',
    public_available_from: availableNow ? '' : (comingSoon ? nextDate : ''),
    is_available_now: availableNow,
    is_coming_soon: comingSoon
  };
}
