import React, { FC } from "react";
import {
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useTheme } from "@/src/context/themeContext";

const { width, height } = Dimensions.get("window");

interface EmptyDayModalProps {
  isVisible: boolean;
  onClose: () => void;
  onCreateEvent: () => void;
  selectedDate: Date | null;
}

const EmptyDayModal: FC<EmptyDayModalProps> = ({
  isVisible,
  onClose,
  onCreateEvent,
  selectedDate,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <Modal visible={isVisible} transparent animationType="none">
      <TouchableOpacity
        style={styles.modalBackground}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.simpleCloseButton} onPress={onClose}>
            <Icon name="close" size={24} color={colors.text_primary} />
          </TouchableOpacity>

          <Text style={styles.title}>
            {selectedDate ? selectedDate.toDateString() : ""}
          </Text>
          <Text style={styles.message}>No events on this day</Text>

          <TouchableOpacity style={styles.createButton} onPress={onCreateEvent}>
            <Text style={styles.createButtonText}>Create Event</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const getStyles = (colors: any) =>
  StyleSheet.create({
    modalBackground: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContainer: {
      backgroundColor: colors.background_main,
      width: "85%",
      maxWidth: 350,
      padding: 20,
      borderRadius: 16,
      alignItems: "center",
      position: "relative",
    },
    simpleCloseButton: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text_primary,
      marginBottom: 10,
    },
    message: {
      fontSize: 16,
      color: colors.placeholder_gray,
      marginBottom: 20,
      textAlign: "center",
    },
    createButton: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 25,
      borderRadius: 10,
    },
    createButtonText: {
      color: colors.text_on_color,
      fontSize: 16,
      fontWeight: "600",
    },
  });

export default EmptyDayModal;
