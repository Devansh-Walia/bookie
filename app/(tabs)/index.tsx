import { StyleSheet } from "react-native";
import { View } from "../../components/Themed";
import BookList from "../../components/BookList";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <BookList />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
