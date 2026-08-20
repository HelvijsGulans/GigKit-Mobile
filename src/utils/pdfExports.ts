import { RiderItem } from "@/app/screens/rider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { IconSource } from "./iconAssets";
import { resolveIconSource } from "./iconAssets";
import { getIconBase64 } from "./iconBase64Assets";
import type { Event as RiderEvent, Icon as StageIcon } from "./ridersHelpers";

type PdfEvent = RiderEvent & {
  requirements?: RiderItem[];
  stageIcons?: StageIcon[];
};

const PDF_WIDTH_POINTS = 595;
const PDF_HEIGHT_POINTS = 842;

const STAGE_PAGE_MARGIN_PT = 20;
const STAGE_TITLE_OFFSET = 60;
const AVAILABLE_STAGE_WIDTH = PDF_WIDTH_POINTS - STAGE_PAGE_MARGIN_PT * 2;
// Match the scale to the available stage canvas area.
const AVAILABLE_STAGE_HEIGHT =
  PDF_HEIGHT_POINTS - STAGE_PAGE_MARGIN_PT * 2 - STAGE_TITLE_OFFSET;

const STAGE_WRAPPER_SIZE = 60;
const STAGE_WRAPPER_OFFSET = 5;
const DEFAULT_STAGE_WIDTH = 595;
const DEFAULT_STAGE_HEIGHT = 842;

// Keep these values and calculations in sync with StagePlanModal.
const TEXT_BOX_PADDING = 6;
const MIN_TEXT_FONT_SIZE = 4;
const MAX_TEXT_FONT_SIZE = 96;

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

const EXPORT_SETTINGS_KEY = "@gigkit_export_settings_v1";
const EXPORT_PEOPLE_KEY = "@gigkit_export_people_v1";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const resolveStageLayout = (layout?: RiderEvent["stageLayout"]) => {
  const width =
    layout?.width && layout.width > 0 ? layout.width : DEFAULT_STAGE_WIDTH;
  const height =
    layout?.height && layout.height > 0 ? layout.height : DEFAULT_STAGE_HEIGHT;

  return { width, height };
};

const calculateStageScale = (width: number, height: number) => {
  if (width <= 0 || height <= 0) {
    return {
      scale: 1,
      scaledWidth: Math.min(AVAILABLE_STAGE_WIDTH, DEFAULT_STAGE_WIDTH),
      scaledHeight: Math.min(AVAILABLE_STAGE_HEIGHT, DEFAULT_STAGE_HEIGHT),
    };
  }

  const widthScale = AVAILABLE_STAGE_WIDTH / width;
  const heightScale = AVAILABLE_STAGE_HEIGHT / height;
  const scale = Math.min(widthScale, heightScale);

  return {
    scale,
    scaledWidth: width * scale,
    scaledHeight: height * scale,
  };
};

const renderRequirementList = (items?: RiderItem[]): string => {
  if (!items || items.length === 0) {
    return "<p>No requirements listed.</p>";
  }

  const renderList = (list: RiderItem[]): string => {
    const renderedItems = list
      .map((item) => {
        const childHtml =
          item.children && item.children.length > 0
            ? renderList(item.children)
            : "";
        const label = item.text?.trim() ?? "";

        if (!label && !childHtml) {
          return "";
        }

        if (!label) {
          return childHtml;
        }

        return `<li>${escapeHtml(label)}${childHtml}</li>`;
      })
      .filter(Boolean)
      .join("");

    return renderedItems ? `<ul>${renderedItems}</ul>` : "";
  };

  const html = renderList(items);
  return html || "<p>No requirements listed.</p>";
};

async function readExportConfig() {
  try {
    const [rawSettings, rawPeople] = await Promise.all([
      AsyncStorage.getItem(EXPORT_SETTINGS_KEY),
      AsyncStorage.getItem(EXPORT_PEOPLE_KEY),
    ]);
    let settings: any = null;
    if (rawSettings) settings = JSON.parse(rawSettings);
    const people: any[] = rawPeople ? JSON.parse(rawPeople) : [];
    return { settings, people };
  } catch (err) {
    console.error("Failed to read export config for PDF:", err);
    return { settings: null, people: [] };
  }
}

function renderContactsHtml(people: any[], settings: any) {
  if (!settings?.showContacts) return "";

  const selectedPeople = (people ?? []).filter((p) => p.selected === true);

  if (selectedPeople.length === 0) return "";

  const items = selectedPeople
    .map((p) => {
      const parts = [];
      if (p.role) parts.push(escapeHtml(p.role));
      if (p.phone) parts.push(escapeHtml(p.phone));
      if (p.email) {
        parts.push(
          `<a href="mailto:${escapeHtml(p.email)}">${escapeHtml(p.email)}</a>`,
        );
      }

      return `
      <div class="contact-line">
        <strong>${escapeHtml(p.name)}</strong>
        ${parts.length ? ` — ${parts.join(" • ")}` : ""}
      </div>
    `;
    })
    .join("");

  return `<div class="contacts-block">${items}</div>`;
}

const createEventsPdf = async (events: PdfEvent[]): Promise<string> => {
  if (events.length === 0) {
    throw new Error("No events provided");
  }

  function normalizeEventName(name: string): string {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
  }

  const normalizedEventName = normalizeEventName(events[0].eventName);

  async function getBase64(source?: IconSource | string): Promise<string> {
    const TRANSPARENT_PIXEL =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0EQVRYw2NgYAAAAAMAAj3rVz8AAAAASUVORK5CYII=";

    if (!source) return TRANSPARENT_PIXEL;

    try {
      // Support legacy string sources and React Native { uri } sources.
      const uri =
        typeof source === "string"
          ? source
          : typeof source === "object" &&
              !Array.isArray(source) &&
              "uri" in source &&
              typeof source.uri === "string"
            ? source.uri
            : undefined;

      if (uri?.startsWith("http")) {
        const tmp = `${FileSystem.cacheDirectory}${Date.now()}.png`;

        const download = await FileSystem.downloadAsync(uri, tmp);

        const b64 = await FileSystem.readAsStringAsync(download.uri, {
          encoding: "base64",
        });

        return `data:image/png;base64,${b64}`;
      }

      if (uri?.startsWith("file://")) {
        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: "base64",
        });

        return `data:image/png;base64,${b64}`;
      }

      if (typeof source === "number") {
        console.warn(
          "Bundled asset without assetId context, returning placeholder",
        );

        return TRANSPARENT_PIXEL;
      }
    } catch (e) {
      console.error("PDF Icon Load Failed:", e, "Source:", source);
    }

    return TRANSPARENT_PIXEL;
  }

  const { settings, people } = await readExportConfig();

  const htmlParts = await Promise.all(
    events.map(async (event) => {
      const requirementsHtml = renderRequirementList(event.requirements);

      const { width: stageWidth, height: stageHeight } = resolveStageLayout(
        event.stageLayout,
      );
      const {
        scale: stageScale,
        scaledWidth,
        scaledHeight,
      } = calculateStageScale(stageWidth, stageHeight);

      const stageIconsHtml = await Promise.all(
        (event.stageIcons ?? []).map(async (icon) => {
          const safeScale = icon.scale && icon.scale > 0 ? icon.scale : 1;
          const normalizedWidth =
            typeof icon.width === "number" && icon.width > 0
              ? icon.width
              : STAGE_WRAPPER_SIZE / stageWidth;
          const normalizedHeight =
            typeof icon.height === "number" && icon.height > 0
              ? icon.height
              : STAGE_WRAPPER_SIZE / stageHeight;

          const wrapperWidth = normalizedWidth * stageWidth * safeScale;
          const wrapperHeight = normalizedHeight * stageHeight * safeScale;

          const leftFraction =
            typeof icon.x === "number" && isFinite(icon.x) ? icon.x : 0;
          const topFraction =
            typeof icon.y === "number" && isFinite(icon.y) ? icon.y : 0;

          const wrapperLeft = leftFraction * stageWidth;
          const wrapperTop = topFraction * stageHeight;

          const pdfLeft = (wrapperLeft - STAGE_WRAPPER_OFFSET) * stageScale;
          const pdfTop = (wrapperTop - STAGE_WRAPPER_OFFSET) * stageScale;
          const pdfWidth = wrapperWidth * stageScale;
          const pdfHeight = wrapperHeight * stageScale;

          const rotationDeg = (icon as any).rotation ?? 0;

          if ((icon as any).isText) {
            const textLabel = (icon as any).label || "";
            const sourceContentWidth = Math.max(
              0,
              wrapperWidth - STAGE_WRAPPER_OFFSET * 2,
            );
            const sourceContentHeight = Math.max(
              0,
              wrapperHeight - STAGE_WRAPPER_OFFSET * 2,
            );
            const sourceFontSize = estimateTextFontSize(
              textLabel,
              sourceContentWidth,
              sourceContentHeight,
            );
            const pdfFontSize = sourceFontSize * stageScale;
            const pdfLineHeight = pdfFontSize * 1.2;
            const wrapperPadding = STAGE_WRAPPER_OFFSET * stageScale;
            const textPadding = TEXT_BOX_PADDING * stageScale;

            return `
              <div
                class="stage-icon-text"
                style="
                  left:${pdfLeft}pt;
                  top:${pdfTop}pt;
                  width:${pdfWidth}pt;
                  height:${pdfHeight}pt;
                  padding:${wrapperPadding}pt;
                  transform: rotate(${rotationDeg}deg);
                "
              >
                <div
                  class="text-inner-wrapper"
                  style="
                    font-size:${pdfFontSize}pt;
                    line-height:${pdfLineHeight}pt;
                    padding:${textPadding}pt;
                  "
                >${escapeHtml(textLabel)}</div>
              </div>
            `;
          }

          let base64 = icon.assetId ? getIconBase64(icon.assetId) : null;

          if (!base64) {
            base64 = await getBase64(resolveIconSource(icon));
          }

          const iconPadding = STAGE_WRAPPER_OFFSET * stageScale;

          return `
            <div
              class="stage-icon"
              style="
                left:${pdfLeft}pt;
                top:${pdfTop}pt;
                width:${pdfWidth}pt;
                height:${pdfHeight}pt;
                padding:${iconPadding}pt;
              "
            >
              <img
                src="${base64}"
                alt="stage icon"
                style="transform: rotate(${rotationDeg}deg);"
              />
            </div>
          `;
        }),
      );

      const formattedDate = new Date(event.date).toDateString();
      const contactsHtml = renderContactsHtml(people ?? [], settings);

      let contactInjectTopLeft = "";
      let contactInjectUnderTitle = "";
      let contactInjectBottom = "";

      if (contactsHtml) {
        const pos = settings?.contactPosition ?? "top-left";
        if (pos === "top-left") contactInjectTopLeft = contactsHtml;
        else if (pos === "under-title") contactInjectUnderTitle = contactsHtml;
        else contactInjectBottom = contactsHtml;
      }

      const technicalHeaderHtml =
        (settings?.showTechnicalHeader ?? true)
          ? `<div class="rider-title">Technical Rider</div>`
          : "";
      const brandHtml =
        (settings?.showBrand ?? true)
          ? `<div class="header-brand">GigKit</div>`
          : "";
      const dateHtml =
        (settings?.showDate ?? true)
          ? `<div class="header-date">${formattedDate}</div>`
          : "";

      return `
        <div class="page event-details-content">
          ${dateHtml}
          ${brandHtml}

          <h1>${escapeHtml(event.eventName)}</h1>

          ${
            contactInjectTopLeft
              ? `<div class="contact-top-left">${contactInjectTopLeft}</div>`
              : ""
          }

          ${contactInjectUnderTitle}

          <div class="event-venue">${escapeHtml(event.venue ?? "")}</div>

          <div class="divider"></div>

          ${technicalHeaderHtml}

          <div class="requirements">
            ${requirementsHtml}
          </div>

          ${
            contactInjectBottom
              ? `<div class="contact-bottom">${contactInjectBottom}</div>`
              : ""
          }
        </div>

        <div class="page stage-page">
          <div class="stage-title">Stage Plan</div>
          <div class="stage-canvas" style="width:${scaledWidth}pt;height:${scaledHeight}pt;">
            ${stageIconsHtml.join("")}
          </div>
        </div>
      `;
    }),
  );

  const htmlContent = `
<html>
<head>
  <meta charset="utf-8" />
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 portrait; margin: 0; }

    body {
      font-family: "Manrope", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      color: #000;
      background: #fff;
    }

    .page {
      width: ${PDF_WIDTH_POINTS}pt;
      margin: 0 auto;
      box-sizing: border-box;
      position: relative;
      background: #fff;
    }

    .event-details-content {
      min-height: ${PDF_HEIGHT_POINTS}pt;
      height: auto;
      padding: 46pt 54pt;
      overflow: visible;
      page-break-after: auto;
      break-after: auto;
      -webkit-box-decoration-break: clone;
      box-decoration-break: clone;
    }

    .header-date {
      position: absolute;
      top: 22pt;
      left: 40pt;
      font-size: 10pt;
      color: #666;
    }

    .header-brand {
      position: absolute;
      top: 22pt;
      right: 40pt;
      font-size: 11pt;
      font-weight: 600;
      letter-spacing: 0.4pt;
      color: #444;
      text-transform: uppercase;
    }

    .event-details-content h1 {
      text-align: center;
      margin: 52pt 0 6pt;
      font-size: 28pt;
      font-weight: 700;
      text-transform: none;
    }

    .event-venue {
      text-align: center;
      font-size: 14pt;
      color: #666;
      margin-bottom: 20pt;
    }

    .divider {
      width: 100%;
      height: 1px;
      background: #d0d0d0;
      margin: 8pt 0 24pt;
    }

    .requirements {
      font-size: 12.5pt;
      line-height: 1.45;
      text-align: left;
      orphans: 2;
      widows: 2;
    }

    .requirements p {
      margin: 0 0 12pt;
    }

    .requirements ul {
      margin: 6pt 0 0 22pt;
      padding: 0;
    }

    .requirements li {
      margin-bottom: 4pt;
    }
      
    .rider-title {
      text-align: center;
      font-size: 16pt;
      font-weight: 600;
      margin-bottom: 14pt;
      letter-spacing: 0.4pt;
      color: #333;
      text-transform: uppercase;
    }

    .contacts-block { font-size: 10.5pt; color: #222; margin-bottom: 8pt; }
    .contact-line { margin-bottom: 4pt; }
    .contact-top-left { position: absolute; left: 40pt; top: 40pt; width: 200pt; }
    .contact-bottom { margin-top: 24pt; }

    .stage-page {
      height: ${PDF_HEIGHT_POINTS}pt;
      overflow: hidden;
      page-break-before: always;
      break-before: page;
      page-break-after: always;
      break-after: page;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: ${STAGE_PAGE_MARGIN_PT}pt;
      gap: 12pt;
    }

    .stage-title {
      font-size: 18pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1pt;
      margin: 0;
      text-align: center;
    }

    .stage-canvas {
      position: relative;
      border: 2pt solid #000;
      background: #fff;
      box-sizing: border-box;
      overflow: hidden;
    }

    .stage-icon {
      position: absolute;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .stage-icon img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      transform-origin: center center;
    }

    .stage-icon-text {
      position: absolute;
      box-sizing: border-box;
      overflow: hidden;
      border-radius: 8pt;
      border: 1pt solid transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      transform-origin: center center;
    }

    .text-inner-wrapper {
      box-sizing: border-box;
      font-family: "Manrope", sans-serif;
      font-weight: bold;
      color: #000000;
      word-wrap: break-word;
      overflow-wrap: break-word;
      word-break: break-word;
      white-space: pre-wrap;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      max-width: 100%;
      overflow: hidden;
    }
</style>
</head>
<body>
  ${htmlParts.join("")}
</body>
</html>
`;

  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    const finalUri = `${FileSystem.documentDirectory}${normalizedEventName}.pdf`;

    await FileSystem.copyAsync({ from: uri, to: finalUri });
    await FileSystem.deleteAsync(uri, { idempotent: true });

    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(finalUri);

    return finalUri;
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
};

export default createEventsPdf;
