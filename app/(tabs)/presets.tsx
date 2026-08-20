import RiderScreen, { RiderItem } from "@/app/screens/rider";
import { eventsContext } from "@/src/context/eventsContext";
import { useUser } from "@/src/context/UserContext";
import { cloudSyncService } from "@/src/features/cloudSync";
import { Icon } from "@/src/utils/ridersHelpers";
import StagePlanModal from "@/src/utils/stagePlan";
import { resolveIconSource } from "@/src/utils/iconAssets";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../src/context/themeContext";
import { usePreset } from "@/src/context/presetContext";

const EXTRA_TOP_PADDING = 20;
const DEFAULT_STAGE_LAYOUT_WIDTH = 595;
const DEFAULT_STAGE_LAYOUT_HEIGHT = 842;
const DEFAULT_WRAPPER_SIZE = 60;

export interface Preset {
  id: string;
  name: string;
  details?: string;
  type: "riders" | "stageplans";
  config: Record<string, any>;
  stageIcons?: Icon[];
  authUserId?: string;
  onClose?: () => void;
}

interface PresetsScreenProps {
  selectMode?: boolean;
  onSelect?: (preset: Preset) => void;
  initialTab?: "riders" | "stageplans";
  onClose?: () => void;
}

export default function PresetsScreen({
  selectMode = false,
  onSelect,
  initialTab,
  onClose,
}: PresetsScreenProps) {
  const { events, attachPresetToEvent } = useContext(eventsContext);
  const { user } = useUser();
  const userId = user?.uid;
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { presets, setPresets, updatePreset, deletePreset } = usePreset();

  const [activeTab, setActiveTab] = useState<"riders" | "stageplans">(
    initialTab || "riders",
  );
  const [search, setSearch] = useState("");

  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [riderModalVisible, setRiderModalVisible] = useState(false);
  const [riderItems, setRiderItems] = useState<RiderItem[]>([]);
  const [stageModalVisible, setStageModalVisible] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [selectEventModalVisible, setSelectEventModalVisible] = useState(false);
  const [eventSearch, setEventSearch] = useState("");
  const [stagePreviewVisible, setStagePreviewVisible] = useState(false);

  const nameInputRef = useRef<TextInput>(null);

  const savePreset = async (preset: Preset) => {
    try {
      await updatePreset(preset);
    } catch (error) {
      console.error("Failed to save preset:", error);
      Alert.alert("Error", "Failed to save preset locally or to the cloud.");
    }
  };

  useEffect(() => {
    const loadPresets = async () => {
      try {
        let finalPresets: Preset[] = [];
        if (userId && cloudSyncService.isEnabled()) {
          const cloudPresets = await cloudSyncService.loadPresets(userId);
          const keys = await AsyncStorage.getAllKeys();
          const presetKeys = keys.filter((k) => k.startsWith("@preset:"));
          const items = await AsyncStorage.multiGet(presetKeys);
          const localPresets = items
            .map(([_, value]) => (value ? JSON.parse(value) : null))
            .filter((p): p is Preset => !!p);

          const mergedMap = new Map<string, Preset>();
          localPresets.forEach((p) => mergedMap.set(p.id, p));
          cloudPresets.forEach((p) => mergedMap.set(p.id, p));
          finalPresets = Array.from(mergedMap.values());

          const cloudIds = new Set(cloudPresets.map((p) => p.id));
          const toDelete = localPresets.filter((p) => !cloudIds.has(p.id));
          if (toDelete.length) {
            const keysToDelete = toDelete.map((p) => `@preset:${p.id}`);
            await AsyncStorage.multiRemove(keysToDelete);
          }
        } else {
          const keys = await AsyncStorage.getAllKeys();
          const presetKeys = keys.filter((k) => k.startsWith("@preset:"));
          const items = await AsyncStorage.multiGet(presetKeys);
          finalPresets = items
            .map(([_, value]) => (value ? JSON.parse(value) : null))
            .filter((p): p is Preset => !!p);
        }

        setPresets(
          finalPresets.map((p) => ({
            ...p,
            stageIcons: p.stageIcons || [],
            config: p.config || {},
          })),
        );
      } catch (error) {
        console.error("Failed to load or merge presets:", error);
      }
    };
    loadPresets();
  }, [setPresets, userId]);

  const filteredPresets = presets.filter(
    (p) =>
      p.type === activeTab &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredEvents = events
    .filter((e) =>
      e.eventName.toLowerCase().includes(eventSearch.toLowerCase()),
    )
    .sort((a, b) => a.eventName.localeCompare(b.eventName));

  const handleAddPreset = () => {
    const newPreset: Preset = {
      id: Date.now().toString(),
      name: "",
      details: "",
      type: activeTab,
      stageIcons: [],
      config: {},
      authUserId: userId,
    };
    savePreset(newPreset);
    setEditingPresetId(newPreset.id);
    setTimeout(() => nameInputRef.current?.focus(), 100);
  };

  const handleStartEditingName = (presetId: string) => {
    setEditingPresetId(presetId);
    setTimeout(() => nameInputRef.current?.focus(), 100);
  };

  const exitEditingPreset = () => {
    setEditingPresetId(null);
    nameInputRef.current?.blur?.();
  };

  const savePresetName = async (id: string, name: string) => {
    const trimmed = name.trim();
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;

    if (!trimmed) {
      setPresets((prev) => prev.filter((p) => p.id !== id));

      try {
        await AsyncStorage.removeItem(`@preset:${id}`);
        if (userId && cloudSyncService.isEnabled()) {
          await cloudSyncService.deletePreset(userId, id);
        }
      } catch (error) {
        console.error("Failed to remove empty preset:", error);
      }

      setEditingPresetId(null);
      return;
    }

    const updatedPreset = { ...preset, name: trimmed };
    await savePreset(updatedPreset);
    setEditingPresetId(null);
  };

  const handleDeletePreset = async (id: string) => {
    await deletePreset(id);
  };

  const handleEditPreset = (preset: Preset) => {
    if (preset.type === "riders") {
      const items: RiderItem[] = preset.config?.riderItems || [];

      setRiderItems(items);
      setRiderModalVisible(true);
      setEditingPresetId(preset.id);
    } else {
      setStageModalVisible(true);
      setEditingPresetId(preset.id);
    }
  };

  const handleUsePreset = (preset: Preset) => {
    if (selectMode && onSelect) onSelect(preset);
    else {
      setSelectedPreset(preset);
      setSelectEventModalVisible(true);
      setEventSearch("");
    }
  };

  const handleAttachToEvent = async (eventId: string) => {
    if (!selectedPreset) return;

    try {
      const presetToUse = presets.find((p) => p.id === selectedPreset.id);
      if (!presetToUse) {
        Alert.alert("Error", "Could not find the full preset in memory.");
        return;
      }

      const event = events.find((e) => e.id === eventId);
      if (!event) return;

      await attachPresetToEvent(eventId, presetToUse.id, presetToUse.type);

      if (presetToUse.type === "stageplans") {
        event.stagePlanPresetId = presetToUse.id;
        event.stageIcons = JSON.parse(
          JSON.stringify(presetToUse.stageIcons || []),
        );
      } else if (presetToUse.type === "riders") {
        event.riderPresetId = presetToUse.id;

        const fullRiderItems: RiderItem[] = Array.isArray(
          presetToUse.config?.riderItems,
        )
          ? JSON.parse(JSON.stringify(presetToUse.config.riderItems))
          : [];

        const expandAll = (items: RiderItem[]): RiderItem[] =>
          items.map((i) => ({
            ...i,
            expanded: true,
            children: i.children ? expandAll(i.children) : [],
          }));

        event.requirements = expandAll(fullRiderItems);
      }

      setSelectEventModalVisible(false);
    } catch (err) {
      console.error("Error attaching preset:", err);
      Alert.alert("Error", "Failed to attach full preset to event.");
    }
  };

  const renderPreset = ({ item }: { item: Preset }) => {
    const isEditingName = editingPresetId === item.id;
    const cardContent = (
      <>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {isEditingName ? (
            <TextInput
              ref={nameInputRef}
              value={item.name}
              onChangeText={(text) =>
                setPresets((prev) =>
                  prev.map((p) =>
                    p.id === item.id ? { ...p, name: text } : p,
                  ),
                )
              }
              onBlur={() => savePresetName(item.id, item.name)}
              placeholder="Preset Name"
              placeholderTextColor={colors.placeholder_gray}
              style={[styles.cardTitle, { flex: 1 }]}
            />
          ) : (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flex: 1,
                justifyContent: "space-between",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  flexShrink: 1,
                }}
              >
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name || "Unnamed Preset"}
                </Text>
                {!selectMode && (
                  <TouchableOpacity
                    onPress={() => handleStartEditingName(item.id)}
                    style={{
                      paddingHorizontal: 4,
                      paddingVertical: 2,
                      marginLeft: 6,
                    }}
                  >
                    <Ionicons
                      name="pencil-outline"
                      size={18}
                      color={colors.text_primary}
                    />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                onPress={() => handleDeletePreset(item.id)}
                style={{
                  paddingHorizontal: 4,
                  paddingVertical: 2,
                  marginLeft: 8,
                }}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={colors.primary || "#D9534F"}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.cardDetails}>{item.details}</Text>

        <View style={styles.actions}>
          {selectMode ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleUsePreset(item)}
            >
              <Text style={styles.actionText}>Select</Text>
            </TouchableOpacity>
          ) : item.type === "stageplans" ? (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleUsePreset(item)}
              >
                <Text style={styles.actionText}>Choose Event</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setSelectedPreset(item);
                  setStagePreviewVisible(true);
                }}
              >
                <Text style={styles.actionText}>Preview</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleUsePreset(item)}
            >
              <Text style={styles.actionText}>Choose Event</Text>
            </TouchableOpacity>
          )}
        </View>
      </>
    );

    if (selectMode) {
      return <View style={styles.card}>{cardContent}</View>;
    }

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => handleEditPreset(item)}
      >
        {cardContent}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {selectMode && onClose ? (
          <TouchableOpacity onPress={onClose} style={styles.headerButtonArea}>
            <Ionicons
              name={
                Platform.OS === "ios"
                  ? "close-circle-outline"
                  : "arrow-back-outline"
              }
              size={30}
              color={colors.text_primary}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButtonArea} />
        )}

        <Text
          style={[styles.title, selectMode && { flex: 1, textAlign: "center" }]}
        >
          Presets
        </Text>

        {!selectMode ? (
          <TouchableOpacity
            onPress={handleAddPreset}
            style={styles.headerButtonArea}
          >
            <Ionicons name="add-outline" size={26} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButtonArea} />
        )}
      </View>

      {!selectMode && (
        <View style={styles.searchRow}>
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.placeholder_gray}
          />
          <TextInput
            placeholder="Search presets..."
            placeholderTextColor={colors.placeholder_gray}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      )}

      {!selectMode && (
        <View style={styles.tabs}>
          <TouchableOpacity
            onPress={() => setActiveTab("riders")}
            style={[styles.tab, activeTab === "riders" && styles.tabActive]}
          >
            <Text style={styles.tabText}>Riders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("stageplans")}
            style={[styles.tab, activeTab === "stageplans" && styles.tabActive]}
          >
            <Text style={styles.tabText}>Stageplans</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredPresets}
        keyExtractor={(item) => item.id}
        renderItem={renderPreset}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No {activeTab} presets yet.</Text>
        }
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      <Modal
        visible={selectEventModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setRiderModalVisible(false);
          exitEditingPreset();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity
              onPress={() => setSelectEventModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons
                name={
                  Platform.OS === "ios"
                    ? "chevron-back-outline"
                    : "close-outline"
                }
                size={28}
                color={colors.text_primary}
                paddingLeft={5}
              />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {'Apply "'}
              {selectedPreset?.name}
              {'" to Event'}
            </Text>
            <TextInput
              placeholder="Search event..."
              placeholderTextColor={colors.background_main}
              style={styles.modalSearchInput}
              value={eventSearch}
              onChangeText={setEventSearch}
            />
            <FlatList
              data={filteredEvents}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.eventRow}
                  onPress={() => handleAttachToEvent(item.id)}
                >
                  <Text style={styles.eventName}>{item.eventName}</Text>
                  <Text style={styles.eventDate}>
                    {new Date(item.date).toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: Dimensions.get("window").height * 0.4 }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No events found.</Text>
              }
            />
            <TouchableOpacity
              onPress={() => setSelectEventModalVisible(false)}
              style={styles.closeModalButton}
            >
              <Text style={styles.closeModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {riderModalVisible && editingPresetId && (
        <Modal
          visible={riderModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setRiderModalVisible(false)}
        >
          <RiderScreen
            initialItems={riderItems}
            onSave={(updatedItems) => {
              const preset = presets.find((p) => p.id === editingPresetId);
              if (!preset) return;

              const clonedItems = JSON.parse(JSON.stringify(updatedItems));

              const updatedPreset = {
                ...preset,
                config: { ...preset.config, riderItems: clonedItems },
                details: clonedItems.length
                  ? clonedItems
                      .map((i: RiderItem) => i.text)
                      .slice(0, 3)
                      .join(", ") + (clonedItems.length > 3 ? "..." : "")
                  : "Empty",
              };

              savePreset(updatedPreset);
              setRiderItems(clonedItems);
              setRiderModalVisible(false);
              exitEditingPreset();
            }}
          />
        </Modal>
      )}

      {editingPresetId &&
        presets.find((p) => p.id === editingPresetId)?.type === "stageplans" &&
        stageModalVisible && (
          <StagePlanModal
            visible={stageModalVisible}
            mode="preset"
            event={{
              id: `preset-${editingPresetId}`,
              eventName:
                presets.find((p) => p.id === editingPresetId)?.name || "",
              stageIcons:
                presets.find((p) => p.id === editingPresetId)?.stageIcons || [],
              stageLayout: { x: 0, y: 0, width: 595, height: 842 },
              requirements: [],
              date: new Date(),
              venue: "",
              profileId: "Default Profile",
            }}
            onClose={() => {
              setStageModalVisible(false);
              exitEditingPreset();
            }}
            onSave={async (updatedEvent) => {
              const preset = presets.find((p) => p.id === editingPresetId);
              if (!preset) return;
              const updatedPreset: Preset = {
                ...preset,
                details: `Stage with ${updatedEvent.stageIcons?.length} icons`,
                stageIcons: updatedEvent.stageIcons,
              };
              await savePreset(updatedPreset);
              setStageModalVisible(false);
              exitEditingPreset();
            }}
            onReturnToEdit={undefined}
          />
        )}

      {stagePreviewVisible && selectedPreset && (
        <Modal visible={stagePreviewVisible} transparent animationType="fade">
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.8)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: "95%",
                aspectRatio: 595 / 842,
                backgroundColor: colors.text_on_color,
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {selectedPreset.stageIcons?.map((icon) => {
                const resolvedSource = resolveIconSource(icon);
                if (!resolvedSource) return null;

                const containerWidth = Dimensions.get("window").width * 0.95;
                const containerHeight = containerWidth * (842 / 595);

                const normalizedWidth =
                  icon.width ??
                  DEFAULT_WRAPPER_SIZE / DEFAULT_STAGE_LAYOUT_WIDTH;

                const normalizedHeight =
                  icon.height ??
                  DEFAULT_WRAPPER_SIZE / DEFAULT_STAGE_LAYOUT_HEIGHT;

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
              onPress={() => setStagePreviewVisible(false)}
              style={{
                marginTop: 20,
                padding: 10,
                backgroundColor: colors.primary,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  color: colors.text_on_color,
                  fontWeight: "bold",
                  fontSize: 16,
                }}
              >
                Close Preview
              </Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background_main },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      paddingTop:
        (Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0) +
        EXTRA_TOP_PADDING,
    },
    title: { color: colors.text_primary, fontSize: 28, fontWeight: "bold" },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background_secondary,
      marginHorizontal: 20,
      borderWidth: 1,
      borderRadius: 12,
      borderColor: "gray",
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    searchInput: { flex: 1, color: colors.text_primary, paddingVertical: 8 },
    tabs: {
      flexDirection: "row",
      justifyContent: "center",
      borderBottomWidth: 1,
      borderBottomColor: colors.border_color,
      marginBottom: 12,
      marginHorizontal: 20,
    },
    tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabText: { color: colors.text_primary, fontSize: 16, fontWeight: "600" },
    card: {
      marginHorizontal: 20,
      marginVertical: 6,
      backgroundColor: colors.card_background || colors.background_secondary,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border_color,
    },
    cardTitle: { color: colors.text_primary, fontSize: 18, fontWeight: "bold" },
    cardDetails: { color: colors.placeholder_gray, fontSize: 14, marginTop: 4 },
    actions: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 12,
    },
    actionButton: {
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderRadius: 8,
      paddingLeft: 0,
    },
    actionText: { color: colors.primary, fontSize: 14 },
    emptyText: {
      color: colors.placeholder_gray,
      textAlign: "center",
      marginTop: 20,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContainer: {
      width: "85%",
      backgroundColor: colors.background_main,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border_color,
      paddingTop: 55,
    },
    modalCloseButton: {
      position: "absolute",
      top: 15,
      left: 15,
      zIndex: 1,
      padding: 5,
    },
    modalTitle: {
      color: colors.text_primary,
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 16,
    },
    modalSearchInput: {
      borderWidth: 1,
      borderColor: colors.border_color,
      borderRadius: 10,
      padding: 10,
      marginBottom: 12,
      color: colors.text_primary,
      backgroundColor: colors.background_secondary,
    },
    eventRow: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border_color,
    },
    eventName: { color: colors.text_primary, fontSize: 16, fontWeight: "500" },
    eventDate: { color: colors.placeholder_gray, fontSize: 12, marginTop: 2 },
    closeModalButton: {
      marginTop: 16,
      backgroundColor: colors.primary,
      borderRadius: 10,
      alignItems: "center",
      paddingVertical: 12,
    },
    closeModalText: {
      color: colors.text_on_color,
      fontWeight: "bold",
      fontSize: 16,
    },
    headerButtonArea: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
  });
