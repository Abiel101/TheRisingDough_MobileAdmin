with holiday_pack_prices(product_name, half_dozen_cents, dozen_cents) as (
  values
    ('Bagels (Sourdough)', 1100, 2200),
    ('Bagels (Everything Bagel)', 1400, 2700),
    ('Bagels (Jalapeño Cheddar)', 1400, 2700),
    ('Cinnamon Rolls', 2300, 4300),
    ('Pumpkin Cinnamon Rolls', 2600, 4900),
    ('Chocolate Chip Cookies', 1100, 2200),
    ('Brown Butter Pumpkin Cupcakes', 1100, 2200)
)
update public.admin_products as product
set pricing_options = jsonb_build_array(
  jsonb_build_object(
    'id', 'thanksgiving-half-dozen',
    'label', 'Half dozen',
    'packSize', 6,
    'priceCents', prices.half_dozen_cents
  ),
  jsonb_build_object(
    'id', 'thanksgiving-dozen',
    'label', 'Dozen',
    'packSize', 12,
    'priceCents', prices.dozen_cents
  )
)
from holiday_pack_prices as prices
where lower(product.name) = lower(prices.product_name)
  and product.pricing_options = '[]'::jsonb;
