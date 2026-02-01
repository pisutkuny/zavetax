-- Run this in Supabase SQL Editor to upgrade your table

alter table transactions 
add column if not exists tax_type text check (tax_type in ('vat_inc', 'vat_exc', 'no_vat')) default 'no_vat',
add column if not exists tax_invoice boolean default false,
add column if not exists wht_rate integer default 0;
