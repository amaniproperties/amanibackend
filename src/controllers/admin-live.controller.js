import { supabaseAdmin } from '../db/supabase-admin.js';
import { ok, created, fail } from '../utils/http.js';

const MAX_LIMIT = 500;

const resources = {
  properties: {
    table: 'properties',
    label: 'Properties / Listings',
    titleField: 'title',
    search: ['title', 'slug', 'status', 'price_display', 'notes'],
    writable: ['id','slug','title','type_id','status','price_display','rent_amount','rent_period','year_built','location_id','stats_id','agent_id','financing_json','description_json','listed_date','notes','thumbnail','featured','legacy_json','parent_property_id','property_group_kind','structure_kind','has_multiple_units','total_floors','total_units','unit_summary_json'],
    required: ['id','title'],
    sort: 'updated_at'
  },
  units: {
    table: 'property_units',
    label: 'Property Units / Rooms',
    titleField: 'unit_code',
    search: ['unit_code','unit_title','unit_name','unit_type','unit_category','status','listing_type'],
    writable: ['legacy_id','slug','property_id','unit_code','unit_title','unit_type','block_name','floor_no','bedrooms','bathrooms','toilets','area_sqft','area_label','listing_type','rent_amount','rent_period','sale_amount','deposit_amount','service_charge_amount','currency_code','meter_no','parking_slots','furnishing_status','bathrooms_text','kitchens','status','availability_date','available_for_public','is_listed','is_active','sort_order','features_json','attributes_json','notes','internal_notes','floor_id','parent_unit_id','unit_name','unit_category','usage_type','office_rooms','square_feet','square_meters','listing_status','occupancy_status','pricing_model','currency','title','short_description','thumbnail','is_primary','is_published','metadata_json','price_display'],
    required: ['slug','property_id','unit_code'],
    sort: 'updated_at'
  },
  clients: {
    table: 'clients',
    label: 'Clients / Tenants',
    titleField: 'full_name',
    search: ['full_name','client_code','id_number','phone_primary','email','status'],
    writable: ['slug','client_code','first_name','middle_name','last_name','full_name','id_number','phone_primary','phone_secondary','whatsapp_number','email','date_of_birth','gender','nationality','occupation','employer_name','marital_status','postal_address','physical_address','preferred_contact_method','status','notes','metadata_json'],
    required: ['full_name'],
    sort: 'updated_at'
  },
  tenancies: {
    table: 'unit_tenancies',
    label: 'Tenancies / Rentals',
    titleField: 'tenant_name',
    search: ['tenant_name','full_name','tenant_phone','tenant_email','tenant_id_no','status','contract_status','tenant_status'],
    writable: ['legacy_id','slug','unit_id','tenant_name','tenant_phone','tenant_email','tenant_id_no','occupant_count','employer_name','emergency_contact_json','lease_start_date','lease_end_date','move_in_date','move_out_date','monthly_rent','deposit_amount','balance_amount','billing_day','payment_terms','status','is_primary_record','is_notice_given','metadata_json','notes','internal_notes','first_name','middle_name','last_name','full_name','phone_secondary','whatsapp_number','date_of_birth','gender','nationality','occupation','marital_status','postal_address','physical_address','preferred_contact_method','id_document_type','id_document_expiry_date','employer_phone','employer_address','contract_status','contract_start_date','contract_end_date','contract_signed_date','contract_sent_at','contract_email_sent','contract_whatsapp_sent','intended_move_out_date','tenancy_source','tenant_status','deposit_breakdown_json','billing_summary_json','primary_client_id'],
    required: ['slug','unit_id'],
    sort: 'updated_at'
  },
  payments: {
    table: 'tenancy_payments',
    label: 'Payments / Receipts',
    titleField: 'receipt_no',
    search: ['reference_no','receipt_no','payment_method','status','notes'],
    writable: ['billing_account_id','tenancy_id','unit_id','payment_date','amount','currency_code','payment_method','reference_no','receipt_no','status','notes','metadata_json','client_id'],
    required: ['billing_account_id','tenancy_id','unit_id','amount','payment_method'],
    sort: 'payment_date'
  },
  'billing-accounts': {
    table: 'tenancy_billing_accounts',
    label: 'Billing Accounts',
    titleField: 'id',
    search: ['account_status','notes'],
    writable: ['tenancy_id','unit_id','currency_code','billing_day','account_status','opening_balance','notes','metadata_json','primary_client_id'],
    required: ['tenancy_id','unit_id'],
    sort: 'updated_at'
  },
  charges: {
    table: 'tenancy_charges',
    label: 'Billing Charges',
    titleField: 'description',
    search: ['charge_type','charge_code','description','status','notes'],
    writable: ['billing_account_id','tenancy_id','unit_id','charge_type','charge_code','description','amount','currency_code','billing_period_start','billing_period_end','charge_date','due_date','status','is_recurring','notes','metadata_json'],
    required: ['billing_account_id','tenancy_id','unit_id','charge_type','amount'],
    sort: 'charge_date'
  },
  notices: {
    table: 'tenancy_notices',
    label: 'Notices / Vacating',
    titleField: 'notice_type',
    search: ['notice_type','status','reason','remarks'],
    writable: ['legacy_id','slug','tenancy_id','notice_type','notice_date','effective_date','vacate_date','status','reason','remarks','metadata_json'],
    required: ['tenancy_id','notice_date'],
    sort: 'updated_at'
  },
  contracts: {
    table: 'tenancy_contracts',
    label: 'Contracts / Lease Documents',
    titleField: 'contract_number',
    search: ['contract_number','contract_template_name','contract_version','contract_status','notes'],
    writable: ['slug','contract_number','tenancy_id','unit_id','contract_template_name','contract_version','contract_status','start_date','end_date','signed_date','activation_date','pdf_file_path','email_sent','email_sent_at','whatsapp_sent','whatsapp_sent_at','notes','metadata_json','primary_client_id'],
    required: ['tenancy_id','unit_id','start_date','end_date'],
    sort: 'updated_at'
  },
  agents: {
    table: 'agents',
    label: 'Agents / Staff / Team',
    titleField: 'name',
    search: ['name','role','location','availability','bio'],
    writable: ['legacy_id','slug','name','role','location','languages','image','status','specialties','quote','stats_json','contact_json','socials_json','cta_json','avatar','background_image','availability','bio','mission','timeline_json','office_json','achievements_json','metrics_json','service_areas_json','is_synthetic'],
    required: ['legacy_id','name'],
    sort: 'updated_at'
  },
  locations: {
    table: 'locations',
    label: 'Locations / Property Areas',
    titleField: 'name',
    search: ['name','slug','lineage'],
    writable: ['legacy_id','parent_id','slug','name','depth','lineage','is_synthetic'],
    required: ['legacy_id','name'],
    sort: 'updated_at'
  },
  maintenance: {
    table: 'unit_maintenance_tickets',
    label: 'Maintenance / Service Requests',
    titleField: 'ticket_number',
    search: ['ticket_number','issue_type','priority','status','assigned_to','description','resolution_notes'],
    writable: ['unit_id','tenancy_id','client_id','ticket_number','issue_type','priority','status','reported_date','assigned_to','assigned_phone','scheduled_date','completed_at','estimated_cost','actual_cost','description','resolution_notes','metadata_json'],
    required: ['unit_id','issue_type'],
    sort: 'updated_at'
  },
  reservations: {
    table: 'unit_reservations',
    label: 'Reservations / Applications',
    titleField: 'reserver_name',
    search: ['reserver_name','reserver_phone','reserver_email','reserver_id_no','status','notes'],
    writable: ['slug','unit_id','tenancy_id','reserver_name','reserver_phone','reserver_email','reserver_id_no','reservation_date','expected_move_in_date','reservation_expiry_date','reservation_fee_amount','currency_code','status','notes','metadata_json','client_id'],
    required: ['unit_id','reserver_name'],
    sort: 'updated_at'
  },
  documents: {
    table: 'client_documents',
    label: 'Client Documents',
    titleField: 'document_title',
    search: ['document_type','document_title','file_path','notes'],
    writable: ['slug','client_id','document_type','document_title','file_path','file_mime_type','file_size_bytes','issue_date','expiry_date','is_verified','verified_at','notes','metadata_json'],
    required: ['client_id','document_type','file_path'],
    sort: 'updated_at'
  },
  features: {
    table: 'features',
    label: 'Property Features',
    titleField: 'name',
    search: ['name','slug','legacy_id'],
    writable: ['legacy_id','slug','name','is_synthetic'],
    required: ['legacy_id','name'],
    sort: 'updated_at'
  },
  media: {
    table: 'property_images',
    label: 'Property Media',
    titleField: 'file_path',
    search: ['image_role','file_path','alt_text'],
    writable: ['property_id','image_role','file_path','alt_text','sort_order'],
    required: ['property_id','image_role','file_path'],
    sort: 'updated_at'
  },
  content: {
    table: 'content_sections',
    label: 'Website Content Sections',
    titleField: 'title',
    search: ['label','title','subtitle','body','slug'],
    writable: ['id','label','title','subtitle','body','metadata','slug'],
    required: ['id','label','slug'],
    sort: 'updated_at'
  },
  services: {
    table: 'services',
    label: 'Amani Services',
    titleField: 'title',
    search: ['title','description','slug'],
    writable: ['legacy_id','slug','icon','title','description','features_json','cta_text','cta_href','aos_delay'],
    required: ['legacy_id','title'],
    sort: 'updated_at'
  },
  'contract-delivery': {
    table: 'contract_delivery_queue',
    label: 'Contract Delivery Queue',
    titleField: 'recipient_value',
    search: ['channel','recipient_value','queue_status','error_message'],
    writable: ['contract_id','tenancy_id','client_id','channel','recipient_value','queue_status','attempts','last_attempt_at','processed_at','error_message','metadata_json'],
    required: ['contract_id','tenancy_id','channel','recipient_value'],
    sort: 'updated_at'
  }
};

function getResource(name) {
  return resources[String(name || '').trim().toLowerCase()] || null;
}

function limitValue(value, fallback = 100) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function offsetValue(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function pick(source, allowed) {
  const out = {};
  for (const field of allowed) {
    if (Object.prototype.hasOwnProperty.call(source || {}, field)) out[field] = source[field];
  }
  return out;
}

function requiredMissing(payload, required) {
  return required.filter((field) => payload[field] === undefined || payload[field] === null || payload[field] === '');
}

function statusForDbError(error, operation = '') {
  const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  if (text.includes('23503') || text.includes('foreign key')) return 409;
  if (text.includes('23505') || text.includes('duplicate')) return 409;
  if (text.includes('23514') || text.includes('check constraint')) return 400;
  if (operation === 'delete') return 409;
  return 500;
}

function publicResource(resource) {
  return {
    key: resource.key,
    table: resource.table,
    label: resource.label,
    titleField: resource.titleField,
    writable: resource.writable,
    required: resource.required,
    search: resource.search
  };
}

export function listResourceDefinitions(_req, res) {
  const data = Object.entries(resources).map(([key, value]) => publicResource({ key, ...value }));
  return ok(res, data);
}

export async function listLiveResource(req, res) {
  try {
    const resource = getResource(req.params.resource);
    if (!resource) return fail(res, 404, `Unknown Amani resource: ${req.params.resource}`);

    const limit = limitValue(req.query.limit, 100);
    const offset = offsetValue(req.query.offset);
    let query = supabaseAdmin.from(resource.table).select('*', { count: 'exact' });

    const search = String(req.query.search || req.query.q || '').trim();
    if (search && resource.search.length) {
      const safe = search.replace(/[,%()]/g, ' ').trim();
      if (safe) query = query.or(resource.search.map((field) => `${field}.ilike.%${safe}%`).join(','));
    }

    if (req.query.status && resource.writable.includes('status')) query = query.eq('status', req.query.status);
    if (req.query.property_id && resource.writable.includes('property_id')) query = query.eq('property_id', req.query.property_id);
    if (req.query.client_id && resource.writable.includes('client_id')) query = query.eq('client_id', req.query.client_id);
    if (req.query.unit_id && resource.writable.includes('unit_id')) query = query.eq('unit_id', req.query.unit_id);
    if (req.query.tenancy_id && resource.writable.includes('tenancy_id')) query = query.eq('tenancy_id', req.query.tenancy_id);

    if (resource.sort) query = query.order(resource.sort, { ascending: false });
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) return fail(res, statusForDbError(error), error.message, error);

    return ok(res, data || [], {
      resource: req.params.resource,
      table: resource.table,
      total: count || 0,
      limit,
      offset
    });
  } catch (error) {
    return fail(res, 500, 'Failed to load Amani records', error.message);
  }
}

export async function getLiveResource(req, res) {
  try {
    const resource = getResource(req.params.resource);
    if (!resource) return fail(res, 404, `Unknown Amani resource: ${req.params.resource}`);

    const { data, error } = await supabaseAdmin
      .from(resource.table)
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) return fail(res, statusForDbError(error), error.message, error);
    if (!data) return fail(res, 404, `${resource.label} record not found`);
    return ok(res, data, { resource: req.params.resource, table: resource.table });
  } catch (error) {
    return fail(res, 500, 'Failed to load Amani record', error.message);
  }
}

export async function createLiveResource(req, res) {
  try {
    const resource = getResource(req.params.resource);
    if (!resource) return fail(res, 404, `Unknown Amani resource: ${req.params.resource}`);
    const payload = pick(req.body || {}, resource.writable);
    const missing = requiredMissing(payload, resource.required);
    if (missing.length) return fail(res, 400, `Required field(s): ${missing.join(', ')}`);

    const { data, error } = await supabaseAdmin.from(resource.table).insert(payload).select('*').single();
    if (error) return fail(res, statusForDbError(error), error.message, error);
    return created(res, data, { resource: req.params.resource, table: resource.table });
  } catch (error) {
    return fail(res, 500, 'Failed to create Amani record', error.message);
  }
}

export async function updateLiveResource(req, res) {
  try {
    const resource = getResource(req.params.resource);
    if (!resource) return fail(res, 404, `Unknown Amani resource: ${req.params.resource}`);
    const payload = pick(req.body || {}, resource.writable);
    delete payload.id;
    if (!Object.keys(payload).length) return fail(res, 400, 'No writable fields were supplied');

    const { data, error } = await supabaseAdmin.from(resource.table).update(payload).eq('id', req.params.id).select('*').maybeSingle();
    if (error) return fail(res, statusForDbError(error), error.message, error);
    if (!data) return fail(res, 404, `${resource.label} record not found`);
    return ok(res, data, { resource: req.params.resource, table: resource.table });
  } catch (error) {
    return fail(res, 500, 'Failed to update Amani record', error.message);
  }
}

export async function deleteLiveResource(req, res) {
  try {
    const resource = getResource(req.params.resource);
    if (!resource) return fail(res, 404, `Unknown Amani resource: ${req.params.resource}`);

    const { data, error } = await supabaseAdmin.from(resource.table).delete().eq('id', req.params.id).select('*').maybeSingle();
    if (error) return fail(res, statusForDbError(error, 'delete'), error.message, error);
    if (!data) return fail(res, 404, `${resource.label} record not found`);
    return ok(res, data, { resource: req.params.resource, table: resource.table, deleted: true });
  } catch (error) {
    return fail(res, 500, 'Failed to delete Amani record', error.message);
  }
}

async function countTable(table) {
  const { count, error } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

async function rows(table, columns, orderBy = null) {
  const all = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    let query = supabaseAdmin.from(table).select(columns).range(offset, offset + pageSize - 1);
    if (orderBy) query = query.order(orderBy, { ascending: true });
    const { data, error } = await query;
    if (error) throw error;
    const batch = data || [];
    all.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

function groupCount(items, key, fallback = 'Unspecified') {
  const counts = new Map();
  for (const item of items) {
    const label = String(item?.[key] ?? '').trim() || fallback;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()].sort((a,b) => b[1]-a[1]).map(([label, value]) => ({ label, value }));
}

function monthKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

function groupSumByMonth(items, dateField, amountField, filter = () => true) {
  const totals = new Map();
  for (const item of items) {
    if (!filter(item)) continue;
    const key = monthKey(item?.[dateField]);
    if (!key) continue;
    const amount = Number(item?.[amountField] || 0);
    totals.set(key, (totals.get(key) || 0) + (Number.isFinite(amount) ? amount : 0));
  }
  return [...totals.entries()].sort((a,b) => a[0].localeCompare(b[0])).slice(-12).map(([label,value]) => ({ label, value }));
}

function chart(rows) {
  return { labels: rows.map(x => x.label), values: rows.map(x => x.value), rows };
}

function comparisonChart(series) {
  const labels = [...new Set(series.flatMap(item => item.rows.map(row => row.label)))].sort((a,b) => a.localeCompare(b)).slice(-12);
  return {
    labels,
    datasets: series.map(item => {
      const values = new Map(item.rows.map(row => [row.label, row.value]));
      return { label: item.label, values: labels.map(label => values.get(label) || 0) };
    })
  };
}

function valueChart(entries) {
  return chart(entries.map(([label,value]) => ({ label, value:Number(value || 0) })));
}

export async function getLiveAnalytics(_req, res) {
  try {
    const [
      totalProperties,totalUnits,totalClients,totalTenancies,totalPayments,totalContracts,totalNotices,totalReservations,totalMaintenance,
      properties,units,tenancies,payments,charges,contracts,notices,reservations,maintenance
    ] = await Promise.all([
      countTable('properties'), countTable('property_units'), countTable('clients'), countTable('unit_tenancies'),
      countTable('tenancy_payments'), countTable('tenancy_contracts'), countTable('tenancy_notices'), countTable('unit_reservations'), countTable('unit_maintenance_tickets'),
      rows('properties','id,status,type_id,featured,created_at,updated_at,title'),
      rows('property_units','id,status,listing_type,property_id,rent_amount,created_at,updated_at,unit_code'),
      rows('unit_tenancies','id,status,tenant_status,contract_status,monthly_rent,balance_amount,lease_start_date,created_at,updated_at,tenant_name,unit_id'),
      rows('tenancy_payments','id,payment_date,amount,payment_method,status,unit_id,tenancy_id,receipt_no,reference_no,created_at'),
      rows('tenancy_charges','id,charge_date,amount,charge_type,status,due_date,unit_id,tenancy_id,created_at'),
      rows('tenancy_contracts','id,contract_status,start_date,end_date,unit_id,tenancy_id,contract_number,updated_at'),
      rows('tenancy_notices','id,notice_type,notice_date,vacate_date,status,tenancy_id,updated_at'),
      rows('unit_reservations','id,status,reservation_date,reservation_fee_amount,unit_id,reserver_name,updated_at'),
      rows('unit_maintenance_tickets','id,status,priority,issue_type,estimated_cost,actual_cost,unit_id,reported_date,updated_at')
    ]);

    const receivedPayments = payments.filter(p => String(p.status || '').toLowerCase() === 'received');
    const receivedTotal = receivedPayments.reduce((sum,p) => sum + Number(p.amount || 0), 0);
    const outstandingCharges = charges.filter(c => ['posted','partially_paid'].includes(String(c.status || '').toLowerCase()));
    const outstandingTotal = outstandingCharges.reduce((sum,c) => sum + Number(c.amount || 0), 0);
    const monthlyReceivedRows = groupSumByMonth(payments,'payment_date','amount',p => String(p.status || '').toLowerCase() === 'received');
    const monthlyChargeRows = groupSumByMonth(charges,'charge_date','amount',c => ['posted','partially_paid','paid'].includes(String(c.status || '').toLowerCase()));

    return ok(res, {
      generated_at: new Date().toISOString(),
      stats: {
        total_properties: totalProperties,
        total_units: totalUnits,
        total_clients: totalClients,
        total_tenancies: totalTenancies,
        total_payments: totalPayments,
        total_contracts: totalContracts,
        total_notices: totalNotices,
        total_reservations: totalReservations,
        total_maintenance: totalMaintenance,
        received_payments_amount: receivedTotal,
        outstanding_charges_amount: outstandingTotal,
        occupied_units: units.filter(x => String(x.status || '').toLowerCase() === 'occupied').length,
        vacant_units: units.filter(x => String(x.status || '').toLowerCase() === 'vacant').length,
        active_tenancies: tenancies.filter(x => ['occupied','reserved'].includes(String(x.status || '').toLowerCase())).length
      },
      charts: {
        properties_by_status: chart(groupCount(properties,'status')),
        units_by_status: chart(groupCount(units,'status')),
        tenancies_by_status: chart(groupCount(tenancies,'status')),
        payments_by_method: chart(groupCount(receivedPayments,'payment_method')),
        monthly_received_payments: chart(monthlyReceivedRows),
        monthly_financial_comparison: comparisonChart([
          { label:'Received payments', rows:monthlyReceivedRows },
          { label:'Posted / paid charges', rows:monthlyChargeRows }
        ]),
        charges_by_type: chart(groupCount(charges,'charge_type')),
        contracts_by_status: chart(groupCount(contracts,'contract_status')),
        notices_by_type: chart(groupCount(notices,'notice_type')),
        reservations_by_status: chart(groupCount(reservations,'status')),
        maintenance_by_status: chart(groupCount(maintenance,'status')),
        maintenance_by_priority: chart(groupCount(maintenance,'priority')),
        portfolio_snapshot: valueChart([
          ['Properties',totalProperties],['Units',totalUnits],
          ['Occupied units',units.filter(x => String(x.status || '').toLowerCase() === 'occupied').length],
          ['Vacant units',units.filter(x => String(x.status || '').toLowerCase() === 'vacant').length]
        ]),
        financial_position: valueChart([
          ['Received payments',receivedTotal],['Outstanding charges',outstandingTotal]
        ]),
        operational_volume: valueChart([
          ['Clients',totalClients],['Tenancies',totalTenancies],['Contracts',totalContracts],
          ['Notices',totalNotices],['Reservations',totalReservations],['Maintenance',totalMaintenance]
        ])
      },
      recent: {
        properties: [...properties].sort((a,b) => String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))).slice(0,12),
        units: [...units].sort((a,b) => String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))).slice(0,12),
        payments: [...payments].sort((a,b) => String(b.payment_date||b.created_at||'').localeCompare(String(a.payment_date||a.created_at||''))).slice(0,12),
        tenancies: [...tenancies].sort((a,b) => String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))).slice(0,12),
        contracts: [...contracts].sort((a,b) => String(b.updated_at||'').localeCompare(String(a.updated_at||''))).slice(0,12),
        notices: [...notices].sort((a,b) => String(b.updated_at||b.notice_date||'').localeCompare(String(a.updated_at||a.notice_date||''))).slice(0,12),
        reservations: [...reservations].sort((a,b) => String(b.updated_at||b.reservation_date||'').localeCompare(String(a.updated_at||a.reservation_date||''))).slice(0,12),
        maintenance: [...maintenance].sort((a,b) => String(b.updated_at||b.reported_date||'').localeCompare(String(a.updated_at||a.reported_date||''))).slice(0,12)
      }
    });
  } catch (error) {
    return fail(res, 500, 'Failed to calculate Amani analytics from base tables', error.message);
  }
}

export async function getLiveIntegrity(_req, res) {
  const results = [];
  for (const [key, resource] of Object.entries(resources)) {
    try {
      const count = await countTable(resource.table);
      results.push({ resource: key, table: resource.table, ok: true, count });
    } catch (error) {
      results.push({ resource: key, table: resource.table, ok: false, count: 0, error: error.message });
    }
  }
  return ok(res, {
    ok: results.every(x => x.ok),
    checked_at: new Date().toISOString(),
    results
  });
}

export { resources };
