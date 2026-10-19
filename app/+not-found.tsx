import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import type { AppColors } from "@/constants/theme";
import { useThemedStyles } from "@/hooks/useAppTheme";

export default function NotFoundScreen() {
  const styles = useThemedStyles(makeStyles);
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={styles.container}>
        <Text style={styles.title}>This page doesn&apos;t exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Back to your library</Text>
        </Link>
      </View>
    </>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      backgroundColor: c.background,
    },
    title: { fontSize: 20, fontWeight: "bold", color: c.text },
    link: { marginTop: 15, paddingVertical: 15 },
    linkText: { fontSize: 14, color: c.primary },
  });
