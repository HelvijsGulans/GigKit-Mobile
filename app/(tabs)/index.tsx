import { eventsContext } from "@/src/context/eventsContext";
import { useProfile } from "@/src/context/profileContext";
import notificationService from "@/src/services/notificationService";
import EditEventModal from "@/src/utils/editEventModal";
import createEventsPdf from "@/src/utils/pdfExports";
import { Event as EventType } from "@/src/utils/ridersHelpers";
import TutorialModal, { tutorialSteps } from "@/src/utils/Tutorialhelpers";
import { Entypo, Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaskedView from "@react-native-masked-view/masked-view";
import { addDays, format, startOfDay } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import React, { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../src/context/themeContext";
import { useUser } from "../../src/context/UserContext";

const EXTRA_TOP_PADDING = 20;
const DAY_OPTIONS = [3, 5, 7, 14, 30, "ALL"] as const;

const HomeScreen = () => {
  const { events, updateEvent } = useContext(eventsContext);
  const { colors } = useTheme();
  const [tutorialModalVisible, setTutorialModalVisible] = useState(false);
  const [daysAhead, setDaysAhead] = useState<number | "ALL">(7);
  const [daysModalVisible, setDaysModalVisible] = useState(false);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const { getProfileColor } = useProfile();
  const today = startOfDay(new Date());

  const DAYS_AHEAD_KEY = "@home:daysAhead";

  const { hasSeenTutorial, completeTutorial } = useUser();

  useEffect(() => {
    if (hasSeenTutorial === false) {
      setTutorialModalVisible(true);
    }
  }, [hasSeenTutorial]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DAYS_AHEAD_KEY);
        if (raw) {
          if (raw === "ALL") {
            setDaysAhead("ALL");
          } else {
            const v = Number(raw);
            if (!isNaN(v)) setDaysAhead(v);
          }
        }
      } catch (e) {
        console.error("Failed to read persisted daysAhead", e);
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(DAYS_AHEAD_KEY, String(daysAhead)).catch((e) =>
      console.error("Failed to persist daysAhead", e),
    );
  }, [daysAhead]);

  useEffect(() => {
    let sub: any;
    (async () => {
      try {
        await notificationService.initNotifications();
        for (const ev of events) {
          await notificationService.scheduleEventNotifications(ev as any);
        }

        sub = Notifications.addNotificationResponseReceivedListener(
          (response: any) => {
            try {
              const eventId =
                response?.notification?.request?.content?.data?.eventId;
              if (eventId) {
                const ev = events.find((e) => e.id === eventId);
                if (ev) {
                  setSelectedEvent(ev as EventType);
                  setEventModalVisible(true);
                }
              }
            } catch (e) {
              console.error(
                "Failed handling notification response in Home tab",
                e,
              );
            }
          },
        );
      } catch (e) {
        console.error(
          "Failed to init or schedule notifications in Home tab",
          e,
        );
      }
    })();

    return () => {
      if (sub && sub.remove) sub.remove();
    };
  }, []);

  const upcomingEvents = events
    .filter((event) => {
      if (!event.date) return false;

      if (daysAhead === "ALL") {
        return event.date >= today;
      }

      const nextNDays = addDays(today, daysAhead);
      return event.date >= today && event.date <= nextNDays;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const handleShareEvent = async (event: EventType) => {
    try {
      setLoadingPdf(true);

      await createEventsPdf([
        {
          ...event,
          venue: event.venue || "Unknown Venue",
          requirements: event.requirements,
          stageIcons: event.stageIcons,
        },
      ]);
    } catch (error) {
      console.error("Error sharing PDF:", error);
      alert("Failed to generate PDF");
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleEditEvent = (item: EventType) => {
    setSelectedEvent(item);
    setEventModalVisible(true);
  };

  const handleAddEvent = () => {
    setSelectedEvent(null);
    setEventModalVisible(true);
  };

  const handleSaveOrUpdateEvent = async (updatedEvent: EventType) => {
    await updateEvent(updatedEvent);
    setEventModalVisible(false);
    setSelectedEvent(null);
  };

  const renderItem = ({ item }: { item: EventType }) => {
    const profileColor = getProfileColor(item.profileId ?? "");

    return (
      <View
        style={[
          styles.itemContainer,
          {
            borderColor: colors.border_color,
            borderLeftColor: profileColor,
            borderLeftWidth: 5,
          },
        ]}
      >
        <MaterialIcons name="location-on" size={24} color={profileColor} />
        <View style={styles.textContainer}>
          <Text style={[styles.name, { color: colors.text_primary }]}>
            {item.eventName}
          </Text>
          {item.date && (
            <Text style={[styles.date, { color: colors.text_primary }]}>
              {format(item.date, "dd/MM/yyyy HH:mm")}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleEditEvent(item)}
        >
          <MaterialIcons name="edit" size={20} color={colors.text_primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleShareEvent(item)}
        >
          <Entypo name="share" size={20} color={colors.text_primary} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background_main }}>
      <View
        style={{
          flex: 1,
          paddingTop:
            (Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0) +
            EXTRA_TOP_PADDING,
          paddingHorizontal: 20,
        }}
      >
        <View style={styles.mainHeaderContainer}>
          <MaskedView
            maskElement={
              <Text
                style={[styles.headerText, { backgroundColor: "transparent" }]}
              >
                GigKit
              </Text>
            }
          >
            <LinearGradient
              colors={["#5F4086", "#75409C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={[styles.headerText, { opacity: 0 }]}>GigKit</Text>
            </LinearGradient>
          </MaskedView>

          <TouchableOpacity
            style={styles.tutorialButton}
            onPress={() => setTutorialModalVisible(true)}
          >
            <Entypo name="info-with-circle" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View>
          <View style={styles.upcomingHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text_primary }]}>
              Upcoming Events
            </Text>

            <TouchableOpacity
              style={styles.daysAheadButton}
              onPress={() => setDaysModalVisible(true)}
            >
              <Text style={{ color: colors.text_primary }}>
                {daysAhead === "ALL"
                  ? "All Future Events"
                  : `Next ${daysAhead} days`}
              </Text>
              <MaterialIcons
                name="arrow-drop-down"
                size={24}
                color={colors.text_primary}
              />
            </TouchableOpacity>
          </View>
          <View
            style={[
              styles.horizontalLine,
              { backgroundColor: colors.border_color },
            ]}
          />
        </View>

        {loadingPdf && (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginVertical: 20 }}
          />
        )}

        {upcomingEvents.length > 0 ? (
          <FlatList
            data={upcomingEvents}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
          />
        ) : (
          <View style={styles.noEventsContainer}>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleAddEvent}
            >
              <Ionicons name="add" size={32} color={colors.text_on_color} />
            </TouchableOpacity>
            <Text style={[styles.noEventsText, { color: colors.text_primary }]}>
              Tap to create your first event
            </Text>
          </View>
        )}

        <Modal
          visible={daysModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setDaysModalVisible(false)}
        >
          <View
            style={[
              styles.modalBackground,
              { backgroundColor: "rgba(0,0,0,0.5)" },
            ]}
          >
            <View
              style={[
                styles.modalContainer,
                { backgroundColor: colors.background_main },
              ]}
            >
              <TouchableOpacity
                style={styles.modalCloseIcon}
                onPress={() => setDaysModalVisible(false)}
              >
                <MaterialIcons
                  name="close"
                  size={24}
                  color={colors.text_primary}
                />
              </TouchableOpacity>

              <Text style={[styles.modalTitle, { color: colors.text_primary }]}>
                Select Days Ahead
              </Text>

              {DAY_OPTIONS.map((option) => {
                const isSelected = option === daysAhead;

                return (
                  <TouchableOpacity
                    key={option.toString()}
                    style={[
                      styles.modalOption,
                      isSelected && {
                        backgroundColor: colors.primary,
                        borderRadius: 8,
                      },
                    ]}
                    onPress={() => {
                      setDaysAhead(option);
                      setDaysModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        {
                          color: isSelected
                            ? colors.text_on_color
                            : colors.text_primary,
                          fontWeight: isSelected ? "bold" : "normal",
                        },
                      ]}
                    >
                      {option === "ALL"
                        ? "All Future Events"
                        : `${option} days`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Modal>

        <EditEventModal
          visible={eventModalVisible}
          event={selectedEvent}
          initialDate={new Date()}
          onClose={() => setEventModalVisible(false)}
          onSave={handleSaveOrUpdateEvent}
        />
        <TutorialModal
          isVisible={tutorialModalVisible}
          onClose={async () => {
            setTutorialModalVisible(false);
            if (hasSeenTutorial === false) {
              await completeTutorial();
            }
          }}
          steps={tutorialSteps}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  headerText: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    padding: 10,
    marginTop: -19,
  },
  mainHeaderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tutorialButton: {
    padding: 10,
    marginTop: -10,
  },
  upcomingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 10,
    padding: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "600" },
  horizontalLine: {
    height: 1,
    marginHorizontal: 10,
    marginBottom: 5,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    marginVertical: 5,
    borderWidth: 1,
    borderRadius: 10,
  },
  textContainer: { flex: 1, marginLeft: 10 },
  name: { fontSize: 16, fontWeight: "500" },
  date: { fontSize: 14, marginTop: 2 },
  iconButton: {
    marginLeft: 10,
    width: 25,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  daysAheadButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#33333320",
  },
  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContainer: {
    borderRadius: 16,
    padding: 20,
    width: "80%",
    maxWidth: 300,
    alignItems: "center",
    position: "relative",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  modalOption: {
    paddingVertical: 10,
    width: "100%",
    alignItems: "center",
  },
  modalOptionText: { fontSize: 16 },
  modalCloseIcon: {
    position: "absolute",
    top: 11,
    right: 10,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
    padding: 10,
  },
  modalContainerTutorial: {
    borderRadius: 16,
    width: "90%",
    height: "85%",
    position: "relative",
  },
  tutorialContentWrapper: {
    flex: 1,
  },
  noEventsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 50,
  },
  addButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  noEventsText: {
    fontSize: 16,
  },
});

export default HomeScreen;
