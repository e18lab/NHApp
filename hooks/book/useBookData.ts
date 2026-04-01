import { loadBookFromLocal } from "@/api/nhappApi/localBook";
import type { Book } from "@/api/nhappApi/types";
import { getGallery, initCdn } from "@/api/v2";
import { galleryToBook } from "@/api/v2/compat";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, ToastAndroid } from "react-native";

export const useBookData = (idNum: number) => {
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [local, setLocal] = useState(false);

  useEffect(() => {
    (async () => {
      const bLocal = await loadBookFromLocal(idNum);
      if (bLocal) {
        setBook(bLocal);
        setLocal(true);
        return;
      }
      try {
        await initCdn();
        const gallery = await getGallery(idNum, { include: ["comments", "related", "favorite"] });
        setBook(galleryToBook(gallery));
      } catch {
        if (Platform.OS === "android")
          ToastAndroid.show("Unable to load", ToastAndroid.LONG);
        router.back();
      }
    })();
  }, [idNum, router]);

  return { book, setBook, local, setLocal };
};
