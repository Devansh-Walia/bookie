import { StyleSheet, SafeAreaView } from "react-native";
import BookList from "../../components/BookList";

export default function Index() {
  return (
    <SafeAreaView style={styles.container}>
      <BookList />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
