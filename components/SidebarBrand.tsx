import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { AppColors } from "../constants/theme";
import { useAppColors, useThemedStyles } from "../hooks/useAppTheme";

/**
 * Brand header for the desktop sidebar.
 *
 * Rendered through the tab bar's `tabBarBackground` slot, which is an
 * absolutely-filled layer behind the tabs — so the tab bar reserves room for it
 * with `paddingTop` and this sits at the top.
 */
export function SidebarBrand() {
  const c = useAppColors();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Image
        source={require("../assets/images/icon.png")}
        style={styles.icon}
        resizeMode="cover"
      />
      <Text style={[styles.name, { color: c.text }]}>Bookie</Text>
    </View>
  );
}

/** Height the tab bar must reserve above the tabs. */
export const SIDEBAR_BRAND_HEIGHT = 64;

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    wrap: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: SIDEBAR_BRAND_HEIGHT,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    icon: { width: 28, height: 28, borderRadius: 8 },
    name: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  });
