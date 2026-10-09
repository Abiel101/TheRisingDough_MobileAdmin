import "react-native-url-polyfill/auto";

import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ||
  "";

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

function secureStoreKey(key: string, suffix: string) {
  const safeKey = key.replace(/[^A-Za-z0-9._-]/g, "_") || "supabase-auth";
  return `${safeKey}.${suffix}`;
}

const secureSessionStorage = {
  async getItem(key: string) {
    const manifestKey = secureStoreKey(key, "manifest");
    const manifest = await SecureStore.getItemAsync(manifestKey);
    if (!manifest) return null;

    const [version, countText] = manifest.split(":");
    const count = Number(countText);
    if (!version || !Number.isInteger(count) || count < 1) return null;

    const parts = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(secureStoreKey(key, `${version}.${index}`)),
      ),
    );
    if (parts.some((part) => part === null)) return null;
    return parts.join("");
  },

  async setItem(key: string, value: string) {
    // Keep each SecureStore value small; some iOS versions reject large values.
    const chunkLength = 400;
    const characters = Array.from(value);
    const chunks = Array.from(
      { length: Math.ceil(characters.length / chunkLength) || 1 },
      (_, index) => characters.slice(index * chunkLength, (index + 1) * chunkLength).join(""),
    );
    const version = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const manifestKey = secureStoreKey(key, "manifest");
    const oldManifest = await SecureStore.getItemAsync(manifestKey);

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(secureStoreKey(key, `${version}.${index}`), chunk),
      ),
    );
    await SecureStore.setItemAsync(manifestKey, `${version}:${chunks.length}`);

    if (oldManifest) {
      const [oldVersion, oldCountText] = oldManifest.split(":");
      const oldCount = Number(oldCountText);
      if (oldVersion && Number.isInteger(oldCount) && oldCount > 0) {
        await Promise.all(
          Array.from({ length: oldCount }, (_, index) =>
            SecureStore.deleteItemAsync(secureStoreKey(key, `${oldVersion}.${index}`)),
          ),
        );
      }
    }
  },

  async removeItem(key: string) {
    const manifestKey = secureStoreKey(key, "manifest");
    const manifest = await SecureStore.getItemAsync(manifestKey);
    await SecureStore.deleteItemAsync(manifestKey);
    if (!manifest) return;

    const [version, countText] = manifest.split(":");
    const count = Number(countText);
    if (!version || !Number.isInteger(count) || count < 1) return;
    await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.deleteItemAsync(secureStoreKey(key, `${version}.${index}`)),
      ),
    );
  },
};

const webSessionStorage = {
  getItem: async (key: string) =>
    typeof window === "undefined" ? null : window.localStorage.getItem(key),
  setItem: async (key: string, value: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  },
};

export const supabase = createClient(
  supabaseUrl || "https://missing-project.supabase.co",
  supabaseKey || "missing-publishable-key",
  {
    auth: {
      storage: Platform.OS === "web" ? webSessionStorage : secureSessionStorage,
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
