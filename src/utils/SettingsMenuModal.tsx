// src/utils/SettingsMenuModal.tsx
import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
} from "react-native";
import { useTheme } from "@/src/context/themeContext";
import { useExportSettings, Person } from "@/src/context/exportSettingsContext";
import Icon from "react-native-vector-icons/Ionicons";

interface SettingsMenuModalProps {
  isVisible: boolean;
  onClose: () => void;
  onWipeEvents?: () => void;
}

export default function SettingsMenuModal({
  isVisible,
  onClose,
  onWipeEvents,
}: SettingsMenuModalProps) {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"general" | "export">("general");

  return (
    <Modal
      animationType="slide"
      transparent
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.background_main,
              borderColor: colors.border_color,
            },
          ]}
        >
          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === "general" && {
                  borderBottomColor: colors.primary,
                },
              ]}
              onPress={() => setActiveTab("general")}
            >
              <Text style={[styles.tabText, { color: colors.text_primary }]}>
                General
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === "export" && { borderBottomColor: colors.primary },
              ]}
              onPress={() => setActiveTab("export")}
            >
              <Text style={[styles.tabText, { color: colors.text_primary }]}>
                Export
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={{ paddingTop: 10, maxHeight: 400 }}>
            {activeTab === "general" && (
              <View>
                {/* Light Mode Switch */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border_color,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ fontSize: 16, color: colors.text_primary }}>
                    Light Mode
                  </Text>
                  <Switch
                    value={!isDarkMode}
                    onValueChange={toggleTheme}
                    trackColor={{
                      false: colors.placeholder_gray,
                      true: colors.primary,
                    }}
                    thumbColor={colors.text_on_color}
                    ios_backgroundColor={colors.placeholder_gray}
                  />
                </View>

                {/* Wipe All Local Data */}
                <TouchableOpacity
                  style={[
                    styles.menuButton,
                    { borderColor: colors.border_color },
                  ]}
                  onPress={() => onWipeEvents && onWipeEvents()}
                >
                  <Text style={[styles.menuText, { color: "red" }]}>
                    Wipe All Local Data
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === "export" && <ExportSettingsPanel />}
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[
              styles.closeButton,
              { borderColor: colors.primary, backgroundColor: colors.primary },
            ]}
            onPress={onClose}
          >
            <Text style={[styles.closeText, { color: colors.text_on_color }]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* Export Settings Panel */
function ExportSettingsPanel() {
  const { colors } = useTheme();
  const {
    exportSettings,
    setExportSettings,
    people,
    addPerson,
    updatePerson,
    deletePerson,
  } = useExportSettings();

  const [editing, setEditing] = useState<null | {
    mode: "add" | "edit";
    person?: Person;
  }>(null);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");

  const startAdd = () => {
    setFormName("");
    setFormRole("");
    setFormEmail("");
    setFormPhone("");
    setEditing({ mode: "add" });
  };

  const startEdit = (person: Person) => {
    setFormName(person.name);
    setFormRole(person.role ?? "");
    setFormEmail(person.email ?? "");
    setFormPhone(person.phone ?? "");
    setEditing({ mode: "edit", person });
  };

  const save = async () => {
    if (!formName.trim()) return Alert.alert("Validation", "Name is required.");
    if (editing?.mode === "add") {
      await addPerson({
        name: formName.trim(),
        role: formRole.trim() || undefined,
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
      });
    } else if (editing?.mode === "edit" && editing.person) {
      await updatePerson(editing.person.id, {
        name: formName.trim(),
        role: formRole.trim() || undefined,
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
      });
    }
    setEditing(null);
  };

  const confirmDelete = (p: Person) => {
    Alert.alert("Delete contact", `Delete ${p.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => await deletePerson(p.id),
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
      {/* Contacts Section */}
      <Text
        style={[
          styles.sectionTitle,
          { color: colors.text_primary, alignSelf: "center" },
        ]}
      >
        Contacts
      </Text>

      {people.length === 0 && (
        <Text style={{ color: colors.placeholder_gray, marginBottom: 10 }}>
          No saved contacts yet.
        </Text>
      )}

      {/* People List with dividers */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border_color,
          borderBottomWidth: 1,
          borderBottomColor: colors.border_color,
        }}
      >
        {people.map((item, idx) => (
          <View key={item.id}>
            <View style={[styles.personRow, { paddingVertical: 12 }]}>
              <TouchableOpacity
                onPress={() =>
                  updatePerson(item.id, { selected: !item.selected })
                }
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: item.selected
                    ? colors.primary
                    : colors.border_color,
                  backgroundColor: item.selected
                    ? colors.primary
                    : "transparent",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 10,
                }}
              >
                {item.selected && (
                  <Icon
                    name="checkmark"
                    size={14}
                    color={colors.text_on_color}
                  />
                )}
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text_primary, fontWeight: "600" }}>
                  {item.name}
                </Text>
                {!!item.role && (
                  <Text
                    style={{ color: colors.placeholder_gray, fontSize: 12 }}
                  >
                    {item.role}
                  </Text>
                )}
                {!!(item.phone || item.email) && (
                  <Text
                    style={{ color: colors.placeholder_gray, fontSize: 12 }}
                  >
                    {item.phone}
                    {!!item.phone && !!item.email && " | "}
                    {item.email}
                  </Text>
                )}
              </View>

              <View style={{ flexDirection: "row", marginLeft: 8 }}>
                <TouchableOpacity
                  onPress={() => startEdit(item)}
                  style={{ padding: 6 }}
                >
                  <Icon
                    name="pencil-outline"
                    size={18}
                    color={colors.text_on_color}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDelete(item)}
                  style={{ padding: 6 }}
                >
                  <Icon name="trash-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider between people */}
            {idx < people.length - 1 && (
              <View
                style={{ height: 1, backgroundColor: colors.border_color }}
              />
            )}
          </View>
        ))}
      </View>

      {/* Add Person Button / Edit Form */}
      {editing ? (
        <View style={{ marginTop: 12 }}>
          <TextInput
            placeholder="Name"
            placeholderTextColor={colors.placeholder_gray}
            value={formName}
            onChangeText={setFormName}
            style={[
              styles.input,
              { borderColor: colors.border_color, color: colors.text_primary },
            ]}
          />
          <TextInput
            placeholder="Role (e.g. Tour Manager)"
            placeholderTextColor={colors.placeholder_gray}
            value={formRole}
            onChangeText={setFormRole}
            style={[
              styles.input,
              { borderColor: colors.border_color, color: colors.text_primary },
            ]}
          />
          <TextInput
            placeholder="Phone"
            placeholderTextColor={colors.placeholder_gray}
            value={formPhone}
            onChangeText={setFormPhone}
            style={[
              styles.input,
              { borderColor: colors.border_color, color: colors.text_primary },
            ]}
          />
          <TextInput
            placeholder="Email"
            placeholderTextColor={colors.placeholder_gray}
            value={formEmail}
            onChangeText={setFormEmail}
            keyboardType="email-address"
            style={[
              styles.input,
              { borderColor: colors.border_color, color: colors.text_primary },
            ]}
          />

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <TouchableOpacity
              style={[
                styles.smallButton,
                { borderColor: colors.border_color, width: "30%" },
              ]}
              onPress={() => setEditing(null)}
            >
              <Text style={{ color: colors.text_primary }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.smallButton,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                  width: "30%",
                },
              ]}
              onPress={save}
            >
              <Text style={{ color: colors.text_on_color }}>
                {editing.mode === "add" ? "Add" : "Save"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.smallButton,
            {
              backgroundColor: colors.primary,
              marginTop: 12,
              borderColor: colors.primary,
            },
          ]}
          onPress={startAdd}
        >
          <Text style={{ color: colors.text_on_color }}>Add Person</Text>
        </TouchableOpacity>
      )}

      {/* Contact Position */}
      <Text
        style={{
          color: colors.text_primary,
          fontSize: 12,
          marginBottom: 6,
          marginTop: 18,
        }}
      >
        Contact position:
      </Text>
      <View style={{ flexDirection: "row", marginBottom: 15 }}>
        {(["top-left", "under-title", "bottom"] as const).map((pos) => (
          <TouchableOpacity
            key={pos}
            onPress={() => setExportSettings({ contactPosition: pos })}
            style={[
              styles.posButton,
              exportSettings.contactPosition === pos && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
              { marginRight: 8 },
            ]}
          >
            <Text
              style={{
                color:
                  exportSettings.contactPosition === pos
                    ? colors.text_on_color
                    : colors.text_primary,
                fontSize: 12,
              }}
            >
              {pos === "top-left"
                ? "Top-left"
                : pos === "under-title"
                  ? "Under title"
                  : "Bottom"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Divider */}
      <View
        style={{
          height: 1,
          backgroundColor: colors.border_color,
          marginBottom: 15,
        }}
      />

      {/* Export Options */}
      <Text
        style={[
          styles.sectionTitle,
          { color: colors.text_primary, alignSelf: "center" },
        ]}
      >
        Options
      </Text>
      <View style={{ marginTop: 6 }}>
        <ToggleRow
          label="Include contacts in PDF"
          value={exportSettings.showContacts}
          onToggle={() =>
            setExportSettings({ showContacts: !exportSettings.showContacts })
          }
        />
        <ToggleRow
          label='Show "Technical Rider" title'
          value={exportSettings.showTechnicalHeader}
          onToggle={() =>
            setExportSettings({
              showTechnicalHeader: !exportSettings.showTechnicalHeader,
            })
          }
        />
        <ToggleRow
          label="Show GigKit watermark"
          value={exportSettings.showBrand}
          onToggle={() =>
            setExportSettings({ showBrand: !exportSettings.showBrand })
          }
        />
        <ToggleRow
          label="Show Event Date"
          value={exportSettings.showDate}
          onToggle={() =>
            setExportSettings({ showDate: !exportSettings.showDate })
          }
        />
      </View>
    </ScrollView>
  );
}

/* ToggleRow Component */
function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: colors.text_primary }}>{label}</Text>
      <View
        style={{
          width: 56,
          height: 30,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border_color,
          backgroundColor: value ? colors.primary : "transparent",
          justifyContent: "center",
          padding: 4,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: value
              ? colors.text_on_color
              : colors.placeholder_gray,
            alignSelf: value ? "flex-end" : "flex-start",
          }}
        />
      </View>
    </TouchableOpacity>
  );
}

/* Styles */
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: { width: "88%", borderWidth: 1, borderRadius: 12, padding: 14 },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ccc",
    marginBottom: 8,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 15, fontWeight: "600" },
  closeButton: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  closeText: { fontSize: 16 },
  menuButton: { paddingVertical: 12 },
  menuText: { fontSize: 16, fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  input: {
    width: "100%",
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  smallButton: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  posButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#888",
  },
  personRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
});
