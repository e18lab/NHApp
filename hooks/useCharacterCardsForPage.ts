import { useCallback, useEffect, useState } from "react";
import {
    CharacterCardForPage,
    getCharacterCardsForPage,
    getCharactersWithCards,
} from "../api/characterCards";
export interface UseCharacterCardsForPageParams {
  bookExternalId: number;
  pageIndex: number;
  allCharacterNames: string[];
}
export interface UseCharacterCardsForPageResult {
  cards: CharacterCardForPage[];
  charactersWithCards: string[];
  canAddMoreCards: boolean;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}
export function useCharacterCardsForPage(
  params: UseCharacterCardsForPageParams
): UseCharacterCardsForPageResult {
  const { bookExternalId, pageIndex, allCharacterNames } = params;
  const [cards, setCards] = useState<CharacterCardForPage[]>([]);
  const [charactersWithCards, setCharactersWithCards] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!bookExternalId && bookExternalId !== 0) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [pageCards, characters] = await Promise.all([
        getCharacterCardsForPage(bookExternalId, pageIndex),
        getCharactersWithCards(bookExternalId),
      ]);
      setCards(pageCards);
      setCharactersWithCards(characters);
    } catch (err: any) {
      setError(err?.message ?? "Не удалось загрузить карточки персонажей");
    } finally {
      setLoading(false);
    }
  }, [bookExternalId, pageIndex]);
  useEffect(() => {
    load();
  }, [load]);
  const canAddMoreCards = allCharacterNames.some(
    (name) => !charactersWithCards.includes(name)
  );
  return {
    cards,
    charactersWithCards,
    canAddMoreCards,
    loading,
    error,
    reload: load,
  };
}
