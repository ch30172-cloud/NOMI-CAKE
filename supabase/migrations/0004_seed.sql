-- =====================================================================
-- 0004: initial data. Only configuration and the agreed category list.
-- No products, prices, phone numbers or photos are invented here:
-- the owner adds the real products from the admin panel.
-- =====================================================================

insert into public.categories (slug, name_he, name_en, sort_order) values
  ('designed-cakes',    'עוגות מעוצבות',  'Designed Cakes',      1),
  ('individual-desserts','קינוחים אישיים', 'Individual Desserts', 2),
  ('dessert-boxes',     'מארזי קינוחים',  'Dessert Boxes',       3),
  ('cheesecakes',       'עוגות גבינה',    'Cheesecakes',         4),
  ('desserts-in-cups',  'קינוחים בכוסות', 'Desserts in Cups',    5),
  ('layer-cakes',       'עוגות שכבות',    'Layer Cakes',         6)
on conflict (slug) do nothing;

-- Default working hours (Sun-Thu 10:00-18:00, Fri 09:00-12:00). These are placeholders
-- for configuration only; the owner edits them in Admin > Availability.
insert into public.business_hours (day_of_week, kind, open_time, close_time)
select d, k, case when d = 5 then time '09:00' else time '10:00' end, case when d = 5 then time '12:00' else time '18:00' end
from generate_series(0, 5) as d, unnest(array['pickup', 'delivery']::public.fulfillment_type[]) as k
on conflict (day_of_week, kind) do nothing;

update public.homepage_content set
  hero_title_he = 'Nomi Nebentzhal',
  hero_title_en = 'Nomi Nebentzhal',
  hero_subtitle_he = 'עוגות וקינוחי בוטיק בעבודת יד',
  hero_subtitle_en = 'Handmade boutique cakes and desserts',
  about_title_he = 'קצת על העסק',
  about_title_en = 'About'
where id = 1;
