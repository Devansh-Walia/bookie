import React, { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useAppColors } from "../../hooks/useAppTheme";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { SidebarBrand, SIDEBAR_BRAND_HEIGHT } from "../../components/SidebarBrand";
import useStatsStore from "../../store/statsStore";
import { computeStreaks } from "../../utils/stats";

export default function TabLayout() {
  const c = useAppColors();
  const { isDesktop } = useBreakpoint();
  const days = useStatsStore((s) => s.days);
  const streak = useMemo(() => computeStreaks(days), [days]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        headerShown: false,
        // Wide screens get a sidebar; phones keep the bottom bar.
        tabBarPosition: isDesktop ? "left" : "bottom",
        tabBarLabelPosition: isDesktop ? "beside-icon" : "below-icon",
        // React Navigation fills the active sidebar item with the theme's
        // primary colour. The tinted icon and label are enough.
        tabBarActiveBackgroundColor: "transparent",
        tabBarBackground: isDesktop ? () => <SidebarBrand /> : undefined,
        tabBarStyle: isDesktop
          ? {
              // React Navigation sets a responsive `minWidth` for sidebars;
              // override it so the sidebar stays a fixed, compact width.
              width: 232,
              minWidth: 232,
              backgroundColor: c.card,
              borderRightWidth: 1,
              borderRightColor: c.border,
              // Reserve room for the brand header drawn behind the tabs.
              paddingTop: SIDEBAR_BRAND_HEIGHT + 12,
              paddingBottom: 12,
            }
          : {
              borderTopWidth: 0,
              elevation: 0,
              backgroundColor: c.card,
            },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Library",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flame" size={size} color={color as string} />
          ),
          // Nudge when the streak is about to break.
          tabBarBadge:
            streak.current > 0 && !streak.readToday ? "!" : undefined,
          tabBarBadgeStyle: { backgroundColor: c.warning },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="settings-outline"
              size={size}
              color={color as string}
            />
          ),
        }}
      />
    </Tabs>
  );
}
