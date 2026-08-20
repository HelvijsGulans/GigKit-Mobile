////src/utils/Tutorialhelpers.tsx
import { useTheme } from "@/src/context/themeContext";
import React, { FC } from "react";
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import tutorialImages from '../utils/tutorial_images';


const { width, height } = Dimensions.get("window");

interface StepData {
  id: number;
  title: string;
  textAboveImage: string;
  imageSources: any[];
  textBelowImage: string;
}

const tutorialSteps: StepData[] = [
  {
    id: 1,
    title: 'Welcome & Upcoming Events Screen',
    textAboveImage:
      'Welcome to the GigKit tutorial! The app consists of 4 screens. The "Upcoming Events" screen provides a list of future events.',
    imageSources: [tutorialImages.homeScreenClear],
    textBelowImage:
      'You can edit the event by clicking on the event box, change its name by clicking the pencil icon and share it with the share icon.',
  },
  {
    id: 2,
    title: 'Adjust Days Ahead',
    textAboveImage:
      'Select the number of days ahead you wish to display by clicking the days ahead dropdown menu.',
    imageSources: [tutorialImages.daysAhead],
    textBelowImage: 'Available options are 3, 5, 7, 14, and 30 days.',
  },
  {
    id: 3,
    title: 'Calendar Screen and Creating Events',
    textAboveImage:
      'By clicking the calender icon on the bottom on the screen you can navigate to the calendar screen. This is where you can create events. Start by pressing on the day you want the event in. You can tap the month name or swipe to change months.',
    imageSources: [tutorialImages.calendarScreen],
    textBelowImage: 'The current day is highlighted on the calendar.',
  },
  {
    id: 4,
    title: 'Events of Day Modal & Add Event',
    textAboveImage:
      'Tapping a date will open the **Events of Day Modal**. If the day has no previous events, the only button you will see is **+ Add Event**.',
    imageSources: [tutorialImages.calendarScreenEdit],
    textBelowImage:
      'Pressing this button will take you to the Edit Event screen. This screen is the same for creating a new event as well as editing existing ones.',
  },
  {
    id: 5,
    title: 'Edit Event Screen (Details)',
    textAboveImage:
      'Input the event name, this is mandatory, and location. Input the time and date.',
    imageSources: [tutorialImages.editEventDetails],
    textBelowImage:
      'You can also select the Profile and access Edit Rider or Edit Stage Plan before hitting the Save Event button.',
  },
  {
    id: 6,
    title: 'Edit Rider Screen',
    textAboveImage:
      'This is the **Rider Screen**. Here you can input the necessary technical specification or other relevant information. Input the item name and press the plus button.',
    imageSources: [tutorialImages.riderButton, tutorialImages.riderScreen],
    textBelowImage:
      'You can also add a description to the item by clicking the plus icon next to it.',
  },
  {
    id: 7,
    title: 'Edit Stage Plan Screen (Placement)',
    textAboveImage:
      'Next you can enter the Edit Stage Plan screen. This contains Instruments and Stage Elements & Borders. By tapping on an Icon, it gets placed in the middle of the stage.',
    imageSources: [tutorialImages.stagePlanButton, tutorialImages.stagePlanScreenClear],
    textBelowImage:
      'Do note that you must press Save Stage Plan at the bottom to exit this screen and save your changes.',
  },
  {
    id: 8,
    title: 'Stage Plan Controls',
    textAboveImage:
      'When an icon is placed on the stage, you can modify it using controls.',
    imageSources: [tutorialImages.stagePlanControls, tutorialImages.satePlanControls2],
    textBelowImage:
      'These controls appear when the element is tapped on the stage. Press the save icon when done.',
  },
  {
    id: 9,
    title: 'Presets Screen',
    textAboveImage: 'Here you can create presets for riders as well as stage plans.',
    imageSources: [tutorialImages.presetsScreen],
    textBelowImage: 'You can edit the presets or their names any time.',
  },
  {
    id: 12,
    title: 'Applying Presets',
    textAboveImage:
      'Selecting a preset will prompt you to apply it to an existing event.',
    imageSources: [tutorialImages.applyPreset],
    textBelowImage: 'The preset will be applied to the chosen event.',
  },
  {
    id: 13,
    title: 'Profiles and Calendar Filtering',
    textAboveImage:
      'You can create color-coded profiles. Selecting **Default profile** will display all events.',
    imageSources: [
      tutorialImages.profileColors,
      tutorialImages.calendar_1,
      tutorialImages.calendar_2,
      tutorialImages.calendar_3,
    ],
    textBelowImage: 'Default profile will display everything.',
  },
  {
    id: 14,
    title: 'App Settings',
    textAboveImage:
      'In **Settings** you can change the color mode as well as wipe all data.',
    imageSources: [tutorialImages.appSettings],
    textBelowImage:
      'Wipes all events so you can start from scratch.',
  },
];


interface TutorialModalProps {
  isVisible: boolean;
  onClose: () => void;
  steps: StepData[];
}

const TutorialModal: FC<TutorialModalProps> = ({ isVisible, onClose, steps }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="close" size={26} color={colors.text_primary} />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {(steps || []).map((step) => (
              <View key={step.id} style={styles.stepContainer}>
                <Text style={styles.stepTitle}>{step.title}</Text>

                <Text style={styles.textAbove}>{step.textAboveImage}</Text>

                {step.imageSources.map((src, index) => (
                  <Image
                    key={index}
                    source={src}
                    style={styles.image}
                    resizeMode="contain"
                  />
                ))}

                <Text style={styles.textBelow}>{step.textBelowImage}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 10,
    },
    container: {
      backgroundColor: colors.background_main,
      width: "90%",
      maxHeight: height * 0.85,
      borderRadius: 18,
      padding: 20,
      position: "relative",
    },
    closeButton: {
      position: "absolute",
      top: 10,
      right: 10,
      zIndex: 5,
      padding: 8,
    },
    scrollContent: {
      paddingTop: 40,
      paddingBottom: 30,
    },
    stepContainer: {
      marginBottom: 35,
    },
    stepTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text_primary,
      marginBottom: 10,
      textAlign: "center",
    },
    textAbove: {
      fontSize: 16,
      color: colors.text_primary,
      marginBottom: 15,
    },
    image: {
      width: "100%",
      height: 260,
      marginBottom: 15,
      borderRadius: 10,
      backgroundColor: colors.background_secondary,
    },
    textBelow: {
      fontSize: 15,
      color: colors.placeholder_gray,
    },
  });

export default TutorialModal;
export { tutorialSteps };

