import PresetsScreen from "@/app/(tabs)/presets";
import RiderScreen, { RiderItem } from "@/app/screens/rider";
import { eventsContext } from "@/src/context/eventsContext";
import { useProfile } from "@/src/context/profileContext";
import ProfileSelectModal from "@/src/context/ProfileSelectModal";
import { useTheme } from "@/src/context/themeContext";
import { Event, saveEvent } from "@/src/utils/ridersHelpers";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import React, { useContext, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import StagePlanModal from "./stagePlan";
import { resolveIconSource } from "./iconAssets";

const { width, height } = Dimensions.get("window");

type Preset = {
  id: string;
  type: "riders" | "stageplans";
  config?: { riderItems?: RiderItem[] };
  stageIcons?: any[];
};

type EventProfile = {
  id: string;
  name: string;
};

type ProfileSelectProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (profileName: string) => void;
  currentProfileId: string;
  profiles: string[];
};

type RequirementNode = {
  text: string;
  children?: RequirementNode[];
};

type Props = {
  visible: boolean;
  event: Event | null;
  initialDate?: Date | null;
  onClose: () => void;
  onSave: (updatedEvent: Event) => void;
};

const hydrateRiderItems = (
  nodes: RequirementNode[] | RiderItem[] = [],
  parentPath: number[] = [],
): RiderItem[] =>
  nodes.map((node, index) => {
    const currentPath = [...parentPath, index];
    const children = (node as RiderItem).children ?? node.children ?? [];

    return {
      id: (node as RiderItem).id || `rider-${currentPath.join("-")}`,
      text: node.text ?? "",
      children: hydrateRiderItems(children as RequirementNode[], currentPath),
      expanded: (node as RiderItem).expanded ?? true,
      isEditing: (node as RiderItem).isEditing ?? false,
    };
  });

const serializeRiderItems = (items: RiderItem[]): RequirementNode[] =>
  items.map((item) => ({
    text: item.text,
    children:
      item.children && item.children.length > 0
        ? serializeRiderItems(item.children)
        : [],
  }));

export default function EditEventModal({
  visible,
  event,
  initialDate,
  onClose,
  onSave,
}: Props) {
  const { events } = useContext(eventsContext);
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const isCreating = !event?.id;
  const { profiles, selectedProfile, getProfileColor } = useProfile();

  const selectedProfileColor = getProfileColor(selectedProfile);

  const COLORS = {
    primary: selectedProfileColor,
  };

  const [localEvent, setLocalEvent] = useState<Event>({
    id: "",
    eventName: "",
    venue: "",
    date: initialDate || new Date(),
    requirements: [],
    stageIcons: [],
    stageLayout: undefined,
    profileId: selectedProfile || "Default Profile",
    riderPresetId: undefined,
    stagePlanPresetId: undefined,
  });

  const currentProfileId = selectedProfile || "Default Profile";

  const [displayDate, setDisplayDate] = useState("Date");
  const [displayTime, setDisplayTime] = useState("Time");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");

  const [riderModalVisible, setRiderModalVisible] = useState(false);
  const [stageModalVisible, setStageModalVisible] = useState(false);
  const [riderItems, setRiderItems] = useState<RiderItem[]>([]);

  const [riderPresetModalVisible, setRiderPresetModalVisible] = useState(false);
  const [stagePresetModalVisible, setStagePresetModalVisible] = useState(false);

  const [stagePreviewVisible, setStagePreviewVisible] = useState(false);
  const [selectedStagePreset, setSelectedStagePreset] = useState<any>(null);

  const [profileSelectModalVisible, setProfileSelectModalVisible] =
    useState(false);

  const isInnerModalOpen =
    riderModalVisible ||
    stageModalVisible ||
    riderPresetModalVisible ||
    stagePresetModalVisible ||
    stagePreviewVisible ||
    profileSelectModalVisible;

  const formatDate = (date: Date) =>
    `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${date.getFullYear()}`;

  const formatTime = (date: Date) =>
    `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

  const handleChange = (key: keyof Event, value: any) => {
    setLocalEvent((prev) => ({ ...prev, [key]: value }));
  };

  const onDateTimeChange = (_e: DateTimePickerEvent, selected?: Date) => {
    setShowPicker(false);

    if (!selected) return;

    const newDate = new Date(localEvent.date);

    if (pickerMode === "date") {
      newDate.setFullYear(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
      );
      setDisplayDate(formatDate(newDate));
    } else {
      newDate.setHours(selected.getHours(), selected.getMinutes());
      setDisplayTime(formatTime(newDate));
    }

    handleChange("date", newDate);
  };

  const initializeEventState = (
    currentEvent: Event | null,
    defaultDate: Date,
  ) => {
    if (currentEvent) {
      const eventDate =
        currentEvent.date instanceof Date
          ? currentEvent.date
          : new Date(currentEvent.date);

      setLocalEvent({
        ...currentEvent,
        date: eventDate,
        profileId: currentEvent.profileId || currentProfileId,
      });

      const requirementsAsRiderItems = hydrateRiderItems(
        (currentEvent.requirements as RequirementNode[]) || [],
      );

      setRiderItems(requirementsAsRiderItems);
      setDisplayDate(formatDate(eventDate));
      setDisplayTime(formatTime(eventDate));

      if (currentEvent.stagePlanPresetId) {
        AsyncStorage.getItem(`@preset:${currentEvent.stagePlanPresetId}`).then(
          (str) => {
            if (!str) return;
            const preset = JSON.parse(str) as { stageIcons?: any[] };
            setLocalEvent((prev) => ({
              ...prev,
              stageIcons: preset.stageIcons || [],
              stagePlanPresetId: currentEvent.stagePlanPresetId,
            }));
          },
        );
      }
    } else {
      setLocalEvent({
        id: "",
        eventName: "",
        venue: "",
        date: defaultDate,
        requirements: [],
        stageIcons: [],
        stageLayout: undefined,
        profileId: currentProfileId,
        riderPresetId: undefined,
        stagePlanPresetId: undefined,
      });

      setRiderItems([]);
      setDisplayDate(formatDate(defaultDate));
      setDisplayTime(formatTime(defaultDate));
    }
  };

  useEffect(() => {
    if (visible) {
      const dt = initialDate || new Date();
      const currentEvent = events.find((e) => e.id === event?.id) || event;
      initializeEventState(currentEvent, dt);
    }
  }, [visible, event, initialDate, events, currentProfileId]);

  const handleSave = async () => {
    try {
      const eventToSave: Event = {
        ...localEvent,
        requirements: riderItems,
        profileId: localEvent.profileId,
      };

      const updatedEvent = await saveEvent(eventToSave);

      onSave(updatedEvent);
      onClose();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Event Name required");
    }
  };

  const applyPreset = (preset: Preset) => {
    if (preset.type === "riders") {
      const items: RiderItem[] = Array.isArray(preset.config?.riderItems)
        ? hydrateRiderItems(
            JSON.parse(
              JSON.stringify(preset.config.riderItems),
            ) as RequirementNode[],
          )
        : [];

      setRiderItems(items);
      handleChange("riderPresetId", preset.id);
      setRiderPresetModalVisible(false);
    } else if (preset.type === "stageplans") {
      handleChange("stageIcons", preset.stageIcons || []);
      handleChange("stagePlanPresetId", preset.id);
      setStagePresetModalVisible(false);
    }
  };

  const handleProfileSelect = (profileId: string) => {
    handleChange("profileId", profileId);
    setProfileSelectModalVisible(false);
  };

  const selectedProfileName = localEvent.profileId;

  return (
    <>
      <Modal
        visible={visible && !isInnerModalOpen}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {isCreating
                ? "Create Event"
                : localEvent.eventName || "Edit Event"}
            </Text>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={26} color={colors.text_primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.inputLikeBox, { marginBottom: 20 }]}
              onPress={() => setProfileSelectModalVisible(true)}
            >
              <Text style={styles.inputText}>
                Profile: {selectedProfileName}
              </Text>
              <Ionicons
                name="person-circle-outline"
                size={24}
                color={selectedProfileColor}
              />
            </TouchableOpacity>

            <TextInput
              style={styles.modalInput}
              placeholder="Event Name"
              placeholderTextColor={colors.placeholder_gray}
              value={localEvent.eventName}
              onChangeText={(text) => handleChange("eventName", text)}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Venue"
              placeholderTextColor={colors.placeholder_gray}
              value={localEvent.venue || ""}
              onChangeText={(text) => handleChange("venue", text)}
            />

            <TouchableOpacity
              style={styles.inputLikeBox}
              onPress={() => {
                setPickerMode("time");
                setShowPicker(true);
              }}
            >
              <Text style={styles.inputText}>{displayTime}</Text>
              <Ionicons name="time" size={20} color={colors.text_primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.inputLikeBox}
              onPress={() => {
                setPickerMode("date");
                setShowPicker(true);
              }}
            >
              <Text style={styles.inputText}>{displayDate}</Text>
              <Ionicons name="calendar" size={20} color={colors.text_primary} />
            </TouchableOpacity>

            {showPicker && (
              <View style={styles.datePickerContainer}>
                <DateTimePicker
                  value={localEvent.date || new Date()}
                  mode={pickerMode}
                  is24Hour
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={onDateTimeChange}
                />
              </View>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.modalActionButton,
                  { flex: 1, marginRight: 8, marginVertical: 0 },
                ]}
                onPress={() => setRiderModalVisible(true)}
              >
                <Text style={styles.modalActionText}>Edit Rider</Text>
              </TouchableOpacity>

              <View>
                <TouchableOpacity
                  style={[
                    styles.iconButton,
                    localEvent.riderPresetId && {
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setRiderPresetModalVisible(true)}
                >
                  <Ionicons
                    name="albums-outline"
                    size={22}
                    color={
                      localEvent.riderPresetId
                        ? colors.primary
                        : colors.text_primary
                    }
                  />
                </TouchableOpacity>
                {localEvent.riderPresetId && (
                  <View style={styles.presetBadge} />
                )}
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.modalActionButton,
                  { flex: 1, marginRight: 8, marginVertical: 0 },
                ]}
                onPress={() => setStageModalVisible(true)}
              >
                <Text style={styles.modalActionText}>Edit Stage Plan</Text>
              </TouchableOpacity>

              <View>
                <TouchableOpacity
                  style={[
                    styles.iconButton,
                    localEvent.stagePlanPresetId && {
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setStagePresetModalVisible(true)}
                >
                  <Ionicons
                    name="albums-outline"
                    size={22}
                    color={
                      localEvent.stagePlanPresetId
                        ? colors.primary
                        : colors.text_primary
                    }
                  />
                </TouchableOpacity>
                {localEvent.stagePlanPresetId && (
                  <View style={styles.presetBadge} />
                )}
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleSave}
            >
              <Text
                style={[
                  styles.modalActionText,
                  { color: colors.text_on_color },
                ]}
              >
                Save Event
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PROFILE SELECT MODAL */}
      <ProfileSelectModal
        visible={profileSelectModalVisible}
        onClose={() => setProfileSelectModalVisible(false)}
        onSelect={handleProfileSelect}
        currentProfileId={localEvent.profileId ?? "Default Profile"}
        profiles={profiles}
      />

      {/* Rider Modal */}
      <Modal
        visible={riderModalVisible}
        animationType="slide"
        onRequestClose={() => setRiderModalVisible(false)}
      >
        <RiderScreen
          initialItems={riderItems}
          onSave={(updatedItems) => {
            setRiderItems(updatedItems);
            setRiderModalVisible(false);
          }}
        />
      </Modal>

      {/* Rider Presets */}
      <Modal
        visible={riderPresetModalVisible}
        animationType="slide"
        onRequestClose={() => setRiderPresetModalVisible(false)}
      >
        <PresetsScreen
          selectMode
          initialTab="riders"
          onSelect={(preset) => applyPreset(preset as Preset)}
          onClose={() => setRiderPresetModalVisible(false)}
        />
      </Modal>

      {/* Stage Plan Presets */}
      <Modal
        visible={stagePresetModalVisible}
        animationType="slide"
        onRequestClose={() => setStagePresetModalVisible(false)}
      >
        <PresetsScreen
          selectMode
          initialTab="stageplans"
          onClose={() => setStagePresetModalVisible(false)}
          onSelect={(preset) => {
            if (
              (preset as Preset).stageIcons &&
              (preset as Preset).stageIcons!.length > 0
            ) {
              setSelectedStagePreset(preset);
              setStagePreviewVisible(true);
            } else {
              applyPreset(preset as Preset);
            }
          }}
        />
      </Modal>

      {/* Stage Plan Preview */}
      {stagePreviewVisible && selectedStagePreset && (
        <Modal visible transparent animationType="fade">
          <View style={styles.stagePreviewBackground}>
            <View style={styles.stagePreviewContainer}>
              {selectedStagePreset.stageIcons?.map((icon: any) => {
                const resolvedSource = resolveIconSource(icon);
                if (!resolvedSource) return null;

                const containerWidth = width * 0.95;
                const containerHeight = containerWidth * (842 / 595);

                const normalizedWidth = icon.width ?? 60 / 595;

                const normalizedHeight = icon.height ?? 60 / 842;

                const scale = icon.scale ?? 1;

                const displayWidth = normalizedWidth * containerWidth * scale;
                const displayHeight =
                  normalizedHeight * containerHeight * scale;

                const contentWidth = Math.max(0, displayWidth - 5 * 2);
                const contentHeight = Math.max(0, displayHeight - 5 * 2);

                const left = icon.x * containerWidth - 5;
                const top = icon.y * containerHeight - 5;

                return (
                  <View
                    key={icon.id}
                    style={{
                      position: "absolute",
                      left,
                      top,
                      width: displayWidth,
                      height: displayHeight,
                      padding: 5,
                    }}
                  >
                    <Image
                      source={resolvedSource}
                      style={{
                        width: contentWidth,
                        height: contentHeight,
                        resizeMode: "contain",
                        transform: [{ rotate: `${icon.rotation ?? 0}deg` }],
                      }}
                    />
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                styles.stagePreviewButton,
                { backgroundColor: colors.secondary, marginBottom: 10 },
              ]}
              onPress={() => setStagePreviewVisible(false)}
            >
              <Text
                style={[
                  styles.stagePreviewButtonText,
                  { color: colors.text_on_color },
                ]}
              >
                Close Preview
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.stagePreviewButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={() => {
                applyPreset(selectedStagePreset);
                setStagePreviewVisible(false);
              }}
            >
              <Text
                style={[
                  styles.stagePreviewButtonText,
                  { color: colors.text_on_color },
                ]}
              >
                Apply Preset
              </Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      {/* Stage Plan Editor */}
      <StagePlanModal
        visible={stageModalVisible}
        event={localEvent}
        onClose={() => setStageModalVisible(false)}
        onSave={async (updatedEvent) => {
          if ("eventName" in updatedEvent && "date" in updatedEvent) {
            setLocalEvent(updatedEvent);
          }
          return Promise.resolve();
        }}
        onReturnToEdit={(updatedEvent) => {
          if ("eventName" in updatedEvent && "date" in updatedEvent) {
            setLocalEvent(updatedEvent);
          }
          setStageModalVisible(false);
        }}
      />
    </>
  );
}

// ----- STYLES -----
const getStyles = (colors: any) =>
  StyleSheet.create({
    modalBackground: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },

    modalContainer: {
      width: "100%",
      backgroundColor: colors.background_main,
      borderRadius: 12,
      padding: 20,
      flexShrink: 1, // prevents overflowing small screens
      marginBottom: "5%",
    },

    modalTitle: {
      fontWeight: "bold",
      fontSize: 20,
      marginBottom: 20,
      color: colors.text_primary,
      alignSelf: "center",
    },

    closeButton: {
      position: "absolute",
      top: 10,
      right: 10,
      padding: 12,
      zIndex: 100,
    },

    modalInput: {
      borderWidth: 1,
      borderColor: colors.border_color,
      borderRadius: 12,
      padding: 10,
      marginBottom: 12,
      color: colors.text_primary,
    },

    datePickerContainer: {
      width: "100%",
      alignItems: "center",
      marginBottom: 10,
    },

    inputLikeBox: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border_color,
      borderRadius: 12,
      paddingHorizontal: 10,
      height: 44,
      marginBottom: 12,
      justifyContent: "space-between",
    },

    inputText: {
      fontSize: 14,
      color: colors.text_primary,
      flex: 1,
    },

    modalActionButton: {
      backgroundColor: colors.background_main,
      borderColor: colors.border_color,
      borderWidth: 1,
      paddingVertical: 12,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginVertical: 8,
    },

    modalSaveButton: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      marginVertical: 10,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },

    modalActionText: {
      color: colors.text_primary,
      fontWeight: "bold",
      textAlign: "center",
      fontSize: 16,
    },

    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 6,
    },

    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border_color,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background_main,
    },

    presetBadge: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },

    stagePreviewBackground: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.8)",
      justifyContent: "center",
      alignItems: "center",
    },

    stagePreviewContainer: {
      width: "95%",
      aspectRatio: 595 / 842,
      backgroundColor: colors.text_on_color,
      borderRadius: 12,
      overflow: "hidden",
    },

    stagePreviewButton: {
      marginTop: 20,
      padding: 10,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      width: "60%",
    },

    stagePreviewButtonText: {
      fontWeight: "bold",
      fontSize: 16,
      textAlign: "center",
    },
  });
