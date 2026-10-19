import React, { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { palette } from "../../constants/theme";
import useStatsStore from "../../store/statsStore";
import { computeStreaks } from "../../utils/stats";

export default function TabLayout() {
  const days = useStatsStore((s) => s.days);
  const streak = useMemo(() => computeStreaks(days), [days]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: "#94A3B8",
        headerShown: false,
        tabBarStyle: {
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: palette.lightCard,
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
          tabBarBadgeStyle: { backgroundColor: palette.warning },
        }}
      />
    </Tabs>
  );
}
