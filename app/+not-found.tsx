import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { palette } from "@/constants/theme";

export default function NotFoundScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: palette.lightBackground,
  },
  title: { fontSize: 20, fontWeight: "bold", color: palette.textPrimary },
  link: { marginTop: 15, paddingVertical: 15 },
  linkText: { fontSize: 14, color: palette.primary },
});
