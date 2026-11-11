create extension if not exists pgcrypto;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,full_name text,role text not null default 'customer' check(role in('customer','admin')),created_at timestamptz not null default now());
create table if not exists public.products(id uuid primary key default gen_random_uuid(),name text not null,slug text not null unique,category text not null,description text not null default '',price_kes integer not null check(price_kes>=0),size text not null default '',accent text not null default '#B8803F',active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.orders(id uuid primary key default gen_random_uuid(),order_number bigint generated always as identity unique,customer_id uuid references auth.users(id) on delete set null,customer_name text not null,phone text not null,email text,delivery_town text not null,delivery_address text not null default '',subtotal_kes integer not null check(subtotal_kes>=0),delivery_fee_kes integer not null default 0 check(delivery_fee_kes>=0),total_kes integer not null check(total_kes>=0),currency text not null default 'KES',status text not null default 'pending_payment' check(status in('pending_payment','paid','processing','shipped','delivered','cancelled','refunded')),payment_status text not null default 'pending' check(payment_status in('pending','initiated','paid','failed','cancelled','refunded')),payment_method text not null default 'mpesa',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,product_id uuid references public.products(id) on delete set null,product_name text not null,variant_name text not null default '',unit_price_kes integer not null,quantity integer not null check(quantity between 1 and 20),line_total_kes integer not null);
create table if not exists public.payments(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,merchant_request_id text unique,checkout_request_id text unique,mpesa_receipt_number text unique,phone text not null,amount_kes integer not null,status text not null default 'initiated' check(status in('initiated','paid','failed','cancelled')),result_code text,result_description text,raw_callback jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists payments_order_idx on public.payments(order_id);
insert into public.products(id,name,slug,category,description,price_kes,size,accent) values
('11111111-1111-4111-8111-111111111111','Skin Tint Foundation','skin-tint-foundation','Face','Light-to-medium coverage designed to look like skin.',1900,'30 ml','#B8803F'),
('22222222-2222-4222-8222-222222222222','Velvet Matte Lipstick','velvet-matte-lipstick','Lips','Rich colour with a soft, comfortable matte finish.',950,'3.5 g','#A3485A'),
('33333333-3333-4333-8333-333333333333','Cream Blush','cream-blush','Cheeks','A blendable cream blush for a natural flush.',1100,'6 g','#E99A84'),
('44444444-4444-4444-8444-444444444444','Kohl Eye Pencil','kohl-eye-pencil','Eyes','A soft-glide eye pencil with rich colour.',600,'1.2 g','#3A2A3F'),
('55555555-5555-4555-8555-555555555555','Everyday Eyeshadow Palette','everyday-eyeshadow-palette','Eyes','Four wearable warm shades.',2400,'4 shades','#A8743A'),
('66666666-6666-4666-8666-666666666666','Vitamin C Glow Serum','vitamin-c-glow-serum','Skincare','A daily serum formulated to brighten dull-looking skin.',2200,'30 ml','#B5651D'),
('77777777-7777-4777-8777-777777777777','Gentle Foaming Cleanser','gentle-foaming-cleanser','Skincare','A gentle daily cleanser.',1200,'150 ml','#7A6AA8'),
('88888888-8888-4888-8888-888888888888','Daily Moisturiser SPF 30','daily-moisturiser-spf-30','Skincare','Lightweight daily hydration with SPF 30.',1800,'50 ml','#5C8A8A'),
('99999999-9999-4999-8999-999999999999','Shea Body Butter','shea-body-butter','Body','A rich body butter for lasting moisture.',1400,'250 ml','#9A6B7C'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Argan Hair Oil','argan-hair-oil','Hair','A lightweight hair oil for smoothness and shine.',1500,'100 ml','#B88A2E'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','The Maison Glow Set','the-maison-glow-set','Sets','A three-step glow routine.',4800,'3 products','#4A1F4F')
on conflict(id) do update set name=excluded.name,price_kes=excluded.price_kes,active=true;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
create or replace function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict do nothing; return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.new_profile();
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
create policy "profile self read" on public.profiles for select using(id=auth.uid() or public.is_admin());
create policy "admin profile manage" on public.profiles for all using(public.is_admin()) with check(public.is_admin());
create policy "public active products" on public.products for select using(active=true or public.is_admin());
create policy "admin product manage" on public.products for all using(public.is_admin()) with check(public.is_admin());
create policy "customer own orders" on public.orders for select using(customer_id=auth.uid() or public.is_admin());
create policy "admin order manage" on public.orders for all using(public.is_admin()) with check(public.is_admin());
create policy "customer own items" on public.order_items for select using(exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or public.is_admin())));
create policy "admin items manage" on public.order_items for all using(public.is_admin()) with check(public.is_admin());
create policy "customer own payments" on public.payments for select using(exists(select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or public.is_admin())));
create policy "admin payments manage" on public.payments for all using(public.is_admin()) with check(public.is_admin());
-- Server routes use the service role. Never expose SUPABASE_SERVICE_ROLE_KEY in browser code.
