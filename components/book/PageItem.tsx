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
    onPress,
    showBackground = false,
  }: {
    page: { page: number; url: string; urlThumb?: string; width: number; height: number };
    itemW: number;
    cols: number;
    metaColor: string;
    onPress: () => void;
    showBackground?: boolean;
  }) {
    const isGrid = cols > 1;

    // Вычисляем aspect ratio изображения
    const aspectRatio = page.width / page.height;

    // Определяем, является ли изображение вертикальным
    const isVertical = page.height > page.width;

    // Определяем, является ли изображение супер длинным (например, манхва с очень высокой страницей)
    // Ограничиваем максимальную высоту только для изображений, где высота > 3 * ширина
    const isSuperLong = isVertical && page.height > page.width * 3;

    // Для супер длинных изображений ограничиваем максимальную высоту
    // В grid режиме: 2.5 * ширина элемента
    // В одиночном режиме: 2.5 * ширина элемента
    const maxHeight = isSuperLong ? itemW * 2.5 : undefined;

    // Вычисляем высоту изображения с учетом aspect ratio
    // Для grid и обычного режима используем одинаковую логику: полная высота с ограничением для супер длинных
    const imageHeight = maxHeight
      ? Math.min(itemW / aspectRatio, maxHeight)
      : itemW / aspectRatio;

    // Минимальная высота контейнера
    // Для всех режимов теперь используем imageHeight, чтобы видеть всё изображение
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
          onPress={onPress}
          style={{
            width: "100%",
            // В сетке растягиваем контейнер до высоты самого высокого элемента в строке
            // НО всегда задаем minHeight для предотвращения изменения размера при загрузке
            flex: isGrid ? 1 : undefined,
            minHeight: containerHeight,
            height: containerHeight, // Фиксированная высота для стабильности прокрутки
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            borderRadius: 10,
            overflow: "hidden",
            backgroundColor: "rgba(20, 20, 20, 0.8)", // Темный фон для предотвращения пустых мест
          }}
        >
          {/* Основное изображение поверх фона */}
          <ExpoImage
            source={{ uri: page.url }}
            style={{
              width: itemW,
              height: imageHeight,
              zIndex: 1,
            }}
            contentFit="contain"
            cachePolicy="disk"
            // Предотвращаем изменение размера контейнера при загрузке
            responsivePolicy="static"
            // Приоритет загрузки для видимых элементов
            priority="normal"
          />
        </Pressable>

        {/* Номер страницы ВСЕГДА под контейнером */}
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
    a.page.url === b.page.url &&
    a.page.urlThumb === b.page.urlThumb &&
    a.page.page === b.page.page &&
    a.itemW === b.itemW &&
    a.cols === b.cols &&
    a.metaColor === b.metaColor &&
    a.showBackground === b.showBackground
);

export default PageItem;
