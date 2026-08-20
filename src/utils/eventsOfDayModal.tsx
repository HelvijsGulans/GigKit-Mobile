import { eventsContext } from "@/src/context/eventsContext";
import { useTheme } from "@/src/context/themeContext";
import createEventsPdf from "@/src/utils/pdfExports";
import { Event } from "@/src/utils/ridersHelpers";
import React, { FC, useContext, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import EditEventModal from "./editEventModal";

const { height } = Dimensions.get("window");

interface EventsOfDayModalProps {
  isVisible: boolean;
  onClose: (afterClose?: () => void) => void;
  selectedDate: Date | null;
  selectedEvents: Event[];
  deleteEvent: (id: string) => Promise<void>;
  setSelectedEvents: React.Dispatch<React.SetStateAction<Event[]>>;
}

const EventsOfDayModal: FC<EventsOfDayModalProps> = ({
  isVisible,
  onClose,
  selectedDate,
  selectedEvents,
  deleteEvent,
  setSelectedEvents,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { updateEvent, addEvent } = useContext(eventsContext);

  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({
    x: 0,
    y: 0,
    buttonWidth: 0,
    buttonHeight: 0,
  });
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const menuButtonRefs = useRef<{ [key: string]: View | null }>({});

  const sortedEvents = [...selectedEvents].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const handleToggleMenu = (itemId: string) => {
    if (menuVisible === itemId) {
      setMenuVisible(null);
      return;
    }
    menuButtonRefs.current[itemId]?.measureInWindow((x, y, width, height) => {
      setMenuPosition({ x, y, buttonWidth: width, buttonHeight: height });
      setMenuVisible(itemId);
    });
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setMenuVisible(null);
    setEditModalVisible(true);
    onClose(() => setEditModalVisible(true));
  };

  const handleAddEvent = () => {
    const newEvent: Event = {
      id: "",
      eventName: "",
      date: selectedDate || new Date(),
      requirements: [],
      stageIcons: [],
      venue: "",
    };
    setSelectedEvent(newEvent);
    setEditModalVisible(true);
    onClose();
  };

  const handleShareEvent = async (event: Event) => {
    try {
      setMenuVisible(null);
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
      Alert.alert("Error", "Failed to generate PDF");
    } finally {
      setLoadingPdf(false);
    }
  };

  return (
    <>
      <Modal visible={isVisible} transparent animationType="slide">
        {/* 
          WRAPPER THAT CLOSES MENU WHEN TAPPING OUTSIDE 
        */}
        <TouchableOpacity
          style={styles.modalBackground}
          activeOpacity={1}
          onPress={() => setMenuVisible(null)}
        >
          {/* INNER CONTAINER — prevents closing when tapped */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.modalContainer}
          >
            <TouchableOpacity
              style={styles.simpleCloseButton}
              onPress={() => onClose()}
            >
              <Icon name="close" size={30} color={colors.text_primary} />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>
              {selectedDate ? selectedDate.toDateString() : ""}
            </Text>

            {loadingPdf && (
              <ActivityIndicator
                size="large"
                color={colors.primary}
                style={{ marginVertical: 10 }}
              />
            )}

            <FlatList
              data={sortedEvents}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.eventCard}>
                  <View style={styles.eventDetails}>
                    <View style={styles.eventTimeContainer}>
                      <Text style={styles.eventTime}>
                        {new Date(item.date).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <Text style={styles.eventName}>{item.eventName}</Text>
                  </View>

                  <View
                    ref={(ref: View | null) => {
                      menuButtonRefs.current[item.id] = ref;
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => handleToggleMenu(item.id)}
                      style={styles.actionButton}
                    >
                      <Icon
                        name="ellipsis-vertical"
                        size={20}
                        color={colors.text_primary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              style={{ width: "100%", maxHeight: height * 0.55 }}
              contentContainerStyle={{ paddingBottom: 10 }}
            />

            <TouchableOpacity onPress={handleAddEvent} style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Add Event</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {menuVisible && (
            <View
              style={[
                styles.menu,
                {
                  top: menuPosition.y - 120,
                  left:
                    menuPosition.x -
                    150 / 2 +
                    menuPosition.buttonWidth / 2 +
                    50,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.menuItem}
                onPress={(e) => {
                  e.stopPropagation();
                  const eventToEdit = selectedEvents.find(
                    (e) => e.id === menuVisible
                  );
                  if (eventToEdit) handleEditEvent(eventToEdit);
                }}
              >
                <Text style={styles.menuText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  const eventToShare = selectedEvents.find(
                    (e) => e.id === menuVisible
                  );
                  if (eventToShare) handleShareEvent(eventToShare);
                }}
              >
                <Text style={styles.menuText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={async () => {
                  if (!menuVisible) return;
                  await deleteEvent(menuVisible);
                  setSelectedEvents((prev) =>
                    prev.filter((e) => e.id !== menuVisible)
                  );
                  setMenuVisible(null);
                  if (selectedEvents.length <= 1) onClose();
                }}
              >
                <Text style={[styles.menuText, { color: "red" }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Modal>

      {selectedEvent && (
        <EditEventModal
          visible={editModalVisible}
          event={selectedEvent}
          initialDate={selectedDate}
          onClose={() => setEditModalVisible(false)}
          onSave={async (updatedEvent) => {
            try {
              if (selectedEvent?.id) {
                await updateEvent(updatedEvent);
                setSelectedEvents((prev) =>
                  prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
                );
              } else {
                const newId = Date.now().toString();
                const newEvent = { ...updatedEvent, id: newId };
                await addEvent(newEvent);
                setSelectedEvents((prev) => [...prev, newEvent]);
              }
            } catch (error) {
              console.error("Failed to save event:", error);
            } finally {
              setEditModalVisible(false);
            }
          }}
        />
      )}
    </>
  );
};

const getStyles = (colors: any) =>
  StyleSheet.create({
    modalBackground: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.7)",
      width: "100%",
      height: "100%",
    },
    modalContainer: {
      backgroundColor: colors.background_main,
      borderRadius: 16,
      padding: 20,
      width: "90%",
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.text_primary,
      textAlign: "center",
      marginBottom: 15,
    },
    simpleCloseButton: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 20,
      padding: 7.5,
      marginRight: 5,
    },
    eventCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 10,
      backgroundColor:
        colors.background_main === "#FFFFFF" ? "#f0f0f0" : "#2C2C2E",
      borderRadius: 10,
      marginBottom: 10,
    },
    eventDetails: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    eventTimeContainer: {
      paddingRight: 15,
      borderRightWidth: 1,
      borderRightColor: colors.placeholder_gray,
      marginRight: 15,
    },
    eventTime: {
      fontSize: 14,
      color: colors.placeholder_gray,
      fontWeight: "bold",
    },
    eventName: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text_primary,
      flexShrink: 1,
    },
    actionButton: {
      padding: 5,
      marginLeft: 10,
    },
    menu: {
      position: "absolute",
      backgroundColor:
        colors.background_main === "#FFFFFF" ? "#f0f0f0" : "#2C2C2E",
      borderRadius: 8,
      paddingVertical: 5,
      paddingHorizontal: 10,
      zIndex: 999,
    },
    menuItem: {
      paddingVertical: 8,
    },
    menuText: {
      color: colors.text_primary,
      fontSize: 14,
    },
    addButton: {
      marginTop: 10,
      paddingVertical: 12,
      paddingHorizontal: 25,
      backgroundColor: colors.primary,
      borderRadius: 8,
      alignSelf: "center",
    },
    addButtonText: {
      color: colors.text_on_color,
      fontSize: 16,
      fontWeight: "bold",
    },
  });

export default EventsOfDayModal;
