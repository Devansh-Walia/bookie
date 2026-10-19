import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import useSettingsStore from "../store/settingsStore";

/** Fire-and-forget haptics that respect the user's setting. */
function enabled() {
  return Platform.OS !== "web" && useSettingsStore.getState().haptics;
}

export const haptics = {
  pageTurn() {
    if (enabled())
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  tap() {
    if (enabled()) Haptics.selectionAsync().catch(() => {});
  },
  success() {
    if (enabled())
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
  },
};
