import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";

interface PDFViewerControlsProps {
  onClose: () => void;
}

export const PDFViewerControls = ({ onClose }: PDFViewerControlsProps) => (
  <View style={styles.closeContainer}>
    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
      <Text style={styles.closeButtonText}>×</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  closeContainer: {
    position: "absolute",
    top: 90,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  closeButtonText: {
    color: "white",
    fontSize: 24,
    fontWeight: "600",
  },
});
