import AsyncStorage from "@react-native-async-storage/async-storage";
import * as NavigationBar from "expo-navigation-bar";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { Drawer } from "react-native-drawer-layout";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import "@/background/autoImport.task";
import { DrawerContext } from "@/components/DrawerContext";
import { OverlayPortalProvider } from "@/components/OverlayPortal";
import { SearchBar } from "@/components/SearchBar";
import SideMenu from "@/components/SideMenu";
import { getGridConfigMap } from "@/config/gridConfig";
import AutoImportProvider from "@/context/AutoImportProvider";
import { DateRangeProvider } from "@/context/DateRangeContext";
import { SortProvider } from "@/context/SortContext";
import { TagProvider } from "@/context/TagFilterContext";
import { TagLibraryProvider } from "@/context/TagLibraryContext";
import { ThemeProvider, useTheme } from "@/lib/ThemeContext";
import { I18nProvider } from "@/lib/i18n/I18nContext";

import { enableFreeze, enableScreens } from "react-native-screens";
enableScreens(true);
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

function AppShell() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();

  const isTablet = Math.min(width, height) >= 600;
  const isLandscape = width > height;
  const isTabletPermanent = isTablet && isLandscape;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasDimModal, setHasDimModal] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const drawerCtxValue = useMemo(() => ({ openDrawer }), [openDrawer]);

  const [fullscreen, setFullscreen] = useState<boolean>(false);

  const [menuCollapsed, setMenuCollapsed] = useState(false);

  const drawerContentEl = useMemo(
    () => (
      <SideMenu
        closeDrawer={closeDrawer}
        fullscreen={fullscreen}
        isTabletPermanent={isTabletPermanent}
        collapsed={menuCollapsed}
        onToggleCollapsed={() => setMenuCollapsed((v) => !v)}
      />
    ),
    [closeDrawer, fullscreen, isTabletPermanent, menuCollapsed]
  );
  const renderDrawerContent = useCallback(() => drawerContentEl, [
    drawerContentEl,
  ]);

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

  const drawerWidth = isTabletPermanent ? (menuCollapsed ? 80 : 300) : 300;

  return (
    <SafeAreaView
      edges={fullscreen ? [] : ["bottom"]}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      {!fullscreen && (
        <TopChrome bg={hasDimModal ? "transparent" : colors.searchBg} />
      )}

      <DrawerContext.Provider value={drawerCtxValue}>
        <OverlayPortalProvider>
          <StatusBarController
            fullscreen={fullscreen}
            hasDimModal={hasDimModal}
            bg={colors.searchBg}
          />

          <Drawer
            open={drawerOpen}
            onOpen={openDrawer}
            onClose={closeDrawer}
            drawerPosition="left"
            drawerStyle={{
              width: drawerWidth,
              backgroundColor: colors.menuBg,
              marginBottom: 0,
            }}
            drawerType="back"
            swipeEnabled={false}
            renderDrawerContent={renderDrawerContent}
          >
            <View style={{ flex: 1, backgroundColor: colors.bg }}>
              <AppContent />
            </View>
          </Drawer>
        </OverlayPortalProvider>
      </DrawerContext.Provider>
    </SafeAreaView>
  );
}

function AppContent() {
  const [gridReady, setGridReady] = useState(false);
  const pathname = usePathname();
  const { colors } = useTheme();

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

  if (!gridReady) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <>
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
        <Stack.Screen name="read-electron" />
        <Stack.Screen name="downloaded" />
        <Stack.Screen name="recommendations" />
        <Stack.Screen name="tags/index" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AutoImportProvider>
      <ThemeProvider>
        <I18nProvider>
          <DateRangeProvider>
            <SafeAreaProvider>
              <SortProvider>
                <TagProvider>
                  <TagLibraryProvider>
                    <AppShell />
                  </TagLibraryProvider>
                </TagProvider>
              </SortProvider>
            </SafeAreaProvider>
          </DateRangeProvider>
        </I18nProvider>
      </ThemeProvider>
    </AutoImportProvider>
  );
}
