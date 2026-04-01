import { requestStoragePush } from "@/api/nhappApi/cloudStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
const FAVORITES = "bookFavorites";
export const useFavorites = (currentId: number) => {
  const [favorites, setFav] = useState<Set<number>>(new Set());
  const [liked, setLiked] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(FAVORITES).then((j) => {
      const arr: number[] = j ? JSON.parse(j) : [];
      setFav(new Set(arr));
      setLiked(arr.includes(currentId));
    });
  }, [currentId]);
  const toggleFav = useCallback((bid: number, next: boolean) => {
    setFav((prev) => {
      const cp = new Set(prev);
      next ? cp.add(bid) : cp.delete(bid);
      AsyncStorage.setItem(FAVORITES, JSON.stringify([...cp]));
      if (bid === currentId) setLiked(next);
      return cp;
    });
  }, [currentId]);
  const toggleLike = useCallback(async () => {
    const j = await AsyncStorage.getItem(FAVORITES);
    const arr: number[] = j ? JSON.parse(j) : [];
    const nextArr = arr.includes(currentId)
      ? arr.filter((x) => x !== currentId)
      : [...arr, currentId];
    setLiked(!arr.includes(currentId));
    setFav(new Set(nextArr));
    await AsyncStorage.setItem(FAVORITES, JSON.stringify(nextArr));
    requestStoragePush();
  }, [currentId]);
  return { favorites, toggleFav, liked, toggleLike };
};
