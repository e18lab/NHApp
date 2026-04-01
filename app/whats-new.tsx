import { WhatsNewNotesContent } from "@/components/WhatsNewModal";
import { useTheme } from "@/lib/ThemeContext";
import { getPendingWhatsNew } from "@/store/pendingWhatsNew";
import { Stack, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

export default function WhatsNewScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const update = getPendingWhatsNew();

  useEffect(() => {
    if (!update) router.back();
  }, [update, router]);

  if (!update) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <WhatsNewNotesContent notes={update.notes} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
});
