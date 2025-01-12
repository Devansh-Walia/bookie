import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Book } from "@/types";

interface BookItemProps {
  book: Book;
  onSelect: (book: Book) => void;
  onRemove: (id: string) => void;
}

export const BookItem = ({ book, onSelect, onRemove }: BookItemProps) => (
  <View style={styles.bookItem}>
    <TouchableOpacity style={styles.bookContent} onPress={() => onSelect(book)}>
      <View style={styles.bookHeader}>
        <Text style={styles.bookTitle} numberOfLines={1}>
          {book.title}
        </Text>
      </View>
      <Text style={styles.lastRead}>
        Last read: {new Date(book.lastReadAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      onPress={() => onRemove(book.id)}
      style={styles.removeButton}
    >
      <Text style={styles.removeButtonText}>×</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  bookItem: {
    borderColor: "gray",
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookContent: {
    padding: 8,
    borderRadius: 6,
    marginVertical: 4,
  },
  bookHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    color: "white",
  },
  lastRead: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
  removeButton: {
    padding: 4,
    position: "absolute",
    top: -5,
    right: 10,
  },
  removeButtonText: {
    fontSize: 24,
    color: "#FF3B30",
    fontWeight: "600",
  },
});
