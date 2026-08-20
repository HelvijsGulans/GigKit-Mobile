import { Preset } from "@/app/(tabs)/presets";
import { eventsContext } from "@/src/context/eventsContext";
import { useTheme } from "@/src/context/themeContext";
import type { IconAssetId } from "@/src/utils/iconAssets";
import { ICON_ASSETS, resolveIconSource } from "@/src/utils/iconAssets";
import { Event, Icon } from "@/src/utils/ridersHelpers";
import { Entypo, Ionicons } from "@expo/vector-icons";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Reanimated, {
  type SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  Alert,
  Animated,
  Image,
  Keyboard,
  Modal,
  PanResponder,
  SafeAreaView,
  ScrollView,
  type GestureResponderEvent,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type PaletteIcon = Omit<Icon, "x" | "y"> & { assetId: IconAssetId };
type GestureTouchPoint = { x: number; y: number };
type StageFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};
type StageItemGeometry = {
  absoluteX: number;
  absoluteY: number;
  contentHeight: number;
  contentWidth: number;
  displayHeight: number;
  displayWidth: number;
  frame: StageFrame;
  rotation: number;
};
type StageIconPinchFrame = StageFrame & {
  iconId: string;
  minScaleMultiplier: number;
};
type StageBlankTapStart = {
  pageX: number;
  pageY: number;
  stageX: number;
  stageY: number;
};

interface StagePlanModalProps {
  visible: boolean;
  event?: Event;
  preset?: Preset;
  mode?: "preset" | "event";
  onClose: () => void;
  onSave: (updatedPresetOrEvent: Preset | Event) => Promise<void>;
  onReturnToEdit?: (updatedPresetOrEvent: Preset | Event) => void;
}

const A4_ASPECT = 595 / 842;
const ICON_SIZE = 50;
const WRAPPER_SIZE = 60;
const WRAPPER_OFFSET = 5;
const TEXT_BOX_WIDTH = 180;
const TEXT_BOX_HEIGHT = 90;
const TEXT_BOX_PADDING = 6;
const MIN_TEXT_FONT_SIZE = 4;
const MAX_TEXT_FONT_SIZE = 96;
const MIN_TEXT_BOX_WIDTH = 80;
const MIN_TEXT_BOX_HEIGHT = 44;
const TEXT_RESIZE_HANDLE_SIZE = 18;
const TEXT_RESIZE_HITBOX_SIZE = 46;
const MIN_STAGE_ICON_SCALE = 0.1;
const ITEM_INTERACTION_MOVE_THRESHOLD = 5;
const STAGE_ICON_PINCH_HIT_SLOP = 32;
const STAGE_CONTROL_SIZE = 40;
const STAGE_CONTROL_HIT_SLOP = 15;
const STAGE_CONTROL_GAP = 8;
const STAGE_CONTROL_OFFSET = 10;
const STAGE_CONTROL_CLUSTER_HEIGHT =
  STAGE_CONTROL_SIZE * 3 + STAGE_CONTROL_GAP * 2;

const isPointInsideExpandedFrame = (
  x: number,
  y: number,
  frame: StageFrame,
  hitSlop: number,
) => {
  "worklet";

  return (
    x >= frame.left - hitSlop &&
    x <= frame.left + frame.width + hitSlop &&
    y >= frame.top - hitSlop &&
    y <= frame.top + frame.height + hitSlop
  );
};

const hasTouchInsidePinchFrame = (
  touches: GestureTouchPoint[],
  frame: StageIconPinchFrame,
) => {
  "worklet";

  return touches.some((touch) =>
    isPointInsideExpandedFrame(
      touch.x,
      touch.y,
      frame,
      STAGE_ICON_PINCH_HIT_SLOP,
    ),
  );
};

const getStageItemGeometry = (
  icon: Icon,
  stageWidth: number,
  stageHeight: number,
): StageItemGeometry => {
  const normalizedWidth = icon.width || WRAPPER_SIZE / stageWidth;
  const normalizedHeight = icon.height || WRAPPER_SIZE / stageHeight;
  const scale = icon.isText
    ? (icon.scale ?? 1)
    : Math.max(MIN_STAGE_ICON_SCALE, icon.scale ?? 1);
  const displayWidth = normalizedWidth * stageWidth * scale;
  const displayHeight = normalizedHeight * stageHeight * scale;
  const absoluteX = icon.x * stageWidth;
  const absoluteY = icon.y * stageHeight;
  const left = absoluteX - WRAPPER_OFFSET;
  const top = absoluteY - WRAPPER_OFFSET;
  const contentWidth = Math.max(0, displayWidth - WRAPPER_OFFSET * 2);
  const contentHeight = Math.max(0, displayHeight - WRAPPER_OFFSET * 2);

  return {
    absoluteX,
    absoluteY,
    contentHeight,
    contentWidth,
    displayHeight,
    displayWidth,
    frame: {
      left,
      top,
      width: displayWidth,
      height: displayHeight,
    },
    rotation: icon.rotation ?? 0,
  };
};

const getStageSelectionOverlayMetrics = (
  itemGeometry: StageItemGeometry,
  stageWidth: number,
  stageHeight: number,
) => {
  const { frame, rotation } = itemGeometry;
  const rotationRadians = (Math.abs(rotation % 360) * Math.PI) / 180;
  const rotatedWidth =
    Math.abs(frame.width * Math.cos(rotationRadians)) +
    Math.abs(frame.height * Math.sin(rotationRadians));
  const rotatedHeight =
    Math.abs(frame.width * Math.sin(rotationRadians)) +
    Math.abs(frame.height * Math.cos(rotationRadians));
  const centerX = frame.left + frame.width / 2;
  const centerY = frame.top + frame.height / 2;
  const visualLeft = centerX - rotatedWidth / 2;
  const visualRight = centerX + rotatedWidth / 2;
  const visualTop = centerY - rotatedHeight / 2;
  const visualBottom = centerY + rotatedHeight / 2;
  const preferredControlLeft = visualRight + STAGE_CONTROL_OFFSET;
  const fallbackControlLeft =
    visualLeft - STAGE_CONTROL_SIZE - STAGE_CONTROL_OFFSET;
  const controlLeft =
    preferredControlLeft + STAGE_CONTROL_SIZE <= stageWidth ||
    fallbackControlLeft < 0
      ? preferredControlLeft
      : fallbackControlLeft;
  const controlTop =
    (visualTop + visualBottom) / 2 - STAGE_CONTROL_CLUSTER_HEIGHT / 2;

  return {
    frame,
    rotation,
    controls: {
      rotateLeft: {
        left: controlLeft,
        top: controlTop,
        width: STAGE_CONTROL_SIZE,
        height: STAGE_CONTROL_SIZE,
      },
      rotateRight: {
        left: controlLeft,
        top: controlTop + STAGE_CONTROL_SIZE + STAGE_CONTROL_GAP,
        width: STAGE_CONTROL_SIZE,
        height: STAGE_CONTROL_SIZE,
      },
      lock: {
        left: controlLeft,
        top: controlTop + (STAGE_CONTROL_SIZE + STAGE_CONTROL_GAP) * 2,
        width: STAGE_CONTROL_SIZE,
        height: STAGE_CONTROL_SIZE,
      },
    },
  };
};

const measureWrappedLineCount = (
  text: string,
  fontSize: number,
  width: number,
) => {
  const charactersPerLine = Math.max(1, Math.floor(width / (fontSize * 0.55)));
  const paragraphs = (text.trim().length ? text : "Type here...").split("\n");

  return paragraphs.reduce((lineCount, paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return lineCount + 1;

    let currentLineLength = 0;
    let paragraphLines = 1;

    words.forEach((word) => {
      const wordLength = word.length;

      if (wordLength > charactersPerLine) {
        if (currentLineLength > 0) paragraphLines += 1;
        paragraphLines += Math.max(
          0,
          Math.ceil(wordLength / charactersPerLine) - 1,
        );
        currentLineLength = wordLength % charactersPerLine;
        return;
      }

      const nextLength =
        currentLineLength === 0
          ? wordLength
          : currentLineLength + 1 + wordLength;

      if (nextLength <= charactersPerLine) {
        currentLineLength = nextLength;
      } else {
        paragraphLines += 1;
        currentLineLength = wordLength;
      }
    });

    return lineCount + paragraphLines;
  }, 0);
};

const estimateTextFontSize = (text: string, width: number, height: number) => {
  const availableWidth = Math.max(1, width - TEXT_BOX_PADDING * 2);
  const availableHeight = Math.max(1, height - TEXT_BOX_PADDING * 2);

  let low = MIN_TEXT_FONT_SIZE;
  let high = Math.min(
    MAX_TEXT_FONT_SIZE,
    availableWidth * 0.22,
    availableHeight * 0.75,
  );

  for (let i = 0; i < 12; i += 1) {
    const candidate = (low + high) / 2;
    const lineCount = measureWrappedLineCount(text, candidate, availableWidth);
    const measuredHeight = lineCount * candidate * 1.2;

    if (measuredHeight <= availableHeight) {
      low = candidate;
    } else {
      high = candidate;
    }
  }

  return Math.max(MIN_TEXT_FONT_SIZE, low);
};

const paletteIcons: PaletteIcon[] = [
  {
    id: "1-local",
    assetId: "acousticGuitar",
    source: ICON_ASSETS.acousticGuitar,
  },
  { id: "2-local", assetId: "drumKit", source: ICON_ASSETS.drumKit },
  { id: "3-local", assetId: "saxaphone", source: ICON_ASSETS.saxaphone },
  { id: "4-local", assetId: "bassGuitar", source: ICON_ASSETS.bassGuitar },
  { id: "5-local", assetId: "doubleBass", source: ICON_ASSETS.doubleBass },
  {
    id: "6-local",
    assetId: "electricGuitar",
    source: ICON_ASSETS.electricGuitar,
  },
  { id: "7-local", assetId: "grandPiano", source: ICON_ASSETS.grandPiano },
  { id: "8-local", assetId: "keyboard", source: ICON_ASSETS.keyboard },
  { id: "9-local", assetId: "microphone", source: ICON_ASSETS.microphone },
  { id: "10-local", assetId: "speaker", source: ICON_ASSETS.speaker },
  { id: "11-local", assetId: "trumpet", source: ICON_ASSETS.trumpet },
  { id: "12-local", assetId: "accordian", source: ICON_ASSETS.accordian },
  { id: "13-local", assetId: "amplifier", source: ICON_ASSETS.amplifier },
  { id: "14-local", assetId: "amplifier_2", source: ICON_ASSETS.amplifier_2 },
  { id: "15-local", assetId: "clarinet", source: ICON_ASSETS.clarinet },
  {
    id: "16-local",
    assetId: "condenser_mic",
    source: ICON_ASSETS.condenser_mic,
  },
  { id: "17-local", assetId: "flute", source: ICON_ASSETS.flute },
  { id: "18-local", assetId: "kick_mic", source: ICON_ASSETS.kick_mic },
  { id: "19-local", assetId: "music_stand", source: ICON_ASSETS.music_stand },
  { id: "20-local", assetId: "power_outlet", source: ICON_ASSETS.power_outlet },
  {
    id: "21-local",
    assetId: "upright_piano",
    source: ICON_ASSETS.upright_piano,
  },
  { id: "22-local", assetId: "marimba", source: ICON_ASSETS.marimba },
  { id: "23-local", assetId: "bongos", source: ICON_ASSETS.bongos },
  { id: "24-local", assetId: "cajon", source: ICON_ASSETS.cajon },
  { id: "25-local", assetId: "chime", source: ICON_ASSETS.chime },
  { id: "26-local", assetId: "congas", source: ICON_ASSETS.congas },
  { id: "27-local", assetId: "djembe", source: ICON_ASSETS.djembe },
  { id: "28-local", assetId: "tambourine", source: ICON_ASSETS.tambourine },
  { id: "29-local", assetId: "cymbal", source: ICON_ASSETS.cymbal },
  { id: "30-local", assetId: "hiHat", source: ICON_ASSETS.hiHat },
  { id: "31-local", assetId: "line", source: ICON_ASSETS.line },
  { id: "32-local", assetId: "kickDrum", source: ICON_ASSETS.kickDrum },
  { id: "33-local", assetId: "violin", source: ICON_ASSETS.violin },
  { id: "34-local", assetId: "cello", source: ICON_ASSETS.cello },
  { id: "35-local", assetId: "trombone", source: ICON_ASSETS.trombone },
  { id: "36-local", assetId: "tuba", source: ICON_ASSETS.tuba },
];

const borderIcons: PaletteIcon[] = [
  { id: "b1-local", assetId: "squareStage", source: ICON_ASSETS.squareStage },
  { id: "b2-local", assetId: "circle", source: ICON_ASSETS.circle },
  { id: "b3-local", assetId: "star", source: ICON_ASSETS.star },
  { id: "b4-local", assetId: "rectangleV", source: ICON_ASSETS.rectangleV },
  { id: "b5-local", assetId: "rectangleH", source: ICON_ASSETS.rectangleH },
  { id: "b6-local", assetId: "power_outlet", source: ICON_ASSETS.power_outlet },
];

const keyboardIcons = paletteIcons.filter((i) =>
  ["grandPiano", "keyboard", "upright_piano", "accordian"].includes(i.assetId),
);
const brassIcons = paletteIcons.filter((i) =>
  ["saxaphone", "trumpet", "trombone", "tuba"].includes(i.assetId),
);
const woodwindIcons = paletteIcons.filter((i) =>
  ["flute", "clarinet"].includes(i.assetId),
);
const stringIcons = paletteIcons.filter((i) =>
  [
    "acousticGuitar",
    "electricGuitar",
    "bassGuitar",
    "violin",
    "doubleBass",
    "cello",
  ].includes(i.assetId),
);
const drumIcons = paletteIcons.filter((i) =>
  ["drumKit", "cymbal", "hiHat", "kickDrum"].includes(i.assetId),
);
const percussionIcons = paletteIcons.filter((i) =>
  [
    "djembe",
    "congas",
    "bongos",
    "triangle",
    "tambourine",
    "chime",
    "cajon",
  ].includes(i.assetId),
);
const otherIcons = paletteIcons.filter((i) =>
  ["music_stand", "power_outlet", "line"].includes(i.assetId),
);

const Microphones = paletteIcons.filter((i) =>
  ["microphone", "kick_mic", "condenser_mic"].includes(i.assetId),
);

const Monitors = paletteIcons.filter((i) =>
  ["speaker", "amplifier", "amplifier_2"].includes(i.assetId),
);

export default function StagePlanModal({
  visible,
  event,
  onClose,
  mode = "event",
  onSave,
  onReturnToEdit,
}: StagePlanModalProps) {
  useContext(eventsContext);

  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [stageLayout, setStageLayout] = useState({
    x: 0,
    y: 0,
    width: 595,
    height: 842,
  });
  const [stageIcons, setStageIcons] = useState<Icon[]>([]);
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [isDeleteModeActive, setIsDeleteModeActive] = useState(false);
  const [isDraggingIcon, setIsDraggingIcon] = useState(false);
  const pinchScalePreview = useSharedValue(1);
  const selectedStageIconPinchFrame =
    useSharedValue<StageIconPinchFrame | null>(null);
  const stageIconPinchCandidateFrame =
    useSharedValue<StageIconPinchFrame | null>(null);
  const activeStageIconPinchFrame = useSharedValue<StageIconPinchFrame | null>(
    null,
  );
  const preventDeselectRef = useRef(false);
  const activeStageIconPinchRef = useRef<StageIconPinchFrame | null>(null);
  const stageIconPinchCandidateRef = useRef<StageIconPinchFrame | null>(null);
  const stageBlankTapStartRef = useRef<StageBlankTapStart | null>(null);

  const [infoModalVisible, setInfoModalVisible] = useState(false);

  const [openInstruments, setOpenInstruments] = useState(false);
  const [openMics, setOpenMics] = useState(false);
  const [openAmps, setOpenAmps] = useState(false);
  const [openStageElements, setOpenStageElements] = useState(false);

  const [openSub, setOpenSub] = useState({
    keyboards: false,
    brass: false,
    woodwinds: false,
    strings: false,
    drums: false,
    percussion: false,
    other: false,
  });

  useEffect(() => {
    if (event?.stageIcons)
      setStageIcons(
        event.stageIcons.map((ic) => ({
          ...ic,
          assetId: ic.assetId,
          source: resolveIconSource(ic) ?? ic.source,
          rotation: (ic as any).rotation ?? 0,
          scale: (ic as any).scale ?? 1,
          isLocked: (ic as any).isLocked ?? false,
        })),
      );
    if (event?.stageLayout && stageLayout.width === 595)
      setStageLayout(event.stageLayout);
  }, [event]);

  const getStageIconPinchFrame = useCallback(
    (iconId: string | null): StageIconPinchFrame | null => {
      if (!iconId || isDeleteModeActive) return null;

      const icon = stageIcons.find(
        (i) =>
          i.id === iconId && !i.isText && !i.isLocked && !isDeleteModeActive,
      );
      if (!icon) return null;

      const stageWidth = stageLayout.width || WRAPPER_SIZE;
      const stageHeight = stageLayout.height || WRAPPER_SIZE;
      const normalizedWidth = icon.width ?? WRAPPER_SIZE / stageWidth;
      const normalizedHeight = icon.height ?? WRAPPER_SIZE / stageHeight;
      const currentScale = Math.max(MIN_STAGE_ICON_SCALE, icon.scale ?? 1);
      const displayWidth = normalizedWidth * stageWidth * currentScale;
      const displayHeight = normalizedHeight * stageHeight * currentScale;

      return {
        iconId: icon.id,
        left: icon.x * stageWidth - WRAPPER_OFFSET,
        top: icon.y * stageHeight - WRAPPER_OFFSET,
        width: displayWidth,
        height: displayHeight,
        minScaleMultiplier: MIN_STAGE_ICON_SCALE / currentScale,
      };
    },
    [isDeleteModeActive, stageIcons, stageLayout.height, stageLayout.width],
  );

  const selectStageIcon = useCallback(
    (iconId: string) => {
      selectedStageIconPinchFrame.value = getStageIconPinchFrame(iconId);
      setSelectedIconId(iconId);
    },
    [getStageIconPinchFrame, selectedStageIconPinchFrame],
  );

  const clearSelectedStageIcon = useCallback(() => {
    selectedStageIconPinchFrame.value = null;
    setSelectedIconId(null);
  }, [selectedStageIconPinchFrame]);

  useEffect(() => {
    selectedStageIconPinchFrame.value = getStageIconPinchFrame(selectedIconId);
  }, [getStageIconPinchFrame, selectedIconId, selectedStageIconPinchFrame]);

  const toggleIconLock = (iconId: string) => {
    setStageIcons((prev) =>
      prev.map((ic) =>
        ic.id === iconId ? { ...ic, isLocked: !(ic.isLocked ?? false) } : ic,
      ),
    );
    setSelectedIconId(iconId);
    selectedStageIconPinchFrame.value = null;
  };

  const handleStageIconPinchBegin = useCallback(
    (frame: StageIconPinchFrame) => {
      activeStageIconPinchRef.current = frame;
      stageIconPinchCandidateRef.current = frame;
      pinchScalePreview.value = 1;
      preventDeselectRef.current = true;
      selectStageIcon(frame.iconId);
      setIsDraggingIcon(true);
      Keyboard.dismiss();
    },
    [pinchScalePreview, selectStageIcon],
  );

  const handleStageIconPinchEnd = useCallback(
    (iconId: string, scaleMultiplier: number) => {
      const stageWidth = stageLayout.width || WRAPPER_SIZE;
      const stageHeight = stageLayout.height || WRAPPER_SIZE;

      setStageIcons((prev) =>
        prev.map((icon) => {
          if (icon.id !== iconId || icon.isText) return icon;

          const startScale = Math.max(MIN_STAGE_ICON_SCALE, icon.scale ?? 1);
          const nextScale = Math.max(
            MIN_STAGE_ICON_SCALE,
            startScale * scaleMultiplier,
          );
          const normalizedWidth = icon.width ?? WRAPPER_SIZE / stageWidth;
          const normalizedHeight = icon.height ?? WRAPPER_SIZE / stageHeight;
          const startLeft = icon.x * stageWidth - WRAPPER_OFFSET;
          const startTop = icon.y * stageHeight - WRAPPER_OFFSET;
          const startWidth = normalizedWidth * stageWidth * startScale;
          const startHeight = normalizedHeight * stageHeight * startScale;
          const nextWidth = normalizedWidth * stageWidth * nextScale;
          const nextHeight = normalizedHeight * stageHeight * nextScale;
          const centerX = startLeft + startWidth / 2;
          const centerY = startTop + startHeight / 2;
          const nextLeft = centerX - nextWidth / 2;
          const nextTop = centerY - nextHeight / 2;

          return {
            ...icon,
            x: (nextLeft + WRAPPER_OFFSET) / stageWidth,
            y: (nextTop + WRAPPER_OFFSET) / stageHeight,
            scale: nextScale,
          };
        }),
      );
      selectStageIcon(iconId);
      setIsDraggingIcon(false);
    },
    [selectStageIcon, stageLayout.height, stageLayout.width],
  );

  const handleStageIconPinchFinalize = useCallback(() => {
    activeStageIconPinchRef.current = null;
    stageIconPinchCandidateRef.current = null;
    setIsDraggingIcon(false);
    setTimeout(() => {
      pinchScalePreview.value = 1;
      preventDeselectRef.current = false;
    }, 0);
  }, [pinchScalePreview]);

  const stageIconPinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .manualActivation(true)
        .cancelsTouchesInView(false)
        .onTouchesDown((event, state) => {
          const frame = selectedStageIconPinchFrame.value;
          const touchesSelectedItem =
            !!frame && hasTouchInsidePinchFrame(event.allTouches, frame);

          if (!touchesSelectedItem) {
            if (event.numberOfTouches >= 2) {
              stageIconPinchCandidateFrame.value = null;
              activeStageIconPinchFrame.value = null;
              state.fail();
            }
            return;
          }

          stageIconPinchCandidateFrame.value = frame;

          if (event.numberOfTouches >= 2) {
            activeStageIconPinchFrame.value = frame;
            state.activate();
          }
        })
        .onStart(() => {
          const frame = activeStageIconPinchFrame.value;
          if (!frame) return;

          runOnJS(handleStageIconPinchBegin)(frame);
        })
        .onUpdate((event) => {
          const frame = activeStageIconPinchFrame.value;
          if (!frame) return;

          const nextScale = Math.max(frame.minScaleMultiplier, event.scale);
          pinchScalePreview.value = nextScale;
        })
        .onEnd((event) => {
          const frame = activeStageIconPinchFrame.value;
          if (!frame) return;

          const finalScaleMultiplier = Math.max(
            frame.minScaleMultiplier,
            event.scale,
          );
          runOnJS(handleStageIconPinchEnd)(frame.iconId, finalScaleMultiplier);
        })
        .onFinalize(() => {
          const hadActivePinch = !!activeStageIconPinchFrame.value;
          activeStageIconPinchFrame.value = null;
          stageIconPinchCandidateFrame.value = null;
          if (hadActivePinch) {
            runOnJS(handleStageIconPinchFinalize)();
          }
        }),
    [
      activeStageIconPinchFrame,
      handleStageIconPinchBegin,
      handleStageIconPinchEnd,
      handleStageIconPinchFinalize,
      pinchScalePreview,
      selectedStageIconPinchFrame,
      stageIconPinchCandidateFrame,
    ],
  );

  const createPanResponder = (
    iconId: string,
    options?: { captureSelectedTextMoves?: boolean },
  ) => {
    const currentIcon = stageIcons.find((i) => i.id === iconId);
    const captureSelectedTextMoves = options?.captureSelectedTextMoves ?? false;

    if (currentIcon?.isLocked && !isDeleteModeActive) {
      return { panHandlers: {} };
    }
    if (!currentIcon) {
      return { panHandlers: {} };
    }

    let startX = currentIcon.x * stageLayout.width - WRAPPER_OFFSET || 0;
    let startY = currentIcon.y * stageLayout.height - WRAPPER_OFFSET || 0;

    const effectiveWrapperSize = (icon?: Icon) => {
      const normW = icon?.width ?? WRAPPER_SIZE / stageLayout.width;
      const normH = icon?.height ?? WRAPPER_SIZE / stageLayout.height;
      const scale = icon?.scale ?? 1;
      return {
        width: Math.max(0, normW * stageLayout.width * scale),
        height: Math.max(0, normH * stageLayout.height * scale),
      };
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        if ((evt.nativeEvent.touches?.length ?? 1) > 1) return false;

        if (isDeleteModeActive) return true;

        if (currentIcon?.isText && selectedIconId === iconId) {
          return false;
        }

        return true;
      },
      onStartShouldSetPanResponderCapture: (evt) => {
        const isButton = evt.target !== evt.currentTarget;
        if (isButton) return false;

        if ((evt.nativeEvent.touches?.length ?? 1) > 1) return false;
        if (isDeleteModeActive) return true;

        if (currentIcon?.isText && selectedIconId === iconId) return false;

        return true;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if ((evt.nativeEvent.touches?.length ?? 1) > 1) return false;

        return (
          Math.abs(gestureState.dx) > ITEM_INTERACTION_MOVE_THRESHOLD ||
          Math.abs(gestureState.dy) > ITEM_INTERACTION_MOVE_THRESHOLD
        );
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        const isMoving =
          Math.abs(gestureState.dx) > ITEM_INTERACTION_MOVE_THRESHOLD ||
          Math.abs(gestureState.dy) > ITEM_INTERACTION_MOVE_THRESHOLD;

        // Only the selected text box body may take movement from TextInput.
        return (
          captureSelectedTextMoves &&
          !!currentIcon?.isText &&
          selectedIconId === iconId &&
          isMoving
        );
      },
      onPanResponderGrant: () => {
        if (!currentIcon?.isText) {
          stageIconPinchCandidateRef.current = null;
        }
        preventDeselectRef.current = true;
        selectStageIcon(iconId);
        setIsDraggingIcon(true);
        if (currentIcon?.isText) Keyboard.dismiss();
      },

      onPanResponderMove: (evt, gesture) => {
        if (
          activeStageIconPinchRef.current?.iconId === iconId ||
          (evt.nativeEvent.touches?.length ?? 1) > 1
        )
          return;

        if (stageLayout.width > 0 && stageLayout.height > 0) {
          setStageIcons((prev) =>
            prev.map((icon) => {
              if (icon.id === iconId) {
                let newX = startX + gesture.dx;
                let newY = startY + gesture.dy;

                if (icon.isText) {
                  const eff = effectiveWrapperSize(icon);

                  newX = Math.max(
                    0,
                    Math.min(stageLayout.width - eff.width, newX),
                  );
                  newY = Math.max(
                    0,
                    Math.min(stageLayout.height - eff.height, newY),
                  );
                }

                return {
                  ...icon,
                  x: (newX + WRAPPER_OFFSET) / stageLayout.width,
                  y: (newY + WRAPPER_OFFSET) / stageLayout.height,
                };
              }
              return icon;
            }),
          );
        }
      },

      onPanResponderRelease: (_, gesture) => {
        stageIconPinchCandidateRef.current = null;
        setIsDraggingIcon(false);
        const distance = Math.sqrt(gesture.dx ** 2 + gesture.dy ** 2);

        if (distance < ITEM_INTERACTION_MOVE_THRESHOLD && isDeleteModeActive) {
          setStageIcons((prev) => prev.filter((i) => i.id !== iconId));
          if (selectedIconId === iconId) {
            clearSelectedStageIcon();
          }
          setTimeout(() => {
            preventDeselectRef.current = false;
          }, 0);
          return;
        }

        if (!isDeleteModeActive) {
          selectStageIcon(iconId);
        }
        setTimeout(() => {
          preventDeselectRef.current = false;
        }, 0);
      },
      onPanResponderTerminate: () => {
        stageIconPinchCandidateRef.current = null;
        setIsDraggingIcon(false);
        if (!isDeleteModeActive) {
          selectStageIcon(iconId);
        }
        setTimeout(() => {
          preventDeselectRef.current = false;
        }, 0);
      },
      onPanResponderTerminationRequest: () => true,
      onShouldBlockNativeResponder: () => false,
    });
  };

  const createTextResizePanResponder = (
    iconId: string,
    edge: "top" | "right" | "bottom" | "left",
  ) => {
    const currentIcon = stageIcons.find((i) => i.id === iconId);

    if (!currentIcon || currentIcon.isLocked || !currentIcon.isText) {
      return { panHandlers: {} };
    }

    const startLeft = currentIcon.x * stageLayout.width - WRAPPER_OFFSET;
    const startTop = currentIcon.y * stageLayout.height - WRAPPER_OFFSET;
    const startWidth =
      (currentIcon.width ?? TEXT_BOX_WIDTH / stageLayout.width) *
      stageLayout.width;
    const startHeight =
      (currentIcon.height ?? TEXT_BOX_HEIGHT / stageLayout.height) *
      stageLayout.height;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        preventDeselectRef.current = true;
        selectStageIcon(iconId);
        setIsDraggingIcon(true);
        Keyboard.dismiss();
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        setStageIcons((prev) =>
          prev.map((icon) => {
            if (icon.id !== iconId) return icon;

            let nextLeft = startLeft;
            let nextTop = startTop;
            let nextWidth = startWidth;
            let nextHeight = startHeight;

            if (edge === "right") {
              nextWidth = Math.max(
                MIN_TEXT_BOX_WIDTH,
                Math.min(
                  stageLayout.width - startLeft,
                  startWidth + gesture.dx,
                ),
              );
            }

            if (edge === "bottom") {
              nextHeight = Math.max(
                MIN_TEXT_BOX_HEIGHT,
                Math.min(
                  stageLayout.height - startTop,
                  startHeight + gesture.dy,
                ),
              );
            }

            if (edge === "left") {
              const proposedLeft = Math.max(
                0,
                Math.min(
                  startLeft + gesture.dx,
                  startLeft + startWidth - MIN_TEXT_BOX_WIDTH,
                ),
              );
              nextLeft = proposedLeft;
              nextWidth = startWidth + startLeft - proposedLeft;
            }

            if (edge === "top") {
              const proposedTop = Math.max(
                0,
                Math.min(
                  startTop + gesture.dy,
                  startTop + startHeight - MIN_TEXT_BOX_HEIGHT,
                ),
              );
              nextTop = proposedTop;
              nextHeight = startHeight + startTop - proposedTop;
            }

            return {
              ...icon,
              x: (nextLeft + WRAPPER_OFFSET) / stageLayout.width,
              y: (nextTop + WRAPPER_OFFSET) / stageLayout.height,
              width: nextWidth / stageLayout.width,
              height: nextHeight / stageLayout.height,
              scale: 1,
            };
          }),
        );
      },
      onPanResponderRelease: () => {
        selectStageIcon(iconId);
        setIsDraggingIcon(false);
        setTimeout(() => {
          preventDeselectRef.current = false;
        }, 0);
      },
      onPanResponderTerminate: () => {
        selectStageIcon(iconId);
        setIsDraggingIcon(false);
        setTimeout(() => {
          preventDeselectRef.current = false;
        }, 0);
      },
      onShouldBlockNativeResponder: () => false,
    });
  };

  const isStagePointInsideAnyItemHitArea = useCallback(
    (x: number, y: number) => {
      const stageWidth = stageLayout.width || WRAPPER_SIZE;
      const stageHeight = stageLayout.height || WRAPPER_SIZE;

      const isInsideItem = stageIcons.some((icon) => {
        const itemGeometry = getStageItemGeometry(
          icon,
          stageWidth,
          stageHeight,
        );
        const hitSlop =
          icon.isText && selectedIconId === icon.id
            ? TEXT_RESIZE_HITBOX_SIZE / 2
            : STAGE_ICON_PINCH_HIT_SLOP;

        return isPointInsideExpandedFrame(x, y, itemGeometry.frame, hitSlop);
      });

      if (isInsideItem) return true;

      const selectedIcon = stageIcons.find(
        (icon) => icon.id === selectedIconId,
      );
      if (!selectedIcon) return false;

      const overlayMetrics = getStageSelectionOverlayMetrics(
        getStageItemGeometry(selectedIcon, stageWidth, stageHeight),
        stageWidth,
        stageHeight,
      );
      const controlFrames = Object.values(overlayMetrics.controls);

      return controlFrames.some((frame) =>
        isPointInsideExpandedFrame(x, y, frame, STAGE_CONTROL_HIT_SLOP),
      );
    },
    [selectedIconId, stageIcons, stageLayout.height, stageLayout.width],
  );

  const handleStageTap = useCallback(
    (x: number, y: number) => {
      if (
        preventDeselectRef.current ||
        activeStageIconPinchRef.current ||
        stageIconPinchCandidateRef.current ||
        isStagePointInsideAnyItemHitArea(x, y)
      ) {
        return;
      }

      clearSelectedStageIcon();
      Keyboard.dismiss();
    },
    [clearSelectedStageIcon, isStagePointInsideAnyItemHitArea],
  );

  const handleStageBlankTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      if (event.target !== event.currentTarget) {
        stageBlankTapStartRef.current = null;
        return;
      }

      const touches = event.nativeEvent.touches;
      if (
        touches.length !== 1 ||
        preventDeselectRef.current ||
        activeStageIconPinchRef.current ||
        stageIconPinchCandidateRef.current
      ) {
        stageBlankTapStartRef.current = null;
        return;
      }

      stageBlankTapStartRef.current = {
        pageX: touches[0].pageX,
        pageY: touches[0].pageY,
        stageX: event.nativeEvent.locationX,
        stageY: event.nativeEvent.locationY,
      };
    },
    [],
  );

  const handleStageBlankTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      const start = stageBlankTapStartRef.current;
      if (!start) return;

      const touches = event.nativeEvent.touches;
      if (touches.length !== 1) {
        stageBlankTapStartRef.current = null;
        return;
      }

      const dx = touches[0].pageX - start.pageX;
      const dy = touches[0].pageY - start.pageY;
      if (Math.sqrt(dx ** 2 + dy ** 2) > ITEM_INTERACTION_MOVE_THRESHOLD) {
        stageBlankTapStartRef.current = null;
      }
    },
    [],
  );

  const handleStageBlankTouchEnd = useCallback(() => {
    const start = stageBlankTapStartRef.current;
    stageBlankTapStartRef.current = null;

    if (!start) return;

    handleStageTap(start.stageX, start.stageY);

    if (!activeStageIconPinchRef.current) {
      stageIconPinchCandidateRef.current = null;
    }
  }, [handleStageTap]);

  const handleStageBlankTouchCancel = useCallback(() => {
    stageBlankTapStartRef.current = null;
    if (!activeStageIconPinchRef.current) {
      stageIconPinchCandidateRef.current = null;
    }
  }, []);

  const stageGesture = stageIconPinchGesture;

  const handleStageIconTouchStart = useCallback(
    (iconId: string, event: GestureResponderEvent) => {
      if (isDeleteModeActive || (event.nativeEvent.touches?.length ?? 1) > 1) {
        return;
      }

      preventDeselectRef.current = true;
      selectStageIcon(iconId);
      Keyboard.dismiss();
    },
    [isDeleteModeActive, selectStageIcon],
  );

  const handleStageIconTouchEnd = useCallback(
    (iconId: string) => {
      if (isDeleteModeActive) return;

      selectStageIcon(iconId);
      if (!activeStageIconPinchRef.current) {
        stageIconPinchCandidateRef.current = null;
        setIsDraggingIcon(false);
      }
      setTimeout(() => {
        if (!activeStageIconPinchRef.current) {
          preventDeselectRef.current = false;
        }
      }, 0);
    },
    [isDeleteModeActive, selectStageIcon],
  );

  const handleStageIconTouchCancel = useCallback(() => {
    if (!activeStageIconPinchRef.current) {
      stageIconPinchCandidateRef.current = null;
      setIsDraggingIcon(false);
      setTimeout(() => {
        preventDeselectRef.current = false;
      }, 0);
    }
  }, []);

  const renderIconPalette = (icons: PaletteIcon[], title?: string) => (
    <>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.iconBoxContainer}>
        <ScrollView
          keyboardShouldPersistTaps="always"
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.iconBox}
        >
          {icons.map((icon) => {
            if (!icon.source) {
              console.warn("Icon has no source:", icon.id, icon.assetId);
            }
            return (
              <TouchableOpacity
                key={icon.id}
                onPress={() => {
                  if (stageLayout.width === 0 || stageLayout.height === 0)
                    return;
                  const x = stageLayout.width / 2 - ICON_SIZE / 2;
                  const y = stageLayout.height / 2 - ICON_SIZE / 2;

                  setStageIcons((prev) => [
                    ...prev,
                    {
                      ...icon,
                      assetId: icon.assetId,
                      source: resolveIconSource(icon) ?? icon.source,
                      x: x / stageLayout.width,
                      y: y / stageLayout.height,
                      width: WRAPPER_SIZE / stageLayout.width,
                      height: WRAPPER_SIZE / stageLayout.height,
                      id: Date.now().toString(),
                      rotation: 0,
                      scale: 1,
                    },
                  ]);
                }}
                style={styles.paletteIconWrapper}
              >
                <Image
                  source={icon.source as any}
                  style={
                    icon.width && icon.height
                      ? {
                          width: stageLayout.width
                            ? icon.width * stageLayout.width
                            : ICON_SIZE,
                          height: stageLayout.height
                            ? icon.height * stageLayout.height
                            : ICON_SIZE,
                          resizeMode: "contain",
                        }
                      : styles.iconImage
                  }
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </>
  );

  const rotateIcon = (iconId: string, deltaDeg = 45) => {
    setStageIcons((prev) =>
      prev.map((ic) =>
        ic.id === iconId
          ? {
              ...ic,
              rotation: ((ic.rotation ?? 0) + deltaDeg) % 360,
            }
          : ic,
      ),
    );
  };

  // Retained while pinch resizing owns the visible scale UI.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const changeIconScale = (iconId: string, delta = 0.1) => {
    setStageIcons((prev) =>
      prev.map((ic) => {
        if (ic.id !== iconId) return ic;
        const newScale = Math.max(
          MIN_STAGE_ICON_SCALE,
          (ic.scale ?? 1) + delta,
        );
        return { ...ic, scale: newScale };
      }),
    );
  };

  const handleSaveStage = async () => {
    try {
      const normalizedIcons = stageIcons.map((ic) => {
        const base = {
          id: ic.id,
          assetId: ic.assetId,
          x: ic.x,
          y: ic.y,
          width: ic.width || WRAPPER_SIZE / stageLayout.width,
          height: ic.height || WRAPPER_SIZE / stageLayout.height,
          rotation: ic.rotation ?? 0,
          scale: ic.scale ?? 1,
          isLocked: ic.isLocked ?? false,
          label: ic.label || "",
          isText: !!ic.isText,
        };

        if (!ic.assetId && ic.source) {
          return { ...base, source: ic.source };
        }
        return base;
      });

      const updatedEvent: Event = {
        ...(event || {}),
        id: event?.id || `preset-${Date.now()}`,
        eventName: event?.eventName || "New Stage Preset",
        stageIcons: normalizedIcons,
        stageLayout: { ...stageLayout },
        date: event?.date
          ? event.date instanceof Date
            ? event.date
            : new Date(event.date)
          : new Date(),
        venue: event?.venue || "",
        requirements: event?.requirements || [],
        profileId: event?.profileId || "Default Profile",
      };

      await onSave(updatedEvent);

      if (onReturnToEdit) onReturnToEdit(updatedEvent);
      else onClose();
    } catch (e) {
      console.error("Failed to save stage:", e);
      Alert.alert("Error", "Could not save stage.");
    }
  };

  const toggleDeleteMode = () => setIsDeleteModeActive((prev) => !prev);

  const selectedStageIcon = stageIcons.find(
    (icon) => icon.id === selectedIconId,
  );
  const selectedStageItemGeometry =
    selectedStageIcon && stageLayout.width > 0 && stageLayout.height > 0
      ? getStageItemGeometry(
          selectedStageIcon,
          stageLayout.width,
          stageLayout.height,
        )
      : null;
  const selectedStageOverlayMetrics =
    selectedStageItemGeometry && stageLayout.width > 0 && stageLayout.height > 0
      ? getStageSelectionOverlayMetrics(
          selectedStageItemGeometry,
          stageLayout.width,
          stageLayout.height,
        )
      : null;

  return (
    <Modal visible={visible} animationType="slide">
      <GestureHandlerRootView style={styles.modalGestureRoot}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar
            backgroundColor={colors.background_main}
            barStyle="light-content"
          />

          <View style={styles.header}>
            <TouchableOpacity
              onPress={toggleDeleteMode}
              style={[
                styles.headerButtonLeft,
                styles.iconButtonBase,
                {
                  backgroundColor: isDeleteModeActive
                    ? colors.background_main
                    : "transparent",
                  borderColor: isDeleteModeActive
                    ? "red"
                    : colors.background_main,
                  borderWidth: isDeleteModeActive ? 3 : 0,
                },
              ]}
            >
              <View>
                <Ionicons
                  name="trash-bin"
                  size={26}
                  color={isDeleteModeActive ? "red" : colors.text_primary}
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (stageLayout.width === 0) return;
                const x = stageLayout.width / 2;
                const y = stageLayout.height / 2;
                setStageIcons((prev) => [
                  ...prev,
                  {
                    id: Date.now().toString(),
                    assetId: "text-label" as any,
                    x: x / stageLayout.width,
                    y: y / stageLayout.height,
                    rotation: 0,
                    scale: 1,
                    isText: true,
                    label: "",
                    width: TEXT_BOX_WIDTH / stageLayout.width,
                    height: TEXT_BOX_HEIGHT / stageLayout.height,
                  },
                ]);
              }}
              style={[
                styles.iconButtonBase,
                {
                  position: "absolute",
                  right: 70,
                  top: "50%",
                  transform: [{ translateY: -12 }],
                  paddingHorizontal: 5,
                },
              ]}
            >
              <Ionicons name="text" size={26} color={colors.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setInfoModalVisible(true)}
              style={styles.headerButtonRight}
            >
              <Entypo
                name="info-with-circle"
                size={26}
                color={colors.secondary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            scrollEnabled={!isDraggingIcon}
          >
            <TouchableOpacity
              onPress={() => setOpenInstruments((prev) => !prev)}
              style={[
                styles.topCard,
                openInstruments && styles.topCardExpanded,
              ]}
              activeOpacity={0.9}
            >
              <View style={styles.dropdownRow}>
                <Text style={styles.dropdownHeaderText}>Instruments</Text>
                <Ionicons
                  name={openInstruments ? "chevron-down" : "chevron-forward"}
                  size={18}
                  color={colors.text_primary}
                />
              </View>
            </TouchableOpacity>

            {openInstruments && (
              <View style={[styles.topCardBody, styles.topCardBodyNested]}>
                <View style={styles.subSectionCard}>
                  <TouchableOpacity
                    onPress={() =>
                      setOpenSub((prev) => ({
                        ...prev,
                        keyboards: !prev.keyboards,
                      }))
                    }
                    style={styles.subHeader}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.subHeaderText}>Keyboards</Text>
                    <Ionicons
                      name={
                        openSub.keyboards ? "chevron-down" : "chevron-forward"
                      }
                      size={16}
                      color={colors.text_primary}
                    />
                  </TouchableOpacity>
                  {openSub.keyboards && (
                    <View style={styles.subSectionContent}>
                      {renderIconPalette(keyboardIcons, "Keyboards")}
                    </View>
                  )}
                </View>

                <View style={styles.subSectionCard}>
                  <TouchableOpacity
                    onPress={() =>
                      setOpenSub((prev) => ({
                        ...prev,
                        brass: !prev.brass,
                      }))
                    }
                    style={styles.subHeader}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.subHeaderText}>Brass</Text>
                    <Ionicons
                      name={openSub.brass ? "chevron-down" : "chevron-forward"}
                      size={16}
                      color={colors.text_primary}
                    />
                  </TouchableOpacity>
                  {openSub.brass && (
                    <View style={styles.subSectionContent}>
                      {renderIconPalette(brassIcons)}
                    </View>
                  )}
                </View>

                <View style={styles.subSectionCard}>
                  <TouchableOpacity
                    onPress={() =>
                      setOpenSub((prev) => ({
                        ...prev,
                        woodwinds: !prev.woodwinds,
                      }))
                    }
                    style={styles.subHeader}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.subHeaderText}>Woodwinds</Text>
                    <Ionicons
                      name={
                        openSub.woodwinds ? "chevron-down" : "chevron-forward"
                      }
                      size={16}
                      color={colors.text_primary}
                    />
                  </TouchableOpacity>
                  {openSub.woodwinds && (
                    <View style={styles.subSectionContent}>
                      {renderIconPalette(woodwindIcons)}
                    </View>
                  )}
                </View>

                <View style={styles.subSectionCard}>
                  <TouchableOpacity
                    onPress={() =>
                      setOpenSub((prev) => ({
                        ...prev,
                        strings: !prev.strings,
                      }))
                    }
                    style={styles.subHeader}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.subHeaderText}>Strings</Text>
                    <Ionicons
                      name={
                        openSub.strings ? "chevron-down" : "chevron-forward"
                      }
                      size={16}
                      color={colors.text_primary}
                    />
                  </TouchableOpacity>
                  {openSub.strings && (
                    <View style={styles.subSectionContent}>
                      {renderIconPalette(stringIcons)}
                    </View>
                  )}
                </View>

                <View style={styles.subSectionCard}>
                  <TouchableOpacity
                    onPress={() =>
                      setOpenSub((prev) => ({
                        ...prev,
                        drums: !prev.drums,
                      }))
                    }
                    style={styles.subHeader}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.subHeaderText}>Drums</Text>
                    <Ionicons
                      name={openSub.drums ? "chevron-down" : "chevron-forward"}
                      size={16}
                      color={colors.text_primary}
                    />
                  </TouchableOpacity>
                  {openSub.drums && (
                    <View style={styles.subSectionContent}>
                      {renderIconPalette(drumIcons)}
                    </View>
                  )}
                </View>

                <View style={styles.subSectionCard}>
                  <TouchableOpacity
                    onPress={() =>
                      setOpenSub((prev) => ({
                        ...prev,
                        percussion: !prev.percussion,
                      }))
                    }
                    style={styles.subHeader}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.subHeaderText}>Percussion</Text>
                    <Ionicons
                      name={
                        openSub.percussion ? "chevron-down" : "chevron-forward"
                      }
                      size={16}
                      color={colors.text_primary}
                    />
                  </TouchableOpacity>
                  {openSub.percussion && (
                    <View style={styles.subSectionContent}>
                      {renderIconPalette(percussionIcons)}
                    </View>
                  )}
                </View>

                <View style={styles.subSectionCard}>
                  <TouchableOpacity
                    onPress={() =>
                      setOpenSub((prev) => ({
                        ...prev,
                        other: !prev.other,
                      }))
                    }
                    style={styles.subHeader}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.subHeaderText}>Other</Text>
                    <Ionicons
                      name={openSub.other ? "chevron-down" : "chevron-forward"}
                      size={16}
                      color={colors.text_primary}
                    />
                  </TouchableOpacity>
                  {openSub.other && (
                    <View style={styles.subSectionContent}>
                      {renderIconPalette(otherIcons)}
                    </View>
                  )}
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={() => setOpenMics((prev) => !prev)}
              style={[styles.topCard, openMics && styles.topCardExpanded]}
              activeOpacity={0.9}
            >
              <View style={styles.dropdownRow}>
                <Text style={styles.dropdownHeaderText}>Mics & Inputs</Text>
                <Ionicons
                  name={openMics ? "chevron-down" : "chevron-forward"}
                  size={18}
                  color={colors.text_primary}
                />
              </View>
            </TouchableOpacity>
            {openMics && (
              <View style={styles.topCardBody}>
                <View style={styles.simpleSectionBody}>
                  {renderIconPalette(Microphones)}
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={() => setOpenAmps((prev) => !prev)}
              style={[styles.topCard, openAmps && styles.topCardExpanded]}
              activeOpacity={0.9}
            >
              <View style={styles.dropdownRow}>
                <Text style={styles.dropdownHeaderText}>Monitoring & Amps</Text>
                <Ionicons
                  name={openAmps ? "chevron-down" : "chevron-forward"}
                  size={18}
                  color={colors.text_primary}
                />
              </View>
            </TouchableOpacity>
            {openAmps && (
              <View style={styles.topCardBody}>
                <View style={styles.simpleSectionBody}>
                  {renderIconPalette(Monitors)}
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={() => setOpenStageElements((prev) => !prev)}
              style={[
                styles.topCard,
                openStageElements && styles.topCardExpanded,
              ]}
              activeOpacity={0.9}
            >
              <View style={styles.dropdownRow}>
                <Text style={styles.dropdownHeaderText}>Stage Elements</Text>
                <Ionicons
                  name={openStageElements ? "chevron-down" : "chevron-forward"}
                  size={18}
                  color={colors.text_primary}
                />
              </View>
            </TouchableOpacity>
            {openStageElements && (
              <View style={styles.topCardBody}>
                <View style={styles.simpleSectionBody}>
                  {renderIconPalette(borderIcons)}
                </View>
              </View>
            )}

            <Text style={styles.sectionTitle}>Stage (A4 Aspect)</Text>

            <View
              collapsable={false}
              pointerEvents="box-none"
              style={styles.stageCanvasShell}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                if (
                  stageLayout.width !== width ||
                  stageLayout.height !== height
                )
                  setStageLayout({
                    ...stageLayout,
                    width,
                    height,
                  });
              }}
            >
              <GestureDetector gesture={stageGesture}>
                <View
                  collapsable={false}
                  style={[
                    styles.stageBox,
                    {
                      backgroundColor: colors.text_on_color,
                      borderColor: colors.border_color,
                    },
                  ]}
                  onTouchStart={handleStageBlankTouchStart}
                  onTouchMove={handleStageBlankTouchMove}
                  onTouchEnd={handleStageBlankTouchEnd}
                  onTouchCancel={handleStageBlankTouchCancel}
                >
                  {stageIcons.map((icon) => {
                    const panResponder = createPanResponder(icon.id) || {
                      panHandlers: {},
                    };

                    const isSelected = selectedIconId === icon.id;

                    const stageWidth = stageLayout.width || WRAPPER_SIZE;
                    const stageHeight = stageLayout.height || WRAPPER_SIZE;
                    const itemGeometry = getStageItemGeometry(
                      icon,
                      stageWidth,
                      stageHeight,
                    );
                    const {
                      contentHeight,
                      contentWidth,
                      displayHeight,
                      displayWidth,
                    } = itemGeometry;

                    const resolvedSource = resolveIconSource(icon);
                    if (!resolvedSource && !icon.isText) return null;
                    const textFontSize = estimateTextFontSize(
                      icon.label ?? "",
                      contentWidth,
                      contentHeight,
                    );
                    const resizeHandles = icon.isText
                      ? (["top", "right", "bottom", "left"] as const).map(
                          (edge) => ({
                            edge,
                            panResponder: createTextResizePanResponder(
                              icon.id,
                              edge,
                            ),
                          }),
                        )
                      : [];
                    const wrapperStyle = [
                      styles.stageIconWrapper,
                      {
                        left: itemGeometry.frame.left,
                        top: itemGeometry.frame.top,
                        width: displayWidth,
                        height: displayHeight,
                        borderWidth: 0,
                        borderColor: "transparent",
                        transform: [{ rotate: `${itemGeometry.rotation}deg` }],
                      },
                      isDeleteModeActive && styles.stageIconDeleteActive,
                    ];

                    if (!icon.isText) {
                      return (
                        <StageIconImageView
                          key={icon.id}
                          imageSource={resolvedSource}
                          contentWidth={contentWidth}
                          contentHeight={contentHeight}
                          isSelected={isSelected}
                          onTouchCancel={handleStageIconTouchCancel}
                          onTouchEnd={() => handleStageIconTouchEnd(icon.id)}
                          onTouchStart={(event) =>
                            handleStageIconTouchStart(icon.id, event)
                          }
                          panHandlers={panResponder.panHandlers}
                          pinchScalePreview={pinchScalePreview}
                          pointerEvents={
                            icon.isLocked && !isDeleteModeActive
                              ? "none"
                              : "auto"
                          }
                          wrapperStyle={wrapperStyle}
                        />
                      );
                    }

                    const useSplitTextResponders =
                      isSelected && !isDeleteModeActive;
                    const textWrapperPanHandlers = useSplitTextResponders
                      ? {}
                      : panResponder.panHandlers;
                    const textBodyPanResponder = useSplitTextResponders
                      ? createPanResponder(icon.id, {
                          captureSelectedTextMoves: true,
                        })
                      : null;
                    const textBodyPanHandlers =
                      textBodyPanResponder?.panHandlers ?? {};

                    return (
                      <Animated.View
                        key={icon.id}
                        {...textWrapperPanHandlers}
                        pointerEvents={
                          icon.isLocked && !isDeleteModeActive
                            ? "none"
                            : useSplitTextResponders
                              ? "box-none"
                              : "auto"
                        }
                        style={wrapperStyle}
                      >
                        <View
                          {...textBodyPanHandlers}
                          collapsable={false}
                          pointerEvents={isDeleteModeActive ? "none" : "auto"}
                          style={[
                            styles.textBoxBody,
                            {
                              width: contentWidth,
                              height: contentHeight,
                            },
                          ]}
                        >
                          <TextInput
                            style={{
                              color: "#000000",
                              fontSize: textFontSize,
                              lineHeight: textFontSize * 1.2,
                              fontWeight: "bold",
                              textAlign: "center",
                              textAlignVertical: "center",
                              width: contentWidth,
                              height: contentHeight,
                              padding: TEXT_BOX_PADDING,
                              backgroundColor: "transparent",
                              includeFontPadding: false,
                              overflow: "hidden",
                            }}
                            value={icon.label}
                            multiline
                            blurOnSubmit={false}
                            scrollEnabled={false}
                            onChangeText={(next) => {
                              setStageIcons((prev) =>
                                prev.map((i) =>
                                  i.id === icon.id ? { ...i, label: next } : i,
                                ),
                              );
                            }}
                            placeholder="Type here..."
                            placeholderTextColor="#999"
                            editable={isSelected && !isDeleteModeActive}
                            pointerEvents={isDeleteModeActive ? "none" : "auto"}
                          />
                        </View>
                        {isSelected &&
                          !isDeleteModeActive &&
                          resizeHandles.map(({ edge, panResponder }) => (
                            <View
                              key={`${icon.id}-${edge}-resize`}
                              {...panResponder.panHandlers}
                              collapsable={false}
                              pointerEvents="box-only"
                              style={[
                                styles.textResizeHandleHitbox,
                                edge === "top" && styles.textResizeHandleTop,
                                edge === "right" &&
                                  styles.textResizeHandleRight,
                                edge === "bottom" &&
                                  styles.textResizeHandleBottom,
                                edge === "left" && styles.textResizeHandleLeft,
                              ]}
                            >
                              <View style={styles.textResizeHandleDot} />
                            </View>
                          ))}
                      </Animated.View>
                    );
                  })}
                </View>
              </GestureDetector>

              {selectedStageIcon && selectedStageOverlayMetrics && (
                <View
                  pointerEvents="box-none"
                  style={styles.stageSelectionOverlay}
                >
                  <View
                    pointerEvents="none"
                    style={[
                      styles.stageSelectionFrame,
                      {
                        borderColor: isDeleteModeActive
                          ? "red"
                          : colors.primary,
                        height: selectedStageOverlayMetrics.frame.height,
                        left: selectedStageOverlayMetrics.frame.left,
                        top: selectedStageOverlayMetrics.frame.top,
                        transform: [
                          {
                            rotate: `${selectedStageOverlayMetrics.rotation}deg`,
                          },
                        ],
                        width: selectedStageOverlayMetrics.frame.width,
                      },
                    ]}
                  />
                  <View
                    pointerEvents="box-none"
                    style={{
                      position: "absolute",
                      left: selectedStageOverlayMetrics.controls.rotateLeft
                        .left,
                      top: selectedStageOverlayMetrics.controls.rotateLeft.top,
                      zIndex: 100,
                      elevation: 100,
                    }}
                  >
                    <TouchableOpacity
                      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                      onPress={(e) => {
                        e.stopPropagation();
                        rotateIcon(selectedStageIcon.id, -15);
                      }}
                      onPressIn={() => (preventDeselectRef.current = true)}
                      onPressOut={() => (preventDeselectRef.current = false)}
                      style={[
                        styles.iconButtonBase,
                        {
                          backgroundColor: colors.background_main,
                          borderWidth: 1,
                          borderColor: colors.border_color,
                        },
                      ]}
                    >
                      <Text
                        style={{ color: colors.text_primary, fontSize: 20 }}
                      >
                        ⤿
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View
                    pointerEvents="box-none"
                    style={{
                      position: "absolute",
                      left: selectedStageOverlayMetrics.controls.rotateRight
                        .left,
                      top: selectedStageOverlayMetrics.controls.rotateRight.top,
                      zIndex: 100,
                      elevation: 100,
                    }}
                  >
                    <TouchableOpacity
                      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                      onPress={(e) => {
                        e.stopPropagation();
                        rotateIcon(selectedStageIcon.id, 15);
                      }}
                      onPressIn={() => (preventDeselectRef.current = true)}
                      onPressOut={() => (preventDeselectRef.current = false)}
                      style={[
                        styles.iconButtonBase,
                        {
                          backgroundColor: colors.background_main,
                          borderWidth: 1,
                          borderColor: colors.border_color,
                        },
                      ]}
                    >
                      <Text
                        style={{ color: colors.text_primary, fontSize: 20 }}
                      >
                        ⤾
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View
                    pointerEvents="box-none"
                    style={{
                      position: "absolute",
                      left: selectedStageOverlayMetrics.controls.lock.left,
                      top: selectedStageOverlayMetrics.controls.lock.top,
                      zIndex: 100,
                      elevation: 100,
                    }}
                  >
                    <TouchableOpacity
                      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleIconLock(selectedStageIcon.id);
                      }}
                      onPressIn={() => (preventDeselectRef.current = true)}
                      onPressOut={() => (preventDeselectRef.current = false)}
                      style={[
                        styles.iconButtonBase,
                        {
                          backgroundColor: selectedStageIcon.isLocked
                            ? colors.primary
                            : colors.background_main,
                          borderWidth: 1,
                          borderColor: selectedStageIcon.isLocked
                            ? colors.primary
                            : colors.border_color,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          selectedStageIcon.isLocked
                            ? "lock-closed"
                            : "lock-open"
                        }
                        size={20}
                        color={
                          selectedStageIcon.isLocked
                            ? colors.text_on_color
                            : colors.text_primary
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveStage}
            >
              <Text style={styles.saveButtonText}>Save Stage</Text>
            </TouchableOpacity>
          </ScrollView>

          <Modal
            visible={infoModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setInfoModalVisible(false)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.5)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  backgroundColor: colors.background_main,
                  padding: 20,
                  borderRadius: 15,
                  width: "80%",
                }}
              >
                <Text
                  style={{
                    color: colors.text_primary,
                    fontSize: 18,
                    fontWeight: "bold",
                    marginBottom: 10,
                  }}
                >
                  Stage Plan Tips
                </Text>
                <Text style={{ color: colors.text_primary, marginBottom: 5 }}>
                  • Drag icons to move them.
                </Text>
                <Text style={{ color: colors.text_primary, marginBottom: 20 }}>
                  • Use the Text icon in the header to add labels.
                </Text>
                <TouchableOpacity
                  onPress={() => setInfoModalVisible(false)}
                  style={{
                    backgroundColor: colors.secondary,
                    padding: 10,
                    borderRadius: 8,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ color: colors.text_on_color, fontWeight: "bold" }}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

type StageIconImageViewProps = {
  contentHeight: number;
  contentWidth: number;
  imageSource: unknown;
  isSelected: boolean;
  onTouchCancel: () => void;
  onTouchEnd: () => void;
  onTouchStart: (event: GestureResponderEvent) => void;
  panHandlers: any;
  pinchScalePreview: SharedValue<number>;
  pointerEvents: "auto" | "none";
  wrapperStyle: any;
};

function StageIconImageView({
  contentHeight,
  contentWidth,
  imageSource,
  isSelected,
  onTouchCancel,
  onTouchEnd,
  onTouchStart,
  panHandlers,
  pinchScalePreview,
  pointerEvents,
  wrapperStyle,
}: StageIconImageViewProps) {
  const animatedPinchStyle = useAnimatedStyle(
    () => ({
      transform: [{ scale: isSelected ? pinchScalePreview.value : 1 }],
    }),
    [isSelected],
  );

  return (
    <Animated.View
      {...panHandlers}
      onTouchCancel={onTouchCancel}
      onTouchEnd={onTouchEnd}
      onTouchStart={onTouchStart}
      pointerEvents={pointerEvents}
      style={wrapperStyle}
    >
      <Reanimated.View
        style={[
          {
            width: contentWidth,
            height: contentHeight,
            alignItems: "center",
            justifyContent: "center",
          },
          animatedPinchStyle,
        ]}
      >
        <Image
          source={imageSource as any}
          style={{
            width: contentWidth,
            height: contentHeight,
            resizeMode: "contain",
          }}
        />
      </Reanimated.View>
    </Animated.View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background_main,
      paddingTop: 50,
    },
    modalGestureRoot: {
      flex: 1,
    },
    scrollContent: { paddingBottom: 24 },
    header: {
      position: "relative",
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    headerButtonRight: {
      position: "absolute",
      right: 20,
      top: "50%",
      transform: [{ translateY: -12 }],
      padding: 5,
    },
    headerButtonLeft: {
      position: "absolute",
      left: 20,
      top: "50%",
      transform: [{ translateY: -12 }],
      padding: 5,
    },

    sectionTitle: {
      fontWeight: "bold",
      fontSize: 18,
      color: colors.text_primary,
      marginTop: 16,
      marginLeft: 20,
      marginBottom: 8,
    },
    iconBoxContainer: {
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: "white",
    },
    iconBox: { flexDirection: "row", padding: 8 },
    paletteIconWrapper: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      marginHorizontal: 6,
      justifyContent: "center",
      alignItems: "center",
    },
    iconImage: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      resizeMode: "contain",
    },

    stageCanvasShell: {
      width: "95%",
      aspectRatio: A4_ASPECT,
      alignSelf: "center",
      marginTop: 10,
      position: "relative",
      overflow: "visible",
    },
    stageBox: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 2,
      overflow: "hidden",
      zIndex: 1,
      elevation: 1,
    },
    stageSelectionOverlay: {
      ...StyleSheet.absoluteFillObject,
      overflow: "visible",
      zIndex: 9999,
      elevation: 9999,
    },
    stageSelectionFrame: {
      position: "absolute",
      backgroundColor: "transparent",
      borderWidth: 2,
      zIndex: 9999,
    },
    stageIconWrapper: {
      position: "absolute",
      width: WRAPPER_SIZE,
      height: WRAPPER_SIZE,
      justifyContent: "center",
      alignItems: "center",
      padding: WRAPPER_OFFSET,
    },
    stageIconDeleteActive: {
      borderWidth: 2,
      borderColor: "red",
      shadowColor: "red",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 5,
      elevation: 5,
    },
    iconButtonBase: {
      height: 40,
      width: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },

    saveButton: {
      backgroundColor: colors.primary,
      marginTop: 20,
      marginHorizontal: 20,
      marginBottom: 25,
      padding: 14,
      borderRadius: 10,
      alignItems: "center",
    },
    saveButtonText: {
      color: colors.text_on_color,
      fontWeight: "bold",
      fontSize: 16,
    },

    infoModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    infoModalContainer: {
      width: "90%",
      height: "70%",
      borderRadius: 14,
      padding: 20,
      position: "relative",
    },
    infoModalTitle: {
      fontSize: 22,
      fontWeight: "bold",
      marginBottom: 15,
      color: colors.text_primary,
      textAlign: "center",
    },
    infoModalText: {
      fontSize: 16,
      lineHeight: 22,
    },
    infoModalClose: {
      position: "absolute",
      right: 10,
      top: 10,
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 50,
    },

    topCard: {
      marginHorizontal: 20,
      marginTop: 14,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
      borderWidth: 1,
      borderColor: colors.border_color,
      backgroundColor: colors.card ?? colors.background_main,
    },
    topCardExpanded: {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    topCardBody: {
      marginHorizontal: 20,
      borderWidth: 1,
      borderTopWidth: 0,
      borderColor: colors.border_color,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.card ?? colors.background_main,
    },
    topCardBodyNested: {
      paddingVertical: 8,
      paddingHorizontal: 8,
    },
    dropdownRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    dropdownHeaderText: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text_primary,
    },

    subSectionCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border_color,
      backgroundColor:
        colors.card_secondary ?? colors.card ?? colors.background_main,
      marginBottom: 8,
      overflow: "hidden",
    },
    subSectionContent: {
      paddingHorizontal: 8,
      paddingBottom: 8,
      paddingTop: 4,
    },

    subHeader: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    subHeaderText: {
      fontSize: 15,
      color: colors.text_primary,
    },
    stageTextLabel: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#000",
      textAlign: "center",
      padding: 5,
    },
    textBoxBody: {
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
      elevation: 10,
    },
    textResizeHandleHitbox: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
      height: TEXT_RESIZE_HITBOX_SIZE,
      width: TEXT_RESIZE_HITBOX_SIZE,
      zIndex: 20,
      elevation: 20,
    },
    textResizeHandleDot: {
      backgroundColor: colors.primary,
      borderColor: colors.text_on_color,
      borderRadius: TEXT_RESIZE_HANDLE_SIZE / 2,
      borderWidth: 2,
      height: TEXT_RESIZE_HANDLE_SIZE,
      width: TEXT_RESIZE_HANDLE_SIZE,
    },
    textResizeHandleTop: {
      top: -TEXT_RESIZE_HITBOX_SIZE / 2,
      left: "50%",
      marginLeft: -TEXT_RESIZE_HITBOX_SIZE / 2,
    },
    textResizeHandleRight: {
      right: -TEXT_RESIZE_HITBOX_SIZE / 2,
      top: "50%",
      marginTop: -TEXT_RESIZE_HITBOX_SIZE / 2,
    },
    textResizeHandleBottom: {
      bottom: -TEXT_RESIZE_HITBOX_SIZE / 2,
      left: "50%",
      marginLeft: -TEXT_RESIZE_HITBOX_SIZE / 2,
    },
    textResizeHandleLeft: {
      left: -TEXT_RESIZE_HITBOX_SIZE / 2,
      top: "50%",
      marginTop: -TEXT_RESIZE_HITBOX_SIZE / 2,
    },

    simpleSectionBody: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border_color,
      backgroundColor:
        colors.card_secondary ?? colors.card ?? colors.background_main,
      paddingVertical: 6,
      paddingHorizontal: 6,
    },
  });
