import { Redirect } from "expo-router";
import React from "react";
import "react-native-gesture-handler";

export default function Index() {
  return <Redirect href={"/(tabs)"} />;
}
