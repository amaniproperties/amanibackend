import { supabaseAdmin } from '../db/supabase-admin.js';
import { ok, created, fail } from '../utils/http.js';
import { sendPropertyVisitRequest } from '../services/booking-email.service.js';

const arr = (value) => Array.isArray(value) ? value : [];

function normalizeImagePath(path, propertyId = '') {
  if (!path) return '';
  const raw = String(path).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/') || raw.startsWith('img/')) return raw;
  return propertyId ? `img/rental/${propertyId}/${raw}` : `img/${raw}`;
}

function buildLocationTree(rows) {
  const items = arr(rows).map(row => ({ ...row, children: [] }));
  const map = new Map(items.map(item => [String(item.id), item]));
  const roots = [];
  for (const item of items) {
    const parent = item.parent_id ? map.get(String(item.parent_id)) : null;
    if (parent) parent.children.push(item); else roots.push(item);
  }
  return roots;
}

function mapProperty(row) {
  const images = arr(row.property_images)
    .slice()
    .sort((a,b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map(image => ({ ...image, file_path: normalizeImagePath(image.file_path, row.id) }));
  const thumbnail = normalizeImagePath(row.thumbnail, row.id) || images.find(x => x.image_role === 'thumbnail')?.file_path || images[0]?.file_path || '';
  return {
    ...row,
    thumbnail,
    image: thumbnail,
    images: images.map(x => x.file_path).filter(Boolean),
    gallery: images.map(x => ({ file: x.file_path, alt: x.alt_text || row.title || '' })),
    category_ids: arr(row.property_category_map).map(x => x.category_id).filter(Boolean),
    feature_ids: arr(row.property_feature_map).map(x => x.feature_id).filter(Boolean),
    location_name: row.locations?.name || '',
    agent_name: row.agents?.name || ''
  };
}

function dateValue(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0,10);
}

function earliest(values) {
  return values.map(dateValue).filter(Boolean).sort()[0] || '';
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUnit(unit) {
  const status = normalizeStatus(unit.status);
  const tenancies = arr(unit.unit_tenancies).filter(t => ['occupied','reserved','active'].includes(normalizeStatus(t.status)));
  const noticeDates = tenancies.flatMap(t => arr(t.tenancy_notices)
    .filter(n => normalizeStatus(n.status) === 'active')
    .flatMap(n => [n.vacate_date, n.effective_date, n.notice_date]));
  const moveDates = tenancies.flatMap(t => [t.intended_move_out_date,t.move_out_date,t.lease_end_date,t.contract_end_date]);
  const nextDate = earliest([unit.availability_date, ...noticeDates, ...moveDates]);
  const availableNow = status === 'vacant';
  const comingSoon = status === 'occupied' && !!nextDate;
  return {
    ...unit,
    id: unit.id,
    unit_id: unit.id,
    unit_name: unit.unit_code || unit.unit_title || unit.unit_name || 'Unit',
    thumbnail: normalizeImagePath(unit.thumbnail, unit.property_id),
    public_availability_status: availableNow ? 'vacant' : comingSoon ? 'coming_soon' : (status || 'not_available'),
    public_available_from: availableNow ? '' : nextDate,
    is_available_now: availableNow,
    is_coming_soon: comingSoon
  };
}

function availabilitySummary(units) {
  const summary = { total_units: units.length, available_now: 0, coming_soon: 0, occupied: 0, reserved: 0, maintenance: 0, blocked: 0, next_available_from: null };
  for (const unit of units) {
    if (unit.is_available_now) summary.available_now += 1;
    if (unit.is_coming_soon) summary.coming_soon += 1;
    const s = normalizeStatus(unit.status);
    if (Object.prototype.hasOwnProperty.call(summary, s)) summary[s] += 1;
    if (unit.public_available_from && (!summary.next_available_from || unit.public_available_from < summary.next_available_from)) summary.next_available_from = unit.public_available_from;
  }
  return summary;
}

async function propertyBySlugOrId(value, select = 'id,slug,title') {
  const key = String(value || '').trim();
  if (!key) return null;

  const byId = await supabaseAdmin.from('properties').select(select).eq('id', key).limit(1).maybeSingle();
  if (byId.error) throw byId.error;
  if (byId.data) return byId.data;

  const bySlug = await supabaseAdmin.from('properties').select(select).eq('slug', key).limit(1).maybeSingle();
  if (bySlug.error) throw bySlug.error;
  return bySlug.data;
}

async function publicUnits(propertyId = null) {
  let query = supabaseAdmin.from('property_units').select(`
    *,
    unit_tenancies (
      id,status,intended_move_out_date,move_out_date,lease_end_date,contract_end_date,
      tenancy_notices (id,status,notice_type,notice_date,effective_date,vacate_date)
    )
  `).eq('available_for_public', true).eq('is_listed', true).eq('is_active', true).order('sort_order', { ascending: true }).order('unit_code', { ascending: true });
  if (propertyId) query = query.eq('property_id', propertyId);
  const { data, error } = await query;
  if (error) throw error;
  return arr(data).map(normalizeUnit);
}

export async function getPropertyCategories(_req, res) {
  try {
    const { data, error } = await supabaseAdmin.from('property_categories').select('*').order('title', { ascending: true });
    if (error) throw error;
    return ok(res, arr(data).map(row => ({ ...row, count: row.item_count || 0, property_count: row.item_count || 0, image: row.icon || '' })));
  } catch (error) { return fail(res, 500, 'Failed to load property categories', error.message); }
}

export async function getProperties(_req, res) {
  try {
    const { data, error } = await supabaseAdmin.from('properties').select(`
      *,agents(id,name,role,contact_json),locations(id,name,slug),
      property_images(id,file_path,image_role,sort_order,alt_text),
      property_category_map(category_id),property_feature_map(feature_id)
    `).order('created_at', { ascending: false });
    if (error) throw error;
    return ok(res, arr(data).map(mapProperty));
  } catch (error) { return fail(res, 500, 'Failed to load properties', error.message); }
}

export async function getPropertiesWithAvailability(_req, res) {
  try {
    const [propertiesResult, units] = await Promise.all([
      supabaseAdmin.from('properties').select(`*,agents(id,name,role,contact_json),locations(id,name,slug),property_images(id,file_path,image_role,sort_order,alt_text),property_category_map(category_id),property_feature_map(feature_id)`).order('created_at', { ascending: false }),
      publicUnits()
    ]);
    if (propertiesResult.error) throw propertiesResult.error;
    const byProperty = new Map();
    for (const unit of units) {
      const key = String(unit.property_id);
      if (!byProperty.has(key)) byProperty.set(key, []);
      byProperty.get(key).push(unit);
    }
    return ok(res, arr(propertiesResult.data).map(row => {
      const property = mapProperty(row);
      const propertyUnits = byProperty.get(String(property.id)) || [];
      return { ...property, units: propertyUnits, availability_summary: availabilitySummary(propertyUnits) };
    }));
  } catch (error) { return fail(res, 500, 'Failed to load properties with availability', error.message); }
}

export async function getPropertyUnits(req, res) {
  try {
    const property = await propertyBySlugOrId(req.params.slugOrId);
    if (!property) return fail(res, 404, 'Property not found');
    const units = await publicUnits(property.id);
    return ok(res, { property, units, availability_summary: availabilitySummary(units) });
  } catch (error) { return fail(res, 500, 'Failed to load property units', error.message); }
}

export async function getPropertyAvailability(req, res) {
  try {
    const property = await propertyBySlugOrId(req.params.slugOrId);
    if (!property) return fail(res, 404, 'Property not found');
    const units = await publicUnits(property.id);
    return ok(res, availabilitySummary(units), { property, units });
  } catch (error) { return fail(res, 500, 'Failed to load property availability', error.message); }
}

export async function getPropertyHead(req, res) {
  try {
    const property = await propertyBySlugOrId(req.params.slugOrId, `*,property_headers(*),property_images(id,file_path,image_role,sort_order,alt_text)`);
    if (!property) return fail(res, 404, 'Property not found');
    const header = property.property_headers || {};
    const { data: headerImages, error: headerImagesError } = await supabaseAdmin
      .from('property_header_carousel_images')
      .select('image_path,display_order')
      .eq('property_header_id', property.id)
      .order('display_order', { ascending: true });
    if (headerImagesError) throw headerImagesError;
    const jsonImages = arr(header.carousel_images_json).map(x => normalizeImagePath(typeof x === 'string' ? x : (x?.src || x?.image_path || x?.file), property.id)).filter(Boolean);
    const dedicatedImages = arr(headerImages).map(x => normalizeImagePath(x.image_path, property.id)).filter(Boolean);
    const tableImages = arr(property.property_images).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)).map(x => normalizeImagePath(x.file_path, property.id)).filter(Boolean);
    return ok(res, { property_id: property.id, slug: property.slug, title: header.title || property.title, highlight: header.highlight || '', subtitle: header.subtitle || '', button_text: header.button_text || '', button_link: header.button_link || '', container_class: header.container_class || '', carousel_images: [...new Set([...dedicatedImages,...jsonImages,...tableImages])] });
  } catch (error) { return fail(res, 500, 'Failed to load property head', error.message); }
}

export async function getPropertyDetails(req, res) {
  try {
    // Only embed tables that have declared foreign keys in the supplied schema.
    // The legacy detail/media helper tables are loaded explicitly below so the
    // endpoint does not depend on undeclared PostgREST relationships.
    const property = await propertyBySlugOrId(
      req.params.slugOrId,
      `*,agents(*),locations(*),property_details(*),property_images(id,file_path,image_role,sort_order,alt_text)`
    );
    if (!property) return fail(res, 404, 'Property not found');

    const [mediaResult, featureResult, paragraphResult, units] = await Promise.all([
      supabaseAdmin.from('property_media').select('*').eq('property_id', property.id).order('display_order', { ascending: true }),
      supabaseAdmin.from('property_detail_features').select('*').eq('property_detail_id', property.id).order('display_order', { ascending: true }),
      supabaseAdmin.from('property_detail_paragraphs').select('*').eq('property_detail_id', property.id).order('display_order', { ascending: true }),
      publicUnits(property.id)
    ]);

    if (mediaResult.error) throw mediaResult.error;
    if (featureResult.error) throw featureResult.error;
    if (paragraphResult.error) throw paragraphResult.error;

    const details = property.property_details || {};
    const media = [
      ...arr(mediaResult.data).map(x => ({ src: normalizeImagePath(x.file_path, property.id), alt: x.alt_text || property.title || '' })),
      ...arr(property.property_images).map(x => ({ src: normalizeImagePath(x.file_path, property.id), alt: x.alt_text || property.title || '' }))
    ].filter(x => x.src);

    return ok(res, {
      property: mapProperty(property),
      details,
      gallery: media,
      paragraphs: [...arr(paragraphResult.data).map(x => x.paragraph_text), ...arr(details.full_description_json)].filter(Boolean),
      features: [...arr(featureResult.data).map(x => x.feature_text), ...arr(details.features_json)].filter(Boolean),
      units,
      availability_summary: availabilitySummary(units),
      price_display: property.price_display || '',
      map_embed: details.map_embed || ''
    });
  } catch (error) { return fail(res, 500, 'Failed to load property details', error.message); }
}

export async function getAgents(_req, res) {
  try {
    const { data, error } = await supabaseAdmin.from('agents').select('*').order('name', { ascending: true });
    if (error) throw error;
    return ok(res, arr(data).map(row => ({ ...row, stats: row.stats_json || [], contact: row.contact_json || {}, socials: row.socials_json || {}, cta: row.cta_json || {}, timeline: row.timeline_json || [], office: row.office_json || {}, achievements: row.achievements_json || [], metrics: row.metrics_json || {}, service_areas: row.service_areas_json || [] })));
  } catch (error) { return fail(res, 500, 'Failed to load agents', error.message); }
}

export async function getLocationsTree(_req, res) {
  try {
    const { data, error } = await supabaseAdmin.from('locations').select('*').order('depth', { ascending: true }).order('name', { ascending: true });
    if (error) throw error;
    return ok(res, buildLocationTree(data));
  } catch (error) { return fail(res, 500, 'Failed to load locations tree', error.message); }
}

export async function getDefaultFilters(_req, res) {
  try {
    const { data, error } = await supabaseAdmin.from('filters').select('*').limit(1).maybeSingle();
    if (error) throw error;
    return ok(res, data || {});
  } catch (error) { return fail(res, 500, 'Failed to load filters', error.message); }
}

export async function getPropertyTabs(_req, res) {
  try {
    const { data, error } = await supabaseAdmin.from('property_tabs').select('*').order('title', { ascending: true });
    if (error) throw error;
    return ok(res, data || []);
  } catch (error) { return fail(res, 500, 'Failed to load property tabs', error.message); }
}


export async function getNavigation(_req, res) {
  try {
    const { data: navbar, error: navbarError } = await supabaseAdmin
      .from('site_navbars')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (navbarError) throw navbarError;
    if (!navbar) return ok(res, { navBar: null });

    const { data: itemRows, error: itemsError } = await supabaseAdmin
      .from('site_nav_items')
      .select('*')
      .eq('navbar_id', navbar.id)
      .order('display_order', { ascending: true });
    if (itemsError) throw itemsError;

    const rows = arr(itemRows);
    const children = new Map();
    for (const row of rows) {
      if (!row.parent_id) continue;
      const key = String(row.parent_id);
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(row);
    }

    const items = rows.filter(row => !row.parent_id).map(row => {
      const nested = children.get(String(row.id)) || [];
      if (nested.length || String(row.item_type || '').toLowerCase() === 'dropdown') {
        return {
          type: 'dropdown',
          text: row.text,
          href: row.href || '#',
          classes: row.css_classes || '',
          items: nested.map(item => ({ text: item.text, href: item.href || '#', classes: item.css_classes || '' }))
        };
      }
      return { type: 'link', text: row.text, href: row.href || '#', classes: row.css_classes || 'nav-item nav-link' };
    });

    return ok(res, {
      navBar: {
        id: navbar.id,
        brand: {
          title: navbar.brand_title || navbar.name || '',
          link: navbar.brand_link || 'index.html',
          icon: {
            src: navbar.brand_icon_src || '',
            alt: navbar.brand_icon_alt || navbar.brand_title || navbar.name || '',
            width: navbar.brand_icon_width || null,
            height: navbar.brand_icon_height || null,
            style: navbar.brand_icon_style || ''
          }
        },
        items,
        cta: { text: navbar.cta_text || '', href: navbar.cta_href || '', classes: 'btn btn-primary px-3 d-none d-lg-flex' },
        rootClasses: navbar.root_classes || 'container-fluid nav-bar bg-transparent sticky-top',
        navClasses: navbar.nav_classes || 'navbar navbar-expand-lg bg-white navbar-light py-0 px-4',
        dropdownMenuClasses: navbar.dropdown_menu_classes || 'dropdown-menu rounded-0 m-0'
      }
    });
  } catch (error) { return fail(res, 500, 'Failed to load Amani navigation', error.message); }
}

export async function getFooter(_req, res) {
  try {
    const { data: footer, error: footerError } = await supabaseAdmin
      .from('site_footers')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (footerError) throw footerError;
    if (!footer) return ok(res, { footer: null });

    const [{ data: contacts, error: contactsError }, { data: links, error: linksError }] = await Promise.all([
      supabaseAdmin.from('footer_contact_items').select('*').eq('footer_id', footer.id).order('created_at', { ascending: true }),
      supabaseAdmin.from('footer_links').select('*').eq('footer_id', footer.id).order('display_order', { ascending: true })
    ]);
    if (contactsError) throw contactsError;
    if (linksError) throw linksError;

    const contact = arr(contacts)[0] || {};
    const allLinks = arr(links);
    const group = (name) => allLinks.filter(link => String(link.link_group || '').toLowerCase().includes(name));
    const social = group('social');
    const rightMenu = [...group('copyright'), ...group('right'), ...group('menu')];
    const gallery = allLinks.filter(link => link.image_src);
    const reserved = new Set([...social, ...rightMenu, ...gallery].map(x => x.id));
    let quick = group('quick');
    if (!quick.length) quick = allLinks.filter(link => !reserved.has(link.id) && !link.image_src && !String(link.link_group || '').toLowerCase().includes('social'));

    return ok(res, {
      footer: {
        id: footer.id,
        rootClasses: footer.root_classes || 'container-fluid bg-dark text-white-50 footer pt-5 mt-5 wow fadeIn',
        wowDelay: footer.wow_delay || '',
        innerContainerClasses: footer.inner_container_classes || 'container py-5',
        columns: {
          contact: {
            title: contact.title || 'Get In Touch',
            address: contact.address || '',
            phone: contact.phone || '',
            email: contact.email || '',
            social: social.map(link => ({ icon: link.icon || '', href: link.href || '' }))
          },
          quickLinks: { title: 'Quick Links', links: quick.map(link => ({ text: link.text, href: link.href || '' })) },
          gallery: { title: 'Photo Gallery', images: gallery.map(link => link.image_src).filter(Boolean) },
          newsletter: {
            title: footer.newsletter_title || '',
            text: footer.newsletter_text || '',
            placeholder: footer.newsletter_placeholder || '',
            buttonText: footer.newsletter_button_text || '',
            maxWidthStyle: footer.newsletter_max_width_style || ''
          }
        },
        copyright: {
          leftHtml: footer.copyright_left_html || '',
          rightMenu: rightMenu.map(link => ({ text: link.text, href: link.href || '' }))
        }
      }
    });
  } catch (error) { return fail(res, 500, 'Failed to load Amani footer', error.message); }
}

export async function createPropertyVisitRequest(req, res) {
  try {
    const payload = req.body || {};
    const unitId = String(payload.unit_id || '').trim();
    const phone = String(payload.phone || '').trim();
    if (!unitId) return fail(res, 400, 'A unit must be selected before booking a visit');
    if (!phone) return fail(res, 400, 'Phone / WhatsApp is required');

    const { data: unit, error: unitError } = await supabaseAdmin
      .from('property_units')
      .select('id,property_id,unit_code,unit_title,unit_name,status,available_for_public,is_listed,is_active')
      .eq('id', unitId)
      .maybeSingle();
    if (unitError) throw unitError;
    if (!unit) return fail(res, 404, 'Selected Amani unit was not found');
    if (!unit.available_for_public || !unit.is_listed || !unit.is_active) return fail(res, 409, 'Selected unit is not available for public booking');
    if (payload.property_id && String(payload.property_id) !== String(unit.property_id)) return fail(res, 400, 'Selected unit does not belong to the supplied property');

    const [{ data: property, error: propertyError }, { data: contact, error: contactError }] = await Promise.all([
      supabaseAdmin.from('properties').select('id,title,slug,status').eq('id', unit.property_id).maybeSingle(),
      supabaseAdmin.from('footer_contact_items').select('email').not('email', 'is', null).order('created_at', { ascending: true }).limit(1).maybeSingle()
    ]);
    if (propertyError) throw propertyError;
    if (contactError) throw contactError;
    if (!property) return fail(res, 404, 'Amani property for the selected unit was not found');
    if (!contact?.email) return fail(res, 503, 'No Amani booking recipient email is configured in footer_contact_items');

    const result = await sendPropertyVisitRequest({ to: contact.email, booking: payload, property, unit });
    return created(res, { submitted: true, delivery: result.provider, property_id: property.id, unit_id: unit.id });
  } catch (error) { return fail(res, 500, 'Failed to send Amani property visit request', error.message); }
}
