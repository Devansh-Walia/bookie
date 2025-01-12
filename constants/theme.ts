import { DarkTheme, DefaultTheme } from "@react-navigation/native";

export const customLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#3498db",
    secondary: "#2980b9",
    background: "#ffffff",
    text: "#000000",
    border: "#e0e0e0",
  },
};

export const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#2980b9",
    secondary: "#3498db",
    background: "#1a2634",
    text: "#ffffff",
    border: "#2C3E50",
  },
};
