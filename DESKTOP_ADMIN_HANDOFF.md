# The Rising Dough — Admin App: Handoff for a Desktop Version

This document describes how the existing **mobile admin app** works so another AI/developer can build a
**desktop-optimised, more feature-rich admin** that keeps using the **same Supabase backend and the same business
rules**. Nothing in the backend needs to change for parity; the desktop app is a new client of the same database.

> **Golden rule:** reuse the existing tables, RPCs, storage bucket, and domain logic exactly as described below.
> Do not invent a new schema. Any enhancement must stay compatible with the mobile app, which will keep running
> against the same data.

Reference implementation (read these files first):
- `src/lib/workspace.ts` — **every** database call (≈1250 lines). Port this file as the data layer.
- `src/domain/*.ts` — pure business logic (totals, discounts, status, option parsing, pack/piece maths). Framework-free; copy as-is.
- `src/lib/invoice.ts`, `src/lib/production-export.ts`, `src/lib/approval-inbox.ts`, `src/lib/customer-links.ts`
- `supabase/migrations/*.sql` — the schema, RLS, RPCs, triggers, storage policy.
- `src/app/order/[id].tsx`, `src/app/order/new.tsx`, `src/app/(tabs)/*` — UI behaviour to reproduce.

---

## 1. Tech stack (current)

- Expo SDK 58 / React Native 0.88 / React 19, **Expo Router** (file routes under `src/app/`), TypeScript, React Compiler on.
- Runs on iOS, Android, **and web** (`react-native-web`, `web.output = "single"`). Platform splits use `.ios.tsx`, `.android.tsx`, `.web.tsx`.
- Backend: **Supabase** (Postgres + Auth + Storage + RPC) via `@supabase/supabase-js`. No custom server.
- Packages of note: `expo-notifications` (push), `expo-print`/`expo-sharing` (invoice PDF), `expo-image-picker` (delivery photo), `expo-secure-store` (auth storage; `localStorage` on web), `expo-clipboard`.
- Env vars (`.env.local`, never commit values):
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (fallback `EXPO_PUBLIC_SUPABASE_KEY`)
  - `EXPO_PUBLIC_APPROVAL_BASE_URL` — public origin of the **hosted web build**; used to build customer links
    (`<base>/approve/<token>`, `<base>/delivered/<token>`). Falls back to `window.location.origin` on web.
- Design tokens (`src/theme/tokens.ts`): teal `#174A46`, deepTeal `#0F332F`, espresso `#302017`, background `#F7F5F0`, cream `#F2E4C9`,
  mustard `#D6A21E`, sage `#687A55`, orange `#C65A27`, brick `#A83F2D`, card `#FFFEFA`, border `#E9E4DA`. Serif display font.
  Keep branding consistent.

A desktop version can be (a) a responsive layout of this same Expo web build, or (b) a separate web app (e.g. Next/Vite + React)
that ports `workspace.ts` + `domain/`. Either way it must talk to the same Supabase project.

---

## 2. Authentication & access model

- Supabase email/password: `supabase.auth.signInWithPassword`. Session persisted + auto-refreshed (`AuthProvider`, `useAuth()` → `session`, `signIn`, `signOut`).
- Router guards: signed-out users see only `/` (sign-in). Signed-in users get tabs + detail screens. **Two public routes are always reachable without login**: `/approve/[token]` and `/delivered/[token]` (customer pages).
- **Every admin table has `owner_id uuid → auth.users(id)` and RLS `owner_id = auth.uid()`.** All inserts must pass `owner_id: session.user.id`.
  Reads/updates are scoped by RLS automatically (code still checks "not found for this account" when an update returns no row).
- Customers never authenticate. They use unguessable **per-order UUID tokens** and **SECURITY DEFINER RPCs** (section 6).
- "Manager password": `src/lib/manager.ts` exports a hard-coded client-side string used to confirm **deleting an order**. It is *not* real security.
  For desktop, keep the confirm-before-delete behaviour but prefer moving this to a proper server-side/role check or env config.

---

## 3. Database (Supabase) — tables the admin uses

> Base tables `admin_products`, `admin_orders`, `admin_order_items`, `admin_customer_list` pre-date the migrations folder
> (not created there); the migrations only add columns/constraints/RLS. Inspect the live project (`supabase/.temp` is linked) before relying on exact base DDL.

### `admin_customer_list` (customers)
`id, owner_id, name (nullable), phone (required), email, address, created_at`. Listed ordered by `name`, limit 500.

### `admin_products` (catalog items)
`id, owner_id, name, unit_price, discount_type ('percent'|'amount'|null), discount_value, discount_ends_on (date|null), pricing_options (jsonb)`
- `pricing_options`: array of `{id, label, packSize(int≥1), priceCents(int≥0)}` (e.g. Half dozen / Dozen). Parsed by `parsePriceOptions`.
- A product discount is **temporary**: when `discount_ends_on < today (local)`, it is treated as no discount and `clearExpiredProductDiscounts` writes
  `discount_type=null, discount_value=0, discount_ends_on=null` back (guarded by `.eq` on the old values to avoid races).
- `listProducts` falls back to a column list without `discount_ends_on` if the column is missing (error `42703`/`PGRST204`).

### `admin_product_options` (flavours/variants, e.g. Sourdough → Veggie)
`id, owner_id, product_id → admin_products (cascade), name, unit_price (null = use product price), sort_order, created_at`.
Unique per product on `lower(btrim(name))` (duplicate → code `23505`). Option name `"Default"` is **reserved**.
A catalog item **must have ≥1 priced option** when created (`addProduct` validates; inserts product then options, deleting the product if options fail).

### `admin_catalog_promotions`
One row per owner (`upsert` on `owner_id`): `name, is_active, discount_percent, stack_on_product_discount, updated_at`. Default: off, 0%, name "Holiday promotion".

### `admin_product_recipes`
`id, owner_id, product_id, ingredient, quantity (>0), unit, sort_order`. "Save recipe" = delete all rows for the product then insert the new list.
Quantities are **per single piece**.

### `admin_orders`
Core: `id, owner_id, order_number ('RD-0001' style), customer_id (nullable), customer_name (snapshot), due_date (date), fulfilled_date, status, notes, created_at`.
Payment: `paid (bool), payment_method ('cash'|'zelle'|'other'|null), payment_method_other` (CHECK: `other` ⇒ text required; otherwise text must be null).
Discount: `discount_type ('percent'|'amount'|null), discount_value` (CHECK: percent 0<v≤100, amount v>0, or both null/0).
Approval: `approval_token (uuid, unique, auto), approval_status ('draft'|'pending'|'approved'|'declined'), approved_at, approved_by_name, approved_total, declined_at`.
Delivery: `delivery_time (free text e.g. "2:30 PM"), customer_notified_at, delivered_at, delivery_method ('delivery'|'pickup'), delivery_photo_path`.
`status` CHECK: `'Pending' | 'In progress' | 'Ready' | 'Fulfilled' | 'Cancelled'` (UI label for `Fulfilled` is **"Completed"**).

### `admin_order_items`
`id, owner_id, order_id, catalog_product_id (nullable), catalog_option_id (nullable), item_name, option_name (default 'Default'), unit_price, quantity`.
**Lines are price snapshots** — name, option name and unit price are copied at order time so later catalog edits never change old orders.

### `admin_order_requests` (website requests inbox)
`id, owner_id, source_order_id (unique), source_order_number, customer_name/phone/email, due_date, request_notes, requested_items (jsonb), created_at, status ('pending'|'converted'), converted_order_id`.
Populated by a DB trigger from the public website's `orders`/`order_items` (see section 7). Owners may select/update/delete.

### `admin_push_tokens`
`(owner_id, token)` PK — Expo push tokens, upserted on login by the mobile app.

### Storage
Bucket **`delivery-photos`** (public read). Upload path **must** be `<auth.uid()>/<orderId>-<timestamp>.<ext>`; RLS only allows writing in the folder named after the user id.
Public URL via `supabase.storage.from('delivery-photos').getPublicUrl(path)`.

### Schema-version tolerance
The data layer is written to survive un-migrated databases: `selectOrderRows` tries the richest column set first and falls back
(`delivered → notified → full → payment → base`), setting `paymentTrackingAvailable` / `approvalAvailable` flags on each `OrderRecord`.
Options tables missing (`42P01`/`PGRST205`) ⇒ behave as "no options". Keep this behaviour (or drop it deliberately once all migrations are applied).

---

## 4. Order lifecycle & business rules (must be preserved)

### Status flow
`Pending → In progress → Ready → Fulfilled (Completed)`, plus `Cancelled`.
- `resolveStatus(status, paid)`: **if status would be `Ready` and the order is paid, it becomes `Fulfilled` automatically.**
- "Advance" button moves one step. From `Ready` there is **no** manual advance — it completes by being paid (marking paid while Ready ⇒ Fulfilled).
  If payment tracking is unavailable the order is treated as paid for this rule.
- Setting `status = Fulfilled` writes `fulfilled_date = today`; any other status writes `fulfilled_date = null`.
- **Mark paid**: requires a method (`cash`/`zelle`/`other`); `other` requires custom text. Sets `paid=true`, method, and `status=resolveStatus(current,true)`.
- **Undo payment**: `paid=false`, method/other = null, and if status was `Fulfilled` it reverts to `Ready`.
- **Cancel**: requires a reason; appended to notes as `Cancelled: <reason>` (newline-joined with existing notes) and status → `Cancelled`.
  Cancelled orders are excluded from calendar, due-soon, approval activity.
- **Delete order**: hard delete (`admin_orders` row; items cascade/are removed). Requires manager-password confirmation.

### Editing rules
- `ADD_ITEMS_CUTOFF_DAYS = 3`: items can be added and due date changed only if the order is not cancelled/completed **and** due date is ≥ 3 days away.
- Items can be removed only if the same condition holds **and** status is `Pending` **and** more than one line remains.
- New due date must be today or later.
- **Any change to items on an `approved` order resets `approval_status` to `pending`** (customer must re-approve; `resetApproval`).
- `updateOrder` clearing approval: if `approvalStatus !== 'approved'` it nulls `approved_at/by_name/total`; if `!== 'declined'` it nulls `declined_at`.

### Creating an order (`createOrder`)
1. Validate ≥1 item, each with a product id and integer quantity ≥ 1.
2. **Order number**: read newest order by `created_at`, parse `RD-(\d+)`, increment, pad to 4 digits (`RD-0001`). *(Not atomic — two simultaneous creators could collide; a desktop client with multiple users should move this to a DB sequence/RPC.)*
3. Insert `admin_orders` with `status 'Pending'`, `paid false`, optional discount.
4. Insert `admin_order_items` (snapshotting `item_name`, `unit_price`, `option_name`, `catalog_option_id`).
5. If item insert fails, **delete the order** (manual rollback) and rethrow.
6. If created from a website request, call `markHolidayRequestConverted(requestId, orderId)`.

### Adding items (`addItemsToOrder`)
Lines are merged by key `[productId, itemName, optionName||'Default', unitPrice]`: if a matching line exists its quantity is incremented; otherwise a new row is inserted.

### Pricing & totals (`src/domain/orders.ts`, `catalog-pricing.ts`)
- Line total = `unitPrice × quantity` (snapshot). Subtotal = sum of lines.
- **Order-level discount** `{type:'percent'|'amount', value}`: percent capped at 100; fixed amount capped at subtotal; rounded to cents. `total = subtotal − discountAmount`.
- `allocateLineTotals` spreads the order discount proportionally across lines; the last non-zero line absorbs rounding (used by invoice/customer page).
- **Catalog unit price at selection time** (`getCatalogUnitPriceCents`): start from the option/pack price → apply the product discount (if not expired) → apply the global promotion % **only if** there is no product discount **or** `stack_on_product_discount` is true. Result is saved as the line's `unit_price`.
- Option price: `option.price ?? product.price`. `productPriceRange` = min/max across options.
- Pack/piece maths (`pack-quantities.ts`): names like `Cinnamon Rolls · Dozen (12 pieces)`, "half dozen", "dozen" are parsed into pack label + pieces per pack; a dozen = 12 pieces, half dozen = 6, otherwise 1 ("Single").
- Line display grouping (`groupLinesByItem`, `summarizeLineGroup`): lines group by item with options listed beneath, e.g. `5 × Bagels (3 Plain, 2 Everything)`. `"Default"` option is hidden (`hasOptionLabel`).

---

## 5. Screens / features to reproduce (and enhance for desktop)

Mobile uses 5 bottom tabs + pushed detail screens. On desktop these map naturally to a sidebar + master/detail panes.

| Mobile route | Purpose | Data calls |
|---|---|---|
| `(tabs)/calendar` | Week/Month view of orders by `due_date`; tap a day to list that day's orders; "today" shortcut. Excludes Cancelled. | `listOrders({startDate, endDateExclusive})` |
| `(tabs)/orders` | Order list + **Export not-started orders** (production CSV). | `listOrders`, `exportNotStartedOrders` |
| `(tabs)/requests` | Website requests inbox (pending/converted). | `listHolidayRequestActivity` |
| `(tabs)/catalog` | Items list; entry to add item and to catalog settings (discounts/promotion). | `listProducts` |
| `(tabs)/customers` | Customer list (search), add. | `listCustomers` |
| `order/[id]` | Full order management (below). | `getOrder`, `updateOrder`, … |
| `order/new` | Build an order: pick/create customer, due date, notes, items (with options), optional discount; can be pre-filled from a request. | `createOrder`, `addCustomer`, … |
| `request/[id]` | Read a website request; "Start new order" prefilled (customer, due date, notes, matched items). | `listHolidayRequestActivity` |
| `catalog/new`, `catalog/[id]` | Create/edit item: name, base price, options (add/edit/remove), pack price options, per-item discount (+ end date), **recipe editor**, delete. | `addProduct`, `updateProductName`, `updateProductPricing`, option + recipe fns |
| `catalog/discounts` | Bulk temporary discount over many items + global promotion toggle/percent/stack. | `updateProductsDiscount`, `getCatalogPromotion`, `saveCatalogPromotion` |
| `customer/[id]`, `customer/new` | View/edit/delete customer + their order history. | `getCustomer`, `updateCustomer`, `deleteCustomer`, `listOrders({customerId})` |
| `notifications` | In-app inbox: pending website requests, approval results, due-soon orders. | `loadInbox` |
| `settings` | Account + sign out. | — |
| `approve/[token]` (**public**) | Customer reviews order, approves (types name) or declines. | RPCs |
| `delivered/[token]` (**public**) | Customer sees delivery/pick-up confirmation, photo, printable invoice. | RPC |

### Order detail (`order/[id]`) — everything it does
- Header/progress through statuses, status colour, customer card (tap-to-call `tel:`), items grouped with options, subtotal/discount/total.
- Advance status, mark paid (method chooser) / undo payment, edit due date, edit notes, add items (item picker, honours promotion), remove lines.
- **Approval**: "Send approval link" sets `approval_status='pending'` and reveals `…/approve/<token>`; copy link, or share message
  `Hi <firstName>, please review and approve your order <RD-####> ($total): <link>`. Shows pending/approved (name, time, amount)/declined state. Declined ⇒ "Send new approval link".
- **Invoice**: build HTML (`buildInvoiceHtml`) → PDF (`expo-print`) and share; on web it opens print/save dialog (`printOrSaveInvoice`). Shows paid status/method, discount allocation, per-line totals.
- **Due-soon notify** (`due-notify-modal`): choose a delivery time → `setOrderDeliveryTime` (saved so the customer link shows it immediately) → share text message → `markOrderNotified` records `customer_notified_at`.
- **Delivery confirmation** (`delivery-confirm-card`): choose Delivered/Picked up, optional photo (camera/library) → `uploadDeliveryPhoto` → `confirmOrderDelivered(id, method, photoPath)`; can share the `/delivered/<token>` link; `clearOrderDelivered` undoes it.
- Cancel (reason) and delete (manager password) via a menu.
- Every mutation goes through a `run(action)` wrapper: set saving, clear error, run, **re-fetch the order** (`getOrder`), show error message on failure.

### Notifications / inbox (`src/lib/approval-inbox.ts`)
- `loadInbox()` gathers approvals (`listApprovalActivity`: orders with approval_status pending/approved/declined, not cancelled, newest first, limit 100),
  website requests (`listHolidayRequestActivity`, limit 100), and **due-soon orders** (`listDueSoonOrders`: due today..+2 days, not Cancelled/Fulfilled, and `customer_notified_at` empty).
- Unread tracking is **local to the device** (SecureStore/localStorage): first-run baselines (`approvalsSeenAt`, `holidayRequestsSeenAt`) + a capped (40) list of read keys (`request:<id>`, `approval:<id>`). Badge count = unread requests + unread approval results + due-soon.
  A desktop client should reimplement this storage (localStorage is fine) or, better, persist read state server-side.
- Push: mobile registers an Expo push token (`savePushToken`) and taps open the order/request (`data.orderId` / `data.requestId`).
  Desktop has no Expo push; use Supabase Realtime subscriptions on `admin_orders` / `admin_order_requests`, or web push/browser notifications.

### Production export (`src/lib/production-export.ts`)
Takes all `Pending` ("not started") orders (limit 500) and produces a CSV with sections:
1. **TOTAL TO MAKE** — item/option/total pieces aggregated.
2. **INGREDIENTS NEEDED** — recipe quantities × pieces, summed by ingredient+unit (items lacking recipes listed under "No recipe yet for").
3. **ORDERS** — one row per line: order, customer, due, item, option, pack label, packs, pieces/pack, total pieces, price per pack, line total, notes (first line only).
File name `production-list-YYYY-MM-DD.csv`. Great candidate for a richer desktop report (print view, date range, filters).

---

## 6. Customer-facing public flow (RPCs — keep unchanged)

Called with the anon key, no login:
- `rpc('get_order_for_approval', { p_token })` → JSON payload: order number, customer name, due date, delivery time, status, approval status/timestamps, approved total, discount, **server-computed** `subtotal/discount_amount/total`, paid/payment method, fulfilled date, delivery confirmation fields, and `items[{name, option_name, unit_price, quantity}]`.
- `rpc('approve_order', { p_token, p_name })` — only works when `approval_status='pending'` and order not cancelled; locks the row, sets `approved`, `approved_at=now()`, `approved_by_name`, and `approved_total` from the **server-side** `admin_order_totals()` (client can never supply the amount).
- `rpc('decline_order', { p_token })` — only when `pending`; sets `declined`, `declined_at`, clears approval fields.
- All three return the refreshed payload (or the current one if the action was not allowed).
- **Triggers** `notify_order_approved` / `notify_order_declined` fire Expo push notifications (via `pg_net`) to every token in `admin_push_tokens` for that owner. Those only affect mobile; a desktop app should *subscribe to changes* instead.
- Customer links are built by `approvalLinkFor(token)` / `deliveredLinkFor(token)` (`src/lib/customer-links.ts`) from `EXPO_PUBLIC_APPROVAL_BASE_URL`. These pages must stay hosted at those URLs.

## 7. Website request pipeline

The public website writes to its own `orders` + `order_items`. An `AFTER INSERT` trigger (`mirror_website_order_item_to_admin`) on `order_items` runs for rows whose
`product_name = 'THANKSGIVING ORDER REQUEST'` and inserts a row into `admin_order_requests` (owner = most recent push-token owner, else latest admin order owner),
then pushes "New Thanksgiving request". Requests stay **separate from orders** until an admin converts them.

Converting a request: `request/[id]` → "Start new order" navigates to `order/new` with params (`requestId, customerName, customerPhone, customerEmail, dueDate, requestNotes, requestItems` JSON).
Requested items are matched to the catalog by `matchRequestedItem` (`src/domain/orders.ts`): handles names like `"Sourdough - Veggie"`, `"Bagels (Plain)"`, `"Veggie Sourdough"`, reads option from many raw field names (`extractOptionName`), tolerant of case/whitespace.
Unmatched items are left for the admin to add manually. After `createOrder`, the request is marked `converted` with `converted_order_id`. Requests can be deleted (`deleteHolidayRequest`).
Request item JSON shape: `{productName, optionName, sourceName, quantity, unitPrice}`.

## 8. Customers

- `addCustomer` (phone required; empty name/email/address stored as `null`), `updateCustomer` (phone required), `deleteCustomer`.
- **Deleting a customer preserves order history**: first sets `customer_id = null` and `customer_name = name || phone` on all that customer's orders, then deletes the customer.
- Orders display `customer?.name || order.customer_name || customer?.phone || "Customer"`; contact details are joined from `admin_customer_list` at read time.

## 9. Data-access patterns worth copying

- Single data module; every function throws `Error(message)` on Supabase error (`throwIfError`); UI shows `error.message`.
- Update functions use `.update(...).eq('id', id).select('id').maybeSingle()` and throw "…not found for this account" if no row returned (RLS-hidden or missing).
- `listOrders({startDate, endDateExclusive, customerId, limit=200})` sorted by `due_date` asc; items and customers are fetched in **two batched follow-up queries** (`in('order_id', ids)` limit 2000, `in('id', customerIds)`) and joined client-side by `mapOrderRows`.
- Large list limits: customers 500, products 500, options 2000, order items 2000, recipes 2000, requests/approvals 100. A desktop app with larger data should add pagination/search server-side.
- Dates: `due_date` is a plain `YYYY-MM-DD` (local date, no timezone); helper `localDateKey()` computes "today" in local time. Parse with `T12:00:00` to avoid DST/UTC shifts.
- Money: stored as numerics in dollars; catalog pack prices in **cents** (`priceCents`).
- Realtime is **not** used today; the app refetches on screen focus (`useFocusEffect`) and after each mutation.

## 10. Suggested desktop enhancements (keep behaviour above intact)

These are ideas, not requirements — all can be built on the existing schema:
- Sidebar navigation + split panes (orders list | order detail), keyboard shortcuts, multi-select & bulk status changes.
- Larger calendar (month grid with order cards, drag-to-reschedule honouring the 3-day rule and `due_date >= today`), day/week agenda printing.
- Orders table: sortable/filterable columns (status, paid, approval, due range, customer), server-side search and pagination, saved filters.
- Production planning: date-range production sheets, ingredient totals/print view, CSV/XLSX export (same algorithm as section 5).
- Reporting: revenue (paid vs unpaid), by item/option, by customer, discounts given, approval conversion.
- Catalog/recipe management with inline table editing and bulk discount tools (`updateProductsDiscount`).
- Realtime updates via Supabase Realtime on `admin_orders`, `admin_order_requests` to replace push notifications.
- Move order-number generation to a DB sequence/RPC and replace the hard-coded manager password with a proper role check.
- Roles/staff accounts (sign-in copy already mentions "owner or staff") — note current RLS is strictly per `owner_id`, so shared staff access would need a policy change.

## 11. Checklist for parity

- [ ] Same Supabase project, same env vars; sign-in with email/password; protected routes; public `/approve/[token]` and `/delivered/[token]` pages still work.
- [ ] Port `src/domain/*` unchanged and `src/lib/workspace.ts` as the data layer (add `owner_id` on inserts).
- [ ] Status flow incl. auto-complete when Ready + paid; paid/method rules; cancel-with-reason; delete-with-confirm.
- [ ] Order create (RD-#### numbering, rollback on failure), add/remove items, 3-day edit cutoff, re-approval on item change.
- [ ] Discounts: order-level, product-level (with expiry auto-clear), global promotion (+ stacking flag); price snapshots on lines.
- [ ] Approval link flow (pending → approved/declined) via RPCs; due-soon notify + delivery time; delivery confirmation with photo upload to `delivery-photos/<uid>/…`.
- [ ] Website requests inbox → convert to order → mark converted; delete request.
- [ ] Customers CRUD with history-preserving delete; catalog CRUD with options, pack prices, recipes.
- [ ] Invoice (print/PDF) and production CSV export.
- [ ] Notifications/inbox equivalent (realtime or polling) with unread tracking.
