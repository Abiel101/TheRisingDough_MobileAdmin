# The Rising Dough

Expo and React Native application for The Rising Dough. The project uses Expo Router and TypeScript.

## Start the app

```bash
npm install
npx expo start
```

Use the Expo Go app to preview supported features, or create a development build when the project adds native modules that Expo Go does not include.

## Supabase connection and sign-in

The app reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env.local`. It also accepts `EXPO_PUBLIC_SUPABASE_KEY` for the existing local key name. Restart Expo after changing environment values. These public client values are included in the app bundle; never put a service-role key, database password, or other privileged secret in this app. Data requests use the signed-in user's session and the existing row-level security policies. Sign in with an existing owner or staff email and password.

Order payment status uses the additive migration in `supabase/migrations/20261009000000_add_order_payment_status.sql`. The `supabase/migrations/20261015072438_add_cancelled_order_status.sql` migration adds the Cancelled status to the admin order constraint.

Native sessions are stored with Expo SecureStore. The app reads the existing `admin_customer_list`, `admin_products`, `admin_orders`, and `admin_order_items` tables. It can add, edit, and delete customers; add and remove catalog items; create, edit, cancel, and delete orders; and add catalog items to existing orders. Deleting a customer keeps existing orders and their customer-name snapshot. Orders appear in Active, Completed, or Cancelled views; paid and fulfilled orders appear in Completed and are marked with green dots on the calendar. The calendar can show a compact month or week view.

## Project foundation

- `src/theme/tokens.ts` contains the bakery color and spacing tokens. The Inter and Noto Serif font assets still need to be added before those families can be used.
- `src/domain/orders.ts` contains shared customer/order types, the order statuses, and the saved-price total calculation.
- `src/components/ui/native-text.tsx` and `native-button.tsx` wrap Expo UI's universal native text and button components. These use SwiftUI on Apple platforms and Jetpack Compose on Android; keep platform-specific imports in platform-specific files when a screen needs controls unique to one OS.
- `src/app/` contains Expo Router routes. The sign-in route protects four native tabs: Calendar, Orders, Catalog, and Customers. The tab bar uses the platform's native navigation components.
- `example/` is an archived starter and is excluded from the active TypeScript project.

## Checks

```bash
npx expo lint
npx tsc --noEmit
```
