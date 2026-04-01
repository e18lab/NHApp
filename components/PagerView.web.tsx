import React, { ReactNode } from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';

type PagerViewProps = {
  children: ReactNode;
  style?: any;
  initialPage?: number;
  orientation?: 'horizontal' | 'vertical';
  onPageSelected?: (e: { nativeEvent: { position: number } }) => void;
  scrollEnabled?: boolean;
  ref?: any;
};


export default React.forwardRef<any, PagerViewProps>(function PagerView(
  { children, style, initialPage = 0, orientation = 'horizontal', onPageSelected, scrollEnabled = true },
  ref
) {
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = React.useState(initialPage);
  const childrenArray = React.Children.toArray(children);
  const { width, height } = useWindowDimensions();
  const pageSize = orientation === 'horizontal' ? width : height;

  React.useImperativeHandle(ref, () => ({
    setPage: (index: number) => {
      const targetIndex = Math.max(0, Math.min(childrenArray.length - 1, index));
      setCurrentPage(targetIndex);
      scrollViewRef.current?.scrollTo({
        x: orientation === 'horizontal' ? targetIndex * width : 0,
        y: orientation === 'vertical' ? targetIndex * height : 0,
        animated: true,
      });
      onPageSelected?.({ nativeEvent: { position: targetIndex } });
    },
  }));

  React.useEffect(() => {
    if (initialPage !== currentPage && initialPage >= 0 && initialPage < childrenArray.length) {
      scrollViewRef.current?.scrollTo({
        x: orientation === 'horizontal' ? initialPage * width : 0,
        y: orientation === 'vertical' ? initialPage * height : 0,
        animated: false,
      });
      setCurrentPage(initialPage);
    }
  }, [initialPage, width, height, orientation, childrenArray.length]);

  const handleScroll = (event: any) => {
    if (!scrollEnabled) return;
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const pageSize = orientation === 'horizontal' ? layoutMeasurement.width : layoutMeasurement.height;
    const offset = orientation === 'horizontal' ? contentOffset.x : contentOffset.y;
    const newPage = Math.round(offset / pageSize);
    if (newPage !== currentPage && newPage >= 0 && newPage < childrenArray.length) {
      setCurrentPage(newPage);
      onPageSelected?.({ nativeEvent: { position: newPage } });
    }
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal={orientation === 'horizontal'}
      pagingEnabled
      scrollEnabled={scrollEnabled}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={[styles.container, style]}
      contentContainerStyle={[
        styles.contentContainer,
        orientation === 'horizontal' 
          ? { width: childrenArray.length * width }
          : { height: childrenArray.length * height }
      ]}
    >
      {React.Children.map(children, (child, index) => (
        <View
          key={index}
          style={[
            styles.page,
            orientation === 'horizontal' 
              ? { width }
              : { height }
          ]}
        >
          {child}
        </View>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  page: {
    flex: 1,
  },
});
