import * as Clipboard from "expo-clipboard";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useState } from "react";
import { Platform, Share, StyleSheet, Text, View } from "react-native";

import { Pressable } from "@/components/ui/pressable";
import { approvalLinkFor } from "@/lib/customer-links";
import {
  clearOrderDelivered,
  confirmOrderDelivered,
  deliveryPhotoUrl,
  uploadDeliveryPhoto,
  type DeliveryMethod,
  type OrderRecord,
} from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

const pastTense: Record<DeliveryMethod, string> = { delivery: "delivered", pickup: "picked up" };

export function deliveryMessage(method: DeliveryMethod, link: string) {
  return method === "pickup"
    ? `Thank you! Your order has been picked up.${link ? ` ${link}` : ""}`
    : `Your order has been delivered.${link ? ` ${link}` : ""}`;
}

/** Lets the owner record a delivery or pick-up and share the customer order link. */
export function DeliveryConfirmCard({ order, onChanged }: { order: OrderRecord; onChanged: () => Promise<void> }) {
  const [method, setMethod] = useState<DeliveryMethod>(order.deliveryMethod ?? "delivery");
  const [photo, setPhoto] = useState<{ uri: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const confirmed = Boolean(order.deliveredAt);
  const link = approvalLinkFor(order.approvalToken);
  const savedPhoto = order.deliveryMethod === "pickup" ? "" : deliveryPhotoUrl(order.deliveryPhotoPath);
  const preview = photo?.uri ?? savedPhoto;
  const confirmedMethod = order.deliveryMethod ?? method;

  async function pick(source: "camera" | "library") {
    setError("");
    try {
      if (Platform.OS !== "web") {
        const permission =
          source === "camera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setError(source === "camera" ? "Allow camera access to take a photo." : "Allow photo access to choose a photo.");
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, allowsEditing: false };
      const result =
        source === "camera" && Platform.OS !== "web"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.canceled ? null : result.assets[0];
      if (asset) setPhoto({ uri: asset.uri });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the photo picker.");
    }
  }

  async function confirm() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let photoPath = method === "delivery" && order.deliveryMethod !== "pickup" ? order.deliveryPhotoPath || null : null;
      if (method === "delivery" && photo) {
        const context = ImageManipulator.manipulate(photo.uri, { maxWidth: 1200, maxHeight: 1200 });
        const image = await context.renderAsync();
        const compressed = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
        photoPath = await uploadDeliveryPhoto(order.id, compressed.uri, "image/jpeg");
      }
      await confirmOrderDelivered(order.id, method, photoPath);
      setPhoto(null);
      await onChanged();
      setMessage("Saved. Share the confirmation with your customer.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the delivery confirmation.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const text = deliveryMessage(confirmedMethod, link);
    setError("");
    try {
      if (Platform.OS === "web") {
        if (navigator.share) await navigator.share({ text });
        else {
          await navigator.clipboard.writeText(text);
          setMessage("Message copied to the clipboard.");
        }
      } else {
        await Share.share({ message: text });
      }
    } catch {
      // Dismissing the share sheet is not an error.
    }
  }

  async function copy() {
    try {
      await Clipboard.setStringAsync(link);
      setMessage("Link copied.");
    } catch {
      setError("Could not copy the link.");
    }
  }

  async function undo() {
    setBusy(true);
    setError("");
    try {
      await clearOrderDelivered(order.id);
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not undo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Delivery confirmation</Text>
        <Text style={[styles.badge, confirmed && styles.badgeConfirmed]}>{confirmed ? "Confirmed" : "Not confirmed"}</Text>
      </View>
      {confirmed ? (
        <Text style={styles.hint}>
          Marked {pastTense[confirmedMethod]} on {new Date(order.deliveredAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
        </Text>
      ) : (
        <Text style={styles.hint}>Choose how the customer received their order.</Text>
      )}
      <View style={styles.row}>
        {(["delivery", "pickup"] as const).map((option) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: method === option, disabled: busy }}
            disabled={busy}
            key={option}
            onPress={() => setMethod(option)}
            style={[styles.chip, method === option && styles.chipActive]}
          >
            <Text style={[styles.chipText, method === option && styles.chipTextActive]}>{option === "delivery" ? "Delivered" : "Picked up"}</Text>
          </Pressable>
        ))}
      </View>
      {method === "delivery" ? (
        <View style={styles.photoSection}>
          <Text style={styles.photoTitle}>Delivery photo (optional)</Text>
          <Text style={styles.hint}>Add a photo for the customer’s order page.</Text>
          {preview ? <Image contentFit="contain" source={{ uri: preview }} style={styles.photo} /> : null}
          <View style={styles.row}>
            {Platform.OS !== "web" ? (
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void pick("camera")} style={[styles.outline, styles.flex, busy && styles.dimmed]}>
                <Text style={styles.outlineText}>Take photo</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void pick("library")} style={[styles.outline, styles.flex, busy && styles.dimmed]}>
              <Text style={styles.outlineText}>{Platform.OS === "web" ? "Choose photo" : "Choose from library"}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.hint}>No photo is needed for pickup.</Text>
      )}
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void confirm()} style={[styles.solid, busy && styles.dimmed]}>
        <Text style={styles.solidText}>{busy ? "Saving…" : confirmed ? "Update confirmation" : `Mark as ${pastTense[method]}`}</Text>
      </Pressable>
      {confirmed ? (
        <>
          {link ? <Text selectable style={styles.link}>{link}</Text> : <Text style={styles.hint}>Set EXPO_PUBLIC_APPROVAL_BASE_URL to create the customer link.</Text>}
          {link ? (
            <View style={styles.row}>
              <Pressable accessibilityRole="button" onPress={() => void copy()} style={[styles.outline, styles.flex]}>
                <Text style={styles.outlineText}>Copy link</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => void share()} style={[styles.solid, styles.flex]}>
                <Text style={styles.solidText}>Send to customer</Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void undo()} style={styles.undo}>
            <Text style={styles.undoText}>Undo confirmation</Text>
          </Pressable>
        </>
      ) : null}
      {message ? <Text style={styles.hint}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, borderRadius: 16, backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  title: { color: colors.espresso, fontSize: 16, fontWeight: "700" },
  badge: { overflow: "hidden", borderRadius: 999, backgroundColor: colors.parchment, color: colors.mutedText, fontSize: 11, fontWeight: "700", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  badgeConfirmed: { backgroundColor: "#E4EBDD", color: colors.teal },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  error: { color: colors.brick, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  chip: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.parchment },
  chipActive: { borderColor: colors.teal, backgroundColor: colors.teal },
  chipText: { color: colors.espresso, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.card },
  photoSection: { gap: spacing.sm, borderRadius: 12, backgroundColor: colors.parchment, padding: spacing.sm },
  photoTitle: { color: colors.espresso, fontSize: 13, fontWeight: "700" },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: colors.parchment },
  outline: { minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: spacing.sm },
  outlineText: { color: colors.espresso, fontSize: 13, fontWeight: "700" },
  solid: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.teal },
  solidText: { color: colors.card, fontSize: 14, fontWeight: "700" },
  dimmed: { opacity: 0.5 },
  link: { color: colors.espresso, fontSize: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.parchment, padding: spacing.sm },
  undo: { alignItems: "center", paddingVertical: spacing.xs },
  undoText: { color: colors.brick, fontSize: 12, fontWeight: "700" },
});
