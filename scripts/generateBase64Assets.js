#!/usr/bin/env node
/**
 * Generate base64-encoded icon assets for PDF export in production APK.
 * Run: node scripts/generateBase64Assets.js
 * Output: src/utils/iconBase64Assets.ts
 */

const fs = require("fs");
const path = require("path");

const ASSETS_DIR = path.join(__dirname, "../app/assets/images");
const OUTPUT_FILE = path.join(__dirname, "../src/utils/iconBase64Assets.ts");

// Icons we want to embed (those used in PDFs)
const ICONS_TO_EMBED = {
  acousticGuitar: "Acoustic_guitar.png",
  drumKit: "Drum_set.png",
  saxaphone: "Saxaphone.png",
  bassGuitar: "Bass_guitar.png",
  doubleBass: "Double_bass.png",
  electricGuitar: "Electric_guitar.png",
  grandPiano: "Grand_piano.png",
  keyboard: "Keyboard.png",
  microphone: "Microphone.png",
  speaker: "Speaker.png",
  trumpet: "Trumpet.png",
  squareStage: "Square_stage.png",
  accordian: "Accordian.png",
  amplifier: "Amplifier.png",
  amplifier_2: "Amplifier_2.png",
  clarinet: "Clarinet.png",
  condenser_mic: "Condenser_mic.png",
  flute: "Flute.png",
  kick_mic: "Kick_mic.png",
  music_stand: "Music_stand.png",
  power_outlet: "Power_outlet.png",
  upright_piano: "Upright_piano.png",
  marimba: "Marimba.png",
  bongos: "Bongos.png",
  cajon: "Cajon.png",
  chime: "Chime.png",
  congas: "Congas.png",
  djembe: "Djembe.png",
  tambourine: "Tambourine.png",
  star: "star.png",
  circle: "circle.png",
  rectangleH: "Rectangle_H.png",
  rectangleV: "Rectangle_V.png",
  kickDrum: "Kick_drum.png",
  line: "line.png",
  hiHat: "hi_hat.png",
  cymbal: "cymbal.png",
  violin: "Violin.png",
  cello: "Cello.png",
  trombone: "Trombone.png",
  tuba: "Tuba.png",
};

function generateBase64Assets() {
  const base64Map = {};
  let successCount = 0;
  let failCount = 0;

  console.log(`Reading images from: ${ASSETS_DIR}`);

  for (const [assetId, fileName] of Object.entries(ICONS_TO_EMBED)) {
    const filePath = path.join(ASSETS_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${fileName}`);
      failCount++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString("base64");
      base64Map[assetId] = `data:image/png;base64,${base64}`;
      successCount++;
    } catch (err) {
      console.error(`Failed to read ${fileName}:`, err.message);
      failCount++;
    }
  }

  console.log(
    `Successfully embedded ${successCount} icons (${failCount} failed)`,
  );

  // Generate TypeScript file
  const tsContent = `// Auto-generated base64 icon assets for PDF export in production APK
// Generated: ${new Date().toISOString()}
// Run: node scripts/generateBase64Assets.js

export const ICON_BASE64_ASSETS = {
${Object.entries(base64Map)
  .map(([key, value]) => `  ${key}: "${value}",`)
  .join("\n")}
} as const;

export type IconAssetId = keyof typeof ICON_BASE64_ASSETS;

/**
 * Get a base64 data URI for an icon asset ID.
 * Safe for use in PDF generation without file system dependencies.
 */
export function getIconBase64(assetId: IconAssetId | string): string | null {
  if (assetId in ICON_BASE64_ASSETS) {
    return ICON_BASE64_ASSETS[assetId as IconAssetId];
  }
  return null;
}
`;

  try {
    fs.writeFileSync(OUTPUT_FILE, tsContent, "utf-8");
    console.log(`Generated: ${OUTPUT_FILE}`);
  } catch (err) {
    console.error(`Failed to write output file:`, err.message);
    process.exit(1);
  }
}

generateBase64Assets();
