module.exports = {
  expo: {
    name: "GigKit",
    slug: "gigkit",
    version: "1.4.0",
    orientation: "portrait",
    icon: "./app/assets/images/logo_white_bg.png",
    scheme: "gigkit",
    userInterfaceStyle: "automatic",
    jsEngine: "hermes",
    newArchEnabled: true,
    assetBundlePatterns: ["app/assets/images/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.helvijs.gigkit",
    },
    android: {
      package: "com.helvijs.gigkit",
      versionCode: 1,
      jsEngine: "hermes",
      adaptiveIcon: {
        foregroundImage: "./app/assets/images/logo_white_bg.png",
        backgroundColor: "#404040",
      },
      permissions: [],
      edgeToEdgeEnabled: true,
    },
    splash: {
      image: "./app/assets/images/logo_white_bg.png",
      resizeMode: "contain",
      backgroundColor: "#404040",
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./app/assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-font",
      "@react-native-community/datetimepicker",
      "expo-web-browser",
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 24,
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            buildToolsVersion: "36.0.0",
            enableWebViewPrinting: true,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "9b0a9e7d-6525-4c8c-8066-62be995d0ea7",
      },
      ENABLE_CLOUD_SYNC: process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC === "true",
      FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      FIREBASE_MESSAGING_SENDER_ID:
        process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      FIREBASE_MEASUREMENT_ID: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
      owner: "zevzs",
    },
  },
};
