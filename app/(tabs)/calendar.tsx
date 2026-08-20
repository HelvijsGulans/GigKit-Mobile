import { eventsContext } from "@/src/context/eventsContext";
import { useProfile } from "@/src/context/profileContext";
import EditEventModal from "@/src/utils/editEventModal";
import EmptyDayModal from "@/src/utils/emptyDayModal";
import EventsOfDayModal from "@/src/utils/eventsOfDayModal";
import { Event } from "@/src/utils/ridersHelpers";
import { useFocusEffect } from "@react-navigation/native";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import React, {
  FC,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
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
import PagerView from "react-native-pager-view";
import Icon from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../src/context/themeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const LIST_ITEM_HEIGHT = 36;

const CalendarScreen: FC = () => {
  const { events, deleteEvent, updateEvent, addEvent } =
    useContext(eventsContext);
  const { colors } = useTheme();
  const { getProfileColor } = useProfile();

  const [currentDate, setCurrentDate] = useState(new Date());
  const pagerRef = useRef<PagerView>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [emptyDayModalVisible, setEmptyDayModalVisible] = useState(false);
  const [emptySelectedDate, setEmptySelectedDate] = useState<Date | null>(null);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const ignorePageEventRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setCurrentDate(new Date());
    }, []),
  );

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const currentYearNum = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 31 }, (_, i) => currentYearNum - 15 + i),
    [currentYearNum],
  );
  const [tempMonth, setTempMonth] = useState(currentDate.getMonth());
  const [tempYear, setTempYear] = useState(currentDate.getFullYear());
  const monthsListRef = useRef<FlatList<string>>(null);
  const yearsListRef = useRef<FlatList<number>>(null);

  const getCalendarDays = (date: Date) => {
    const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();

    events.forEach((event) => {
      if (!event.profileId) return;

      const key = format(new Date(event.date), "yyyy-MM-dd");

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)!.push(event);
    });

    return map;
  }, [events]);
  const renderMonthGrid = useCallback(
    (gridDate: Date) => {
      const days = getCalendarDays(gridDate);

      return (
        <View style={[styles.grid, { width: SCREEN_WIDTH }]}>
          {days.map((day, i) => {
            const inThisMonth = isSameMonth(day, gridDate);
            const isToday = isSameDay(day, new Date());

            const key = format(day, "yyyy-MM-dd");
            const eventsForDay = eventsByDate.get(key) || [];

            return (
              <TouchableOpacity
                key={`${gridDate.toISOString()}-${i}`}
                style={[
                  styles.dayBox,
                  !inThisMonth && styles.outsideMonth,
                  { borderColor: colors.border_color },
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  if (eventsForDay.length > 0) {
                    setSelectedDate(day);
                    setSelectedEvents(eventsForDay);
                    setModalVisible(true);
                  } else {
                    setEmptySelectedDate(day);
                    setEmptyDayModalVisible(true);
                  }
                }}
              >
                <View
                  style={[
                    styles.dateWrapper,
                    isToday && {
                      backgroundColor: colors.primary,
                      borderRadius: 15,
                      width: 30,
                      height: 30,
                      justifyContent: "center",
                      alignItems: "center",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      {
                        color: isToday
                          ? colors.text_on_color
                          : colors.text_primary,
                      },
                    ]}
                  >
                    {format(day, "d")}
                  </Text>
                </View>
                {eventsForDay.map((event, idx) => (
                  <Text
                    key={`${event.id}-${idx}`}
                    style={[
                      styles.eventText,
                      {
                        backgroundColor: getProfileColor(event.profileId!),
                        color: colors.text_on_color,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {event.eventName}
                  </Text>
                ))}
              </TouchableOpacity>
            );
          })}
        </View>
      );
    },
    [events, colors, getProfileColor],
  );

  const openMonthYearPicker = () => {
    setTempMonth(currentDate.getMonth());
    setTempYear(currentDate.getFullYear());
    setMonthPickerVisible(true);
    requestAnimationFrame(() => {
      monthsListRef.current?.scrollToIndex({
        index: currentDate.getMonth(),
        animated: false,
      });
      const yIndex = years.findIndex((y) => y === currentDate.getFullYear());
      if (yIndex >= 0)
        yearsListRef.current?.scrollToIndex({ index: yIndex, animated: false });
    });
  };
  const handlePageSelected = (e: any) => {
    const index = e.nativeEvent.position;

    if (index === 1) return;

    setCurrentDate((prev) =>
      index === 0 ? subMonths(prev, 1) : addMonths(prev, 1),
    );

    requestAnimationFrame(() => {
      pagerRef.current?.setPageWithoutAnimation(1);
    });
  };
  const prevDate = subMonths(currentDate, 1);
  const nextDate = addMonths(currentDate, 1);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background_main }]}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (pagerRef.current) pagerRef.current.setPage(0);
              else setCurrentDate(prevDate);
            }}
          >
            <Icon name="chevron-back" size={24} color={colors.text_primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerTitle}
            onPress={openMonthYearPicker}
          >
            <Text style={[styles.monthText, { color: colors.text_primary }]}>
              {format(currentDate, "MMMM")}
            </Text>
            <Text style={[styles.yearText, { color: colors.text_primary }]}>
              {format(currentDate, "yyyy")}
            </Text>
            <Icon
              name="chevron-down"
              size={18}
              color={colors.text_primary}
              style={{ marginTop: 2 }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (pagerRef.current) pagerRef.current.setPage(2);
              else setCurrentDate(nextDate);
            }}
          >
            <Icon
              name="chevron-forward"
              size={24}
              color={colors.text_primary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.dayNamesRow}>
          {dayNames.map((day) => (
            <View key={day} style={styles.dayNameBox}>
              <Text
                style={[styles.dayNameText, { color: colors.text_primary }]}
              >
                {day}
              </Text>
            </View>
          ))}
        </View>

        <PagerView
          key={format(currentDate, "yyyy-MM")}
          ref={pagerRef}
          style={{ flex: 1 }}
          initialPage={1}
          onPageSelected={handlePageSelected}
        >
          <View key={format(prevDate, "yyyy-MM")}>
            {renderMonthGrid(prevDate)}
          </View>
          <View key={format(currentDate, "yyyy-MM")}>
            {renderMonthGrid(currentDate)}
          </View>
          <View key={format(nextDate, "yyyy-MM")}>
            {renderMonthGrid(nextDate)}
          </View>
        </PagerView>
      </View>

      <EventsOfDayModal
        isVisible={modalVisible}
        onClose={() => setModalVisible(false)}
        selectedDate={selectedDate}
        selectedEvents={selectedEvents}
        deleteEvent={deleteEvent}
        setSelectedEvents={setSelectedEvents}
      />
      <EmptyDayModal
        isVisible={emptyDayModalVisible}
        onClose={() => setEmptyDayModalVisible(false)}
        selectedDate={emptySelectedDate}
        onCreateEvent={() => {
          setEmptyDayModalVisible(false);
          setSelectedEvent(null);
          setEventModalVisible(true);
        }}
      />
      <EditEventModal
        visible={eventModalVisible}
        event={selectedEvent}
        onClose={() => setEventModalVisible(false)}
        initialDate={emptySelectedDate}
        onSave={async (eventToSave) => {
          try {
            if (selectedEvent) await updateEvent(eventToSave);
            else {
              const newEvent = { ...eventToSave, id: Date.now().toString() };
              await addEvent(newEvent);
              setSelectedEvents((prev) => [...prev, newEvent]);
            }
          } catch (err) {
            console.error("Error saving event:", err);
          }
          setEventModalVisible(false);
          setEmptySelectedDate(null);
        }}
      />

      <Modal
        visible={monthPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthPickerVisible(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View
            style={[
              styles.pickerCard,
              { backgroundColor: colors.background_main || "#222" },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text_primary }]}>
              Pick month & year
            </Text>

            <View style={styles.pickerRow}>
              <FlatList
                ref={monthsListRef}
                data={months}
                keyExtractor={(m) => m}
                style={styles.list}
                getItemLayout={(_, index) => ({
                  length: LIST_ITEM_HEIGHT,
                  offset: LIST_ITEM_HEIGHT * index,
                  index,
                })}
                renderItem={({ item, index }) => {
                  const selected = tempMonth === index;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.pickerItem,
                        selected && { backgroundColor: colors.primary },
                      ]}
                      onPress={() => setTempMonth(index)}
                    >
                      <Text
                        style={{
                          color: selected
                            ? colors.text_on_color
                            : colors.text_primary,
                          fontWeight: selected ? "700" : "500",
                          fontSize: 13,
                        }}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
              <View style={styles.pickerDivider} />
              <FlatList
                ref={yearsListRef}
                data={years}
                keyExtractor={(y) => String(y)}
                style={styles.list}
                getItemLayout={(_, index) => ({
                  length: LIST_ITEM_HEIGHT,
                  offset: LIST_ITEM_HEIGHT * index,
                  index,
                })}
                renderItem={({ item }) => {
                  const selected = tempYear === item;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.pickerItem,
                        selected && { backgroundColor: colors.primary },
                      ]}
                      onPress={() => setTempYear(item)}
                    >
                      <Text
                        style={{
                          color: selected
                            ? colors.text_on_color
                            : colors.text_primary,
                          fontWeight: selected ? "700" : "500",
                          fontSize: 13,
                        }}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setMonthPickerVisible(false)}
              >
                <Text style={{ color: colors.text_primary, fontSize: 13 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={() => {
                  // Keep the three-page pager centered before changing month.
                  pagerRef.current?.setPageWithoutAnimation(1);
                  setCurrentDate(new Date(tempYear, tempMonth, 1));

                  setMonthPickerVisible(false);
                }}
              >
                <Text
                  style={{
                    color: colors.text_on_color,
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  Apply
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
  },
  headerTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  monthText: { fontSize: 22, fontWeight: "600" },
  yearText: { fontSize: 22, fontWeight: "600" },
  dayNamesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 7,
  },
  dayNameBox: { width: "14.28%", alignItems: "center", paddingVertical: 10 },
  dayNameText: { fontWeight: "600", fontSize: 12 },
  grid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  dayBox: {
    width: "14.28%",
    height: "20%",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 8,
    borderWidth: 1,
    borderRadius: 10,
  },
  outsideMonth: { opacity: 0.4 },
  dateWrapper: {
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  dayNumber: { fontWeight: "bold", fontSize: 16 },
  eventText: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: "500",
    paddingHorizontal: 4,
    borderRadius: 4,
    width: "90%",
    textAlign: "center",
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  pickerCard: { width: "80%", maxWidth: 420, borderRadius: 12, padding: 10 },
  modalTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  pickerRow: { flexDirection: "row", minHeight: 180, maxHeight: 260 },
  list: { flex: 1 },
  pickerItem: {
    height: LIST_ITEM_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 10,
    marginHorizontal: 6,
    marginVertical: 3,
    borderRadius: 8,
  },
  pickerDivider: {
    width: 1,
    opacity: 0.2,
    backgroundColor: "#888",
    marginHorizontal: 6,
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  actionButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
});

export default CalendarScreen;
