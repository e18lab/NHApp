import { Platform } from "react-native";
export function scrollToTop(scrollRef?: React.RefObject<any> | null) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (document.documentElement) {
        document.documentElement.scrollTop = 0;
      }
      if (document.body) {
        document.body.scrollTop = 0;
      }
    }
  }
  if (scrollRef?.current) {
    const node = scrollRef.current;
    try {
      if (node.scrollToOffset) {
        node.scrollToOffset({ offset: 0, animated: true });
      } else if (node.scrollToLocation) {
        node.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true });
      } else if (node.scrollTo) {
        node.scrollTo({ y: 0, animated: true });
      } else if (typeof node === "function") {
        node({ offset: 0, animated: true });
      } else if (Platform.OS === "web" && typeof (node as any).scrollTop !== "undefined") {
        (node as any).scrollTop = 0;
      }
    } catch (error) {
      try {
        if (node.scrollToOffset) {
          node.scrollToOffset({ offset: 0, animated: false });
        } else if (node.scrollToLocation) {
          node.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: false });
        } else if (node.scrollTo) {
          node.scrollTo({ y: 0, animated: false });
        } else if (Platform.OS === "web" && typeof (node as any).scrollTop !== "undefined") {
          (node as any).scrollTop = 0;
        }
      } catch (fallbackError) {
        console.warn("Failed to scroll to top:", fallbackError);
      }
    }
  }
}