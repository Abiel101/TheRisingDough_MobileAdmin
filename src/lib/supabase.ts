import "react-native-url-polyfill/auto";

import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ||
  "";

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

const authStorage =
  Platform.OS === "web"
    ? globalThis.localStorage
    : {
        getItem: SecureStore.getItemAsync,
        removeItem: SecureStore.deleteItemAsync,
        setItem: SecureStore.setItemAsync,
      };

export const supabase = createClient(
  supabaseUrl || "https://missing-project.supabase.co",
  supabaseKey || "missing-publishable-key",
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
