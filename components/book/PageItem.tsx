import ExpoImage from "@/components/ExpoImageCompat";
import React, { memo } from "react";
import { Pressable, Text, View } from "react-native";

export const GAP = 10;

export const PageItem = memo(
  function PageItem({
    page,
    itemW,
    cols,
    metaColor,
    onOpenPage,
    showBackground = false,
  }: {
    page: { page: number; url: string; urlThumb?: string; width: number; height: number };
    itemW: number;
    cols: number;
    metaColor: string;
    /** Стабильная ссылка из useCallback — иначе memo ниже отрезает обновления router */
    onOpenPage: (pageNum: number) => void;
    showBackground?: boolean;
  }) {
    const isGrid = cols > 1;

    const aspectRatio = page.width / page.height;

    const isVertical = page.height > page.width;

    const isSuperLong = isVertical && page.height > page.width * 3;

    const maxHeight = isSuperLong ? itemW * 2.5 : undefined;

    const imageHeight = maxHeight
      ? Math.min(itemW / aspectRatio, maxHeight)
      : itemW / aspectRatio;

    const containerHeight = imageHeight;

    return (
      <View
        style={{
          width: itemW,
          marginBottom: GAP,
          marginHorizontal: isGrid ? GAP / 2 : 0,
          alignItems: "center",
          flex: isGrid ? 1 : undefined,
        }}
      >
        <Pressable
          onPress={() => onOpenPage(page.page)}
          style={{
            width: "100%",
            flex: isGrid ? 1 : undefined,
            minHeight: containerHeight,
            height: containerHeight, 
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            borderRadius: 10,
            overflow: "hidden",
            backgroundColor: "rgba(20, 20, 20, 0.8)", 
          }}
        >
          {}
          <ExpoImage
            source={{ uri: page.url }}
            style={{
              width: itemW,
              height: imageHeight,
              zIndex: 1,
            }}
            contentFit="contain"
            cachePolicy="disk"
            responsivePolicy="static"
            priority="normal"
          />
        </Pressable>

        {}
        <Text
          style={{
            color: metaColor,
            fontSize: 12,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          {page.page}
        </Text>
      </View>
    );
  },
  (a, b) =>
    a.onOpenPage === b.onOpenPage &&
    a.page.url === b.page.url &&
    a.page.urlThumb === b.page.urlThumb &&
    a.page.page === b.page.page &&
    a.itemW === b.itemW &&
    a.cols === b.cols &&
    a.metaColor === b.metaColor &&
    a.showBackground === b.showBackground
);

export default PageItem;
