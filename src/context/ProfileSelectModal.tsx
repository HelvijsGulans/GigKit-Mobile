import { useProfile } from "@/src/context/profileContext";
import { useTheme } from "@/src/context/themeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { height } = Dimensions.get("window");

type ProfileSelectProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (profileName: string) => void;
  currentProfileId: string;
  profiles: string[];
};

export default function ProfileSelectModal({
  visible,
  onClose,
  onSelect,
  currentProfileId,
  profiles,
}: ProfileSelectProps) {
  const { colors } = useTheme();
  const { getProfileColor } = useProfile();
  const styles = getStyles(colors);

  const handleSelect = (profileName: string) => {
    onSelect(profileName);
    onClose();
  };

  const renderProfileItem = ({ item: profileName }: { item: string }) => {
    const isSelected = profileName === currentProfileId;
    const profileColor = getProfileColor(profileName) || colors.primary;

    return (
      <TouchableOpacity
        style={[
          styles.profileItem,
          {
            backgroundColor: isSelected ? profileColor : colors.background_main,
            borderColor: profileColor,
          },
        ]}
        onPress={() => handleSelect(profileName)}
        key={profileName}
      >
        <Text
          style={[
            styles.profileItemText,
            {
              color: isSelected ? colors.text_on_color : profileColor,
              fontWeight: isSelected ? "bold" : "normal",
            },
          ]}
        >
          {profileName}
        </Text>
        {isSelected && (
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={colors.text_on_color}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackground}>
        <View style={[styles.modalContainer, { maxHeight: height * 0.7 }]}>
          <Text style={styles.modalTitle}>Select Profile for Event</Text>
          <FlatList
            data={profiles}
            keyExtractor={(item) => item}
            renderItem={renderProfileItem}
          />
          <TouchableOpacity style={styles.modalActionButton} onPress={onClose}>
            <Text style={styles.modalActionText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    modalBackground: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      padding: 20,
    },
    modalContainer: {
      backgroundColor: colors.background_main,
      borderRadius: 12,
      padding: 20,
    },
    modalTitle: {
      fontWeight: "bold",
      fontSize: 20,
      marginBottom: 20,
      color: colors.text_primary,
      textAlign: "center",
    },
    profileItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 8,
    },
    profileItemText: {
      fontSize: 16,
    },
    modalActionButton: {
      backgroundColor: colors.background_secondary,
      borderRadius: 12,
      paddingVertical: 12,
      marginTop: 16,
      alignItems: "center",
    },
    modalActionText: {
      fontSize: 16,
      color: colors.text_primary,
      fontWeight: "bold",
    },
  });
