import { EventsProvider } from "@/src/context/eventsContext";
import { ExportSettingsProvider } from "@/src/context/exportSettingsContext";
import { PresetProvider } from "@/src/context/presetContext";
import { ProfileProvider } from "@/src/context/profileContext";
import { UserProvider } from "@/src/context/UserContext";
import { Tabs } from "expo-router";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-get-random-values";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

import { ThemeProvider, useTheme } from "../../src/context/themeContext";

export default function TabLayout() {
  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <UserProvider>
            <ProfileProvider>
              <EventsProvider>
                <PresetProvider>
                  <ExportSettingsProvider>
                    <AppTabs />
                  </ExportSettingsProvider>
                </PresetProvider>
              </EventsProvider>
            </ProfileProvider>
          </UserProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

function AppTabs() {
  const { colors, isDarkMode } = useTheme();

  return (
    <Tabs
      key={isDarkMode ? "dark" : "light"}
      screenOptions={() => ({
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.background_main,
          borderTopWidth: 1,
          borderTopColor: colors.border_color,
          elevation: 0,
          shadowColor: "transparent",
          shadowOpacity: 0,
          shadowRadius: 0,
        },
        tabBarItemStyle: { justifyContent: "center", alignItems: "center" },
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: "gray",
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" color={color} size={28} />
          ),
        }}
      />
      <Tabs.Screen
        name="presets"
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="library" color={color} size={28} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="calendar" color={color} size={28} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" color={color} size={28} />
          ),
        }}
      />
    </Tabs>
  );
}
