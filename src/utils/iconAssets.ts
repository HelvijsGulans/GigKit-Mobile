import type { ImageSourcePropType } from "react-native";

export type IconSource = ImageSourcePropType;

export const ICON_ASSETS = {
  acousticGuitar: require("../../app/assets/images/Acoustic_guitar.png"),
  drumKit: require("../../app/assets/images/Drum_set.png"),
  saxaphone: require("../../app/assets/images/Saxaphone.png"),
  bassGuitar: require("../../app/assets/images/Bass_guitar.png"),
  violin: require("../../app/assets/images/Violin.png"),
  cello: require("../../app/assets/images/Cello.png"),
  doubleBass: require("../../app/assets/images/Double_bass.png"),
  electricGuitar: require("../../app/assets/images/Electric_guitar.png"),
  grandPiano: require("../../app/assets/images/Grand_piano.png"),
  keyboard: require("../../app/assets/images/Keyboard.png"),
  microphone: require("../../app/assets/images/Microphone.png"),
  speaker: require("../../app/assets/images/Speaker.png"),
  trumpet: require("../../app/assets/images/Trumpet.png"),
  trombone: require("../../app/assets/images/Trombone.png"),
  tuba: require("../../app/assets/images/Tuba.png"),
  squareStage: require("../../app/assets/images/Square_stage.png"),
  accordian: require("../../app/assets/images/Accordian.png"),
  amplifier: require("../../app/assets/images/Amplifier.png"),
  amplifier_2: require("../../app/assets/images/Amplifier_2.png"),
  clarinet: require("../../app/assets/images/Clarinet.png"),
  condenser_mic: require("../../app/assets/images/Condenser_mic.png"),
  flute: require("../../app/assets/images/Flute.png"),
  kick_mic: require("../../app/assets/images/Kick_mic.png"),
  music_stand: require("../../app/assets/images/Music_stand.png"),
  power_outlet: require("../../app/assets/images/Power_outlet.png"),
  upright_piano: require("../../app/assets/images/Upright_piano.png"),
  marimba: require("../../app/assets/images/Marimba.png"),
  bongos: require("../../app/assets/images/Bongos.png"),
  cajon: require("../../app/assets/images/Cajon.png"),
  chime: require("../../app/assets/images/Chime.png"),
  congas: require("../../app/assets/images/Congas.png"),
  djembe: require("../../app/assets/images/Djembe.png"),
  tambourine: require("../../app/assets/images/Tambourine.png"),
  star: require("../../app/assets/images/star.png"),
  circle: require("../../app/assets/images/circle.png"),
  rectangleH: require("../../app/assets/images/Rectangle_H.png"),
  rectangleV: require("../../app/assets/images/Rectangle_V.png"),
  hiHat: require("../../app/assets/images/hi_hat.png"),
  cymbal: require("../../app/assets/images/cymbal.png"),
  line: require("../../app/assets/images/line.png"),
  kickDrum: require("../../app/assets/images/Kick_drum.png"),
} as const;

export type IconAssetId = keyof typeof ICON_ASSETS;

export const resolveIconSource = (icon?: {
  assetId?: IconAssetId | null;
  source?: IconSource | null;
}): IconSource | undefined => {
  if (!icon) return undefined;
  if (icon.assetId && ICON_ASSETS[icon.assetId]) {
    return ICON_ASSETS[icon.assetId];
  }
  return icon.source ?? undefined;
};
