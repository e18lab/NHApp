import AsyncStorage from "@react-native-async-storage/async-storage";
import * as NavigationBar from "expo-navigation-bar";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Drawer } from "react-native-drawer-layout";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { DrawerContext } from "@/components/DrawerContext";
import { OverlayPortalProvider } from "@/components/OverlayPortal";
import { SearchBar } from "@/components/SearchBar";
import SideMenu from "@/components/SideMenu";
import { getGridConfigMap } from "@/config/gridConfig";
import { SortProvider } from "@/context/SortContext";
import { TagProvider } from "@/context/TagFilterContext";
import { TagLibraryProvider } from "@/context/TagLibraryContext";
import { ThemeProvider, useTheme } from "@/lib/ThemeContext";
import { I18nProvider } from "@/lib/i18n/I18nContext";

import { DateRangeProvider } from "@/context/DateRangeContext";
import { enableFreeze } from "react-native-screens";
enableFreeze(true);

const FS_KEY = "ui_fullscreen";

const TopChrome = React.memo(function TopChrome({ bg }: { bg: string }) {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.top, backgroundColor: bg }} />;
});

const StatusBarController = React.memo(function StatusBarController({
  fullscreen,
  hasDimModal,
  bg,
}: {
  fullscreen: boolean;
  hasDimModal: boolean;
  bg: string;
}) {
  const effectiveBg = fullscreen || hasDimModal ? "transparent" : bg;
  return (
    <StatusBar
      hidden={fullscreen}
      translucent
      style="light"
      backgroundColor={effectiveBg}
    />
  );
});

export default function RootLayout() {
  return (
    <DateRangeProvider>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <AppContent />
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </DateRangeProvider>
  );
}

function AppContent() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [hasDimModal, setHasDimModal] = useState(false);
  const [gridReady, setGridReady] = useState(false);

  const pathname = usePathname();
  const { colors } = useTheme();

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const drawerCtxValue = useMemo(() => ({ openDrawer }), [openDrawer]);

  useEffect(() => {
    (globalThis as any).__setFullscreen = (v: boolean) => setFullscreen(v);
    (globalThis as any).__setHasDimModal = (v: boolean) => setHasDimModal(v);
    return () => {
      delete (globalThis as any).__setFullscreen;
      delete (globalThis as any).__setHasDimModal;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FS_KEY);
        setFullscreen(raw === "true");
      } catch {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(FS_KEY, fullscreen ? "true" : "false").catch(() => {});
  }, [fullscreen]);

  useEffect(() => {
    let alive = true;
    getGridConfigMap()
      .catch(() => {})
      .finally(() => {
        if (alive) setGridReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const showSearchBar = useMemo(() => {
    const blocked = pathname === "/read" || pathname === "/search";
    return !blocked;
  }, [pathname]);

  useEffect(() => {
    (async () => {
      try {
        if (fullscreen) {
          await Promise.all([
            NavigationBar.setVisibilityAsync("hidden"),
            NavigationBar.setButtonStyleAsync("light"),
          ]);
        } else {
          await Promise.all([
            NavigationBar.setVisibilityAsync("visible"),
            NavigationBar.setButtonStyleAsync("light"),
          ]);
        }
      } catch (e) {
        console.warn("[layout] expo-navigation-bar failed:", e);
      }
    })();
  }, [fullscreen]);

  const renderDrawer = useCallback(
    () => <SideMenu closeDrawer={closeDrawer} fullscreen={fullscreen} />,
    [closeDrawer, fullscreen]
  );

  const drawerContentEl = useMemo(
    () => <SideMenu closeDrawer={closeDrawer} fullscreen={fullscreen} />,
    [closeDrawer, fullscreen]
  );

  if (!gridReady) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBarController
        fullscreen={fullscreen}
        hasDimModal={hasDimModal}
        bg={colors.searchBg}
      />

      <SafeAreaView
        edges={fullscreen ? [] : ["bottom"]}
        style={{ flex: 1, backgroundColor: colors.bg }}
      >
        <Drawer
          open={drawerOpen}
          onOpen={openDrawer}
          onClose={closeDrawer}
          drawerPosition="left"
          drawerStyle={{ width: 260, backgroundColor: colors.menuBg }}
          drawerType="front"
          swipeEnabled={false}
          renderDrawerContent={() => drawerContentEl}
        >
          {!fullscreen && (
            <TopChrome bg={hasDimModal ? "transparent" : colors.searchBg} />
          )}

          <DrawerContext.Provider value={drawerCtxValue}>
            <SortProvider>
              <TagLibraryProvider>
                <TagProvider>
                  <OverlayPortalProvider>
                    {showSearchBar ? (
                      <View style={{ backgroundColor: colors.searchBg }}>
                        <SearchBar />
                      </View>
                    ) : null}

                    <Stack
                      screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: colors.bg },
                        animation: "simple_push",
                        freezeOnBlur: true,
                      }}
                    >
                      <Stack.Screen name="index" />
                      <Stack.Screen name="search" />
                      <Stack.Screen name="favorites" />
                      <Stack.Screen name="favoritesOnline" />
                      <Stack.Screen name="explore" />
                      <Stack.Screen name="book/[id]" />
                      <Stack.Screen name="profile/[id]/[slug]" />
                      <Stack.Screen name="read" />
                      <Stack.Screen name="downloaded" />
                      <Stack.Screen name="recommendations" />
                      <Stack.Screen name="tags/index" />
                      <Stack.Screen name="settings/index" />
                      <Stack.Screen name="+not-found" />
                    </Stack>
                  </OverlayPortalProvider>
                </TagProvider>
              </TagLibraryProvider>
            </SortProvider>
          </DrawerContext.Provider>
        </Drawer>
      </SafeAreaView>
    </View>
  );
}
