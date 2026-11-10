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

Catalog item options (for example Sourdough → Veggie, Bagels → Plain / Everything) use `supabase/migrations/20261107000000_catalog_item_options.sql`. It adds `admin_product_options`, stores each order line's `option_name` (existing lines become `Default`), and carries options through website requests and customer approval links. Items without options behave as before.

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

## Discounts, invoices and customer approval

1. Apply the pending Supabase migrations in order, including `supabase/migrations/20261104062435_add_discount_and_approval.sql` and `supabase/migrations/20261104065559_approval_decline.sql`. Check the database's applied migration history first; do not blindly rerun historical migrations.
2. Host the web build (`npx expo export -p web`, e.g. with EAS Hosting) and set `EXPO_PUBLIC_APPROVAL_BASE_URL` to its URL. Approval links look like `<base>/approve/<token>` and work without signing in.
3. Push notifications need a development/production build on a physical device (not Expo Go); Android also needs FCM credentials configured in EAS.

### Android push setup and testing

The in-app notification inbox and native push notifications are separate. Native pushes require a working Firebase and Expo configuration, notification permission on the phone, a registered device token, and the relevant Supabase migrations.

1. In Firebase, create or select a project and register an Android app with package name `com.forgepointlab.therisingdoughadminmobile`. Download its `google-services.json` and place it in the project root.
2. Add `"googleServicesFile": "./google-services.json"` under `expo.android` in `app.json`, then create and install a new Android development, preview, or production build. An existing installed build cannot acquire this native configuration through an over-the-air update.
3. Configure an FCM V1 service-account key in the Expo project's Android credentials. Follow [Expo's FCM setup guide](https://docs.expo.dev/push-notifications/fcm-credentials/). Keep the service-account private key out of the repository and never put it in the app or chat.
4. Open the installed app on the phone, sign in as the owner, and allow notifications. Check Android's app notification settings and the Order updates channel if permission was denied.
5. Use the [Expo push notifications tool](https://expo.dev/notifications) with the device's Expo push token to test delivery independently of Supabase. Retrieve the token for the signed-in owner from `admin_push_tokens` in Supabase; treat it as private. Then test a real approval or website request. An in-app inbox entry alone does not confirm push delivery.

Expo accepting a push request does not guarantee delivery: inspect Expo push receipts and FCM credentials if the test fails. The database triggers send pushes through `pg_net`, so an Expo test that works but a real event that does not also requires checking the applied trigger migrations, database logs, and the owner's stored tokens.
