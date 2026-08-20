declare module "react-native-vector-icons/Ionicons" {
  import { Icon } from "react-native-vector-icons/Icon";
  export default Icon;
}

declare module "react-native-html-to-pdf" {
  export interface Options {
    html: string;
    fileName: string;
    directory?: string;
    base64?: boolean;
  }

  export interface PDFResult {
    filePath: string;
    base64?: string;
  }

  export default class RNHTMLtoPDF {
    static convert(options: Options): Promise<PDFResult>;
  }
}
