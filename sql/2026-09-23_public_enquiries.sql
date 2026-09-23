-- Amani public enquiries: listing-owner leads + general contact messages.
-- Run once in Supabase SQL Editor.
-- Public browser clients receive NO direct table privileges. Submissions go through amani-backend.
-- The backend's server-side Supabase secret/service role bypasses RLS; never expose that key in the browser.

begin;

create table if not exists public.property_listing_enquiries (
  id text primary key default ('plen-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
  owner_name text not null,
  phone text not null,
  email text,
  property_category_id text references public.property_categories(id) on update cascade on delete set null,
  location_id text references public.locations(id) on update cascade on delete set null,
  stories integer,
  details text not null,
  status text not null default 'new'
    check (status in ('new','contacted','qualified','closed','spam')),
  source text not null default 'website_nav_cta'
    check (source in ('website_nav_cta','website','admin','other')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_listing_enquiries_owner_name_len check (char_length(btrim(owner_name)) between 2 and 120),
  constraint property_listing_enquiries_phone_len check (char_length(btrim(phone)) between 7 and 30),
  constraint property_listing_enquiries_email_len check (email is null or char_length(btrim(email)) between 5 and 254),
  constraint property_listing_enquiries_stories_range check (stories is null or stories between 1 and 200),
  constraint property_listing_enquiries_details_len check (char_length(btrim(details)) between 10 and 3000)
);

create table if not exists public.contact_messages (
  id text primary key default ('cmsg-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
  name text not null,
  email text,
  phone text,
  subject text,
  message text not null,
  status text not null default 'new'
    check (status in ('new','read','replied','closed','spam')),
  source text not null default 'contact_page'
    check (source in ('contact_page','website','admin','other')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_messages_name_len check (char_length(btrim(name)) between 2 and 120),
  constraint contact_messages_email_len check (email is null or char_length(btrim(email)) between 5 and 254),
  constraint contact_messages_phone_len check (phone is null or char_length(btrim(phone)) between 7 and 30),
  constraint contact_messages_subject_len check (subject is null or char_length(btrim(subject)) <= 180),
  constraint contact_messages_message_len check (char_length(btrim(message)) between 10 and 3000)
);

create index if not exists property_listing_enquiries_status_created_idx
  on public.property_listing_enquiries(status, created_at desc);
create index if not exists property_listing_enquiries_category_idx
  on public.property_listing_enquiries(property_category_id);
create index if not exists property_listing_enquiries_location_idx
  on public.property_listing_enquiries(location_id);
create index if not exists contact_messages_status_created_idx
  on public.contact_messages(status, created_at desc);

alter table public.property_listing_enquiries enable row level security;
alter table public.contact_messages enable row level security;
alter table public.property_listing_enquiries force row level security;
alter table public.contact_messages force row level security;

-- Explicitly remove direct browser/client access. Public writes are intentionally API-only.
revoke all on table public.property_listing_enquiries from public, anon, authenticated;
revoke all on table public.contact_messages from public, anon, authenticated;

-- Explicit backend role permissions. Supabase secret/service-role credentials stay server-side.
grant select, insert, update, delete on table public.property_listing_enquiries to service_role;
grant select, insert, update, delete on table public.contact_messages to service_role;

-- No anon/authenticated RLS policies are created on purpose:
-- RLS default-deny + revoked grants prevents reading, inserting, updating or deleting these PII-bearing tables.
-- Server/admin access uses the backend-only Supabase secret/service-role key.

-- Keep updated_at trustworthy even when an admin edits status/notes.
create or replace function public.amani_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_property_listing_enquiries_updated_at on public.property_listing_enquiries;
create trigger trg_property_listing_enquiries_updated_at
before update on public.property_listing_enquiries
for each row execute function public.amani_touch_updated_at();

drop trigger if exists trg_contact_messages_updated_at on public.contact_messages;
create trigger trg_contact_messages_updated_at
before update on public.contact_messages
for each row execute function public.amani_touch_updated_at();

-- Database-driven navbar wording/link.
update public.site_navbars
set cta_text = 'Need to List a Property?',
    cta_href = '#list-property',
    updated_at = now();

commit;
