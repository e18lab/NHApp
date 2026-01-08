import { useCallback, useRef, useState } from "react";
import { Animated, Easing, FlatList } from "react-native";

export const useFab = () => {
  const fabScale = useRef(new Animated.Value(0)).current;
  const fabVisibleRef = useRef(false);
  const listRef = useRef<FlatList>(null);
  const scrollY = useRef(0);
  const lastScrollY = useRef(0);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("down");
  const commentSectionY = useRef<number | null>(null);
  const contentHeight = useRef<number>(0);
  const scrollViewHeight = useRef<number>(0);

  const animateFab = useCallback(
    (show: boolean) => {
      if (fabVisibleRef.current === show) return;
      fabVisibleRef.current = show;
      Animated.timing(fabScale, {
        toValue: show ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    },
    [fabScale]
  );

  const onScroll = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const contentHeightValue = e.nativeEvent.contentSize.height;
    const scrollViewHeightValue = e.nativeEvent.layoutMeasurement.height;
    
    contentHeight.current = contentHeightValue;
    scrollViewHeight.current = scrollViewHeightValue;
    
    const dy = y - scrollY.current;
    const prevY = scrollY.current;
    scrollY.current = y;
    
    // Определяем направление прокрутки с учетом текущей позиции
    // Если мы в верхней части, всегда "down", если в нижней - смотрим направление
    const isNearTop = y < 200;
    const isNearBottom = y + scrollViewHeightValue > contentHeightValue - 200;
    
    if (Math.abs(dy) > 5) {
      let direction: "up" | "down";
      
      if (isNearTop) {
        direction = "down"; // Вверху - всегда вниз
      } else if (isNearBottom) {
        direction = "up"; // Внизу - всегда вверх
      } else {
        direction = dy > 0 ? "down" : "up"; // В середине - по направлению
      }
      
      if (direction !== scrollDirection) {
        setScrollDirection(direction);
      }
    }
    
    lastScrollY.current = prevY;
    
    // Показываем FAB когда прокрутили достаточно далеко
    if (y > 160) {
      animateFab(true);
    } else if (y < 100) {
      animateFab(false);
    }
  }, [scrollDirection, animateFab]);

  const scrollTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const scrollToComments = useCallback(() => {
    if (!listRef.current) return;
    
    // Прокручиваем в самый конец контента (где комментарии в footer)
    // Используем комбинацию scrollToEnd и scrollToOffset для надежности
    try {
      // Используем очень большое значение offset для гарантированной прокрутки в конец
      // FlatList автоматически ограничит его максимальным значением
      listRef.current.scrollToOffset({ 
        offset: 99999999, // Очень большое значение - прокрутит в самый конец
        animated: true 
      });
      
      // Дополнительная попытка через scrollToEnd для надежности
      setTimeout(() => {
        if (listRef.current) {
          try {
            listRef.current.scrollToEnd({ animated: true });
          } catch (e) {
            // Игнорируем ошибки scrollToEnd
          }
        }
      }, 100);
      
    } catch (err) {
      console.warn('[useFab] Error scrolling to comments:', err);
    }
  }, []);

  const handleFabPress = useCallback(() => {
    // Если прокручиваем вниз, идем к комментариям
    // Если прокручиваем вверх, идем наверх
    if (scrollDirection === "down") {
      scrollToComments();
    } else {
      scrollTop();
    }
  }, [scrollDirection, scrollTop, scrollToComments]);

  const setCommentSectionOffset = useCallback((offset: number) => {
    commentSectionY.current = offset;
  }, []);

  return { 
    fabScale, 
    onScroll, 
    scrollTop, 
    scrollToComments,
    handleFabPress,
    scrollDirection,
    listRef,
    setCommentSectionOffset,
  };
};

