import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import COLORS from "@/app/constants";

type Theme = typeof COLORS.light;

interface ThemeContextProps {
  colors: Theme;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextProps>({
  colors: COLORS.dark as Theme,
  isDarkMode: true,
  toggleTheme: () => {},
});

const STORAGE_KEY = "APP_THEME";

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedTheme !== null) {
          setIsDarkMode(storedTheme === "dark");
        }
      } catch (e) {
        console.error("Failed to load theme:", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    const saveTheme = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, isDarkMode ? "dark" : "light");
      } catch (e) {
        console.error("Failed to save theme:", e);
      }
    };
    saveTheme();
  }, [isDarkMode]);

  if (!isLoaded) return null;

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  return (
    <ThemeContext.Provider
      value={{
        colors: isDarkMode ? COLORS.dark : COLORS.light,
        isDarkMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
