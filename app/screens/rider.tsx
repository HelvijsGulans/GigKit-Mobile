import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/themeContext";

export type RiderItem = {
  id: string;
  text: string;
  children: RiderItem[];
  expanded?: boolean;
  isEditing?: boolean;
};

type RiderScreenProps = {
  initialItems?: RiderItem[];
  onSave: (items: RiderItem[]) => void;
};

export default function RiderScreen({
  initialItems = [],
  onSave,
}: RiderScreenProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [items, setItems] = useState<RiderItem[]>(initialItems);
  const [newItemText, setNewItemText] = useState("");

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const addItem = () => {
    if (!newItemText.trim()) return;
    const newItem: RiderItem = {
      id: Date.now().toString(),
      text: newItemText,
      children: [],
      expanded: true,
      isEditing: false,
    };
    setItems((prev) => [newItem, ...prev]);
    setNewItemText("");
  };

  const toggleExpand = (id: string, list: RiderItem[]): RiderItem[] =>
    list.map((item) =>
      item.id === id
        ? { ...item, expanded: !item.expanded }
        : { ...item, children: toggleExpand(id, item.children) },
    );

  const addChild = (parentId: string) => {
    const addRecursive = (list: RiderItem[]): RiderItem[] =>
      list.map((item) =>
        item.id === parentId
          ? {
              ...item,
              expanded: true,
              children: [
                {
                  id: Date.now().toString(),
                  text: "",
                  children: [],
                  isEditing: true,
                },
                ...item.children,
              ],
            }
          : { ...item, children: addRecursive(item.children) },
      );
    setItems(addRecursive(items));
  };

  const addSibling = (siblingId: string) => {
    const addRecursive = (list: RiderItem[]): RiderItem[] => {
      const index = list.findIndex((item) => item.id === siblingId);

      if (index !== -1) {
        const newItem: RiderItem = {
          id: Date.now().toString(),
          text: "",
          children: [],
          expanded: true,
          isEditing: true,
        };

        const newList = [...list];
        newList[index] = { ...newList[index], isEditing: false };
        newList.splice(index + 1, 0, newItem);

        return newList;
      }

      return list.map((item) => ({
        ...item,
        children: addRecursive(item.children),
      }));
    };

    setItems(addRecursive(items));
  };

  const updateItemText = (
    id: string,
    newText: string,
    list: RiderItem[],
  ): RiderItem[] =>
    list.map((item) =>
      item.id === id
        ? { ...item, text: newText }
        : { ...item, children: updateItemText(id, newText, item.children) },
    );

  const setItemEditing = (
    id: string,
    editing: boolean,
    list: RiderItem[],
  ): RiderItem[] =>
    list.map((item) =>
      item.id === id
        ? { ...item, isEditing: editing }
        : { ...item, children: setItemEditing(id, editing, item.children) },
    );

  const deleteItem = (id: string, list: RiderItem[]): RiderItem[] =>
    list
      .filter((item) => item.id !== id)
      .map((item) => ({ ...item, children: deleteItem(id, item.children) }));

  const renderItem = (item: RiderItem, depth = 0) => (
    <RiderItemComponent
      key={item.id}
      item={item}
      depth={depth}
      addChild={addChild}
      addSibling={addSibling}
      toggleExpand={toggleExpand}
      updateItemText={updateItemText}
      setItemEditing={setItemEditing}
      deleteItem={deleteItem}
      setItems={setItems}
      items={items}
      colors={colors}
      styles={styles}
    />
  );

  const removeEditingFlags = (list: RiderItem[]): RiderItem[] =>
    list.map((item) => ({
      ...item,
      isEditing: false,
      children: removeEditingFlags(item.children || []),
    }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background_main }}>
      <View style={styles.container}>
        <Text style={styles.header}>Rider</Text>

        <View style={styles.addRow}>
          <TextInput
            value={newItemText}
            onChangeText={setNewItemText}
            placeholder="Add item..."
            placeholderTextColor={colors.placeholder_gray}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={addItem}
            submitBehavior="submit"
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={addItem}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={items}
          renderItem={({ item }) => renderItem(item)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        />

        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => {
            const cleaned = removeEditingFlags(items);
            onSave(cleaned);
          }}
        >
          <Text style={styles.saveButtonText}>Save Rider</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function RiderItemComponent({
  item,
  depth,
  addChild,
  addSibling,
  toggleExpand,
  updateItemText,
  setItemEditing,
  deleteItem,
  setItems,
  items,
  colors,
  styles,
}: any) {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (item.isEditing && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [item.isEditing]);

  const isChild = depth > 0;

  return (
    <View
      style={[
        depth === 0 ? styles.itemContainer : styles.childItemContainer,
        {
          marginLeft: depth * 14,
          backgroundColor:
            depth === 0 ? colors.card : colors.card_secondary || colors.card,
        },
      ]}
    >
      <View style={depth === 0 ? styles.itemRow : styles.childItemRow}>
        {!isChild && (
          <TouchableOpacity
            style={styles.iconButtonLarge}
            onPress={() => setItems(toggleExpand(item.id, items))}
            activeOpacity={0.7}
          >
            <Ionicons
              name={item.expanded ? "chevron-down" : "chevron-forward"}
              size={22}
              color={colors.text_primary}
            />
          </TouchableOpacity>
        )}

        {item.isEditing ? (
          <TextInput
            ref={inputRef}
            style={[
              depth === 0 ? styles.inlineInput : styles.childInlineInput,
              { backgroundColor: "transparent", color: colors.text_primary },
            ]}
            placeholder="Type here..."
            placeholderTextColor={colors.placeholder_gray}
            value={item.text}
            onChangeText={(txt) =>
              setItems(updateItemText(item.id, txt, items))
            }
            returnKeyType="next"
            blurOnSubmit={false}
            submitBehavior="submit"
            onSubmitEditing={() => {
              addSibling(item.id);
            }}
          />
        ) : (
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={0.6}
            onPress={() => setItems(setItemEditing(item.id, true, items))}
          >
            <Text style={depth === 0 ? styles.itemText : styles.childText}>
              {item.text}
            </Text>
          </TouchableOpacity>
        )}

        {!isChild && (
          <TouchableOpacity
            style={styles.iconButtonLarge}
            onPress={() => addChild(item.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={22} color={colors.text_primary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.iconButtonLarge}
          onPress={() => setItems(deleteItem(item.id, items))}
          activeOpacity={0.7}
        >
          <Ionicons
            name="trash"
            size={depth === 0 ? 22 : 20}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      {item.expanded &&
        item.children.map((child: RiderItem) => (
          <RiderItemComponent
            key={child.id}
            item={child}
            depth={depth + 1}
            addChild={addChild}
            addSibling={addSibling}
            toggleExpand={toggleExpand}
            updateItemText={updateItemText}
            setItemEditing={setItemEditing}
            deleteItem={deleteItem}
            setItems={setItems}
            items={items}
            colors={colors}
            styles={styles}
          />
        ))}
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === "android" ? 20 : 0,
      paddingTop: 10,
    },
    header: {
      fontSize: 28,
      fontWeight: "bold",
      color: colors.text_primary,
      marginBottom: 10,
    },
    addRow: {
      flexDirection: "row",
      marginBottom: 20,
    },
    input: {
      backgroundColor: colors.background_main,
      color: colors.text_primary,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      flex: 1,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border_color,
    },
    addButton: {
      backgroundColor: colors.primary,
      marginLeft: 10,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    addButtonText: {
      fontSize: 22,
      color: colors.text_on_color,
    },
    itemContainer: {
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border_color,
      marginBottom: 5,
      marginTop: 10,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 40,
    },

    itemText: {
      flex: 1,
      fontSize: 16,
      color: colors.text_primary,
      paddingVertical: 4,
      paddingHorizontal: 6,
      textAlignVertical: "center",
      includeFontPadding: false,
    },
    inlineInput: {
      flex: 1,
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderRadius: 6,
      fontSize: 16,
      textAlignVertical: "center",
      includeFontPadding: false,
    },
    childItemContainer: {
      padding: 4,
      paddingLeft: 15,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border_color,
      marginBottom: 4,
      marginTop: 4,
      marginHorizontal: 10,
    },
    childItemRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 2,
      minHeight: 30,
    },

    childText: {
      flex: 1,
      fontSize: 14,
      color: colors.text_primary,
      paddingVertical: 2,
      paddingHorizontal: 4,
      textAlignVertical: "center",
      includeFontPadding: false,
    },
    childInlineInput: {
      flex: 1,
      paddingVertical: 2,
      paddingHorizontal: 4,
      borderRadius: 4,
      fontSize: 14,
      textAlignVertical: "center",
      includeFontPadding: false,
    },
    iconButtonLarge: {
      padding: 8,
      marginHorizontal: 4,
      justifyContent: "center",
      alignItems: "center",
    },
    saveButton: {
      backgroundColor: colors.primary,
      marginTop: 10,
      padding: 14,
      borderRadius: 10,
      alignItems: "center",
    },
    saveButtonText: {
      color: colors.text_on_color,
      fontWeight: "bold",
      fontSize: 16,
    },
  });
