import { httpClient } from "./httpClient";
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export type CharacterCardDto = {
  id: number;
  pageIndex: number;
  imageUrl: string;
  rect: Rect;
  characterName: string;
  parodyName: string | null;
};
export type CharacterCardForPage = CharacterCardDto;
export type CreateCharacterCardPayload = {
  characterName: string;
  parodyName: string | null;
  imageUrl: string;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  userId: number;
};
export type UpdateCharacterCardPayload = {
  characterName: string;
  parodyName: string | null;
  imageUrl: string;
  rect: Rect;
  userId?: number;
};
export async function getCharactersWithCards(
  bookExternalId: number
): Promise<string[]> {
  const res = await httpClient.get<{ characters: string[] }>(
    `/api/books/${bookExternalId}/character-cards/characters`
  );
  return res.characters ?? [];
}
export async function getCharacterCardsForPage(
  bookExternalId: number,
  pageIndex: number
): Promise<CharacterCardDto[]> {
  const res = await httpClient.get<{ cards: CharacterCardDto[] }>(
    `/api/books/${bookExternalId}/pages/${pageIndex}/character-cards`
  );
  return res.cards ?? [];
}
export async function createCharacterCard(
  bookExternalId: number,
  pageIndex: number,
  payload: CreateCharacterCardPayload
): Promise<CharacterCardDto> {
  const res = await httpClient.post<{ card: CharacterCardDto }>(
    `/api/books/${bookExternalId}/pages/${pageIndex}/character-cards`,
    {
      characterName: payload.characterName,
      parodyName: payload.parodyName,
      imageUrl: payload.imageUrl,
      cropX: payload.cropX,
      cropY: payload.cropY,
      cropWidth: payload.cropWidth,
      cropHeight: payload.cropHeight,
      userId: payload.userId,
      user_id: payload.userId,
    }
  );
  return res.card;
}
export async function updateCharacterCard(
  id: number,
  payload: UpdateCharacterCardPayload
): Promise<{ card: CharacterCardDto }> {
  const body: any = {
    characterName: payload.characterName,
    parodyName: payload.parodyName,
    imageUrl: payload.imageUrl,
    cropX: payload.rect.x,
    cropY: payload.rect.y,
    cropWidth: payload.rect.width,
    cropHeight: payload.rect.height,
  };
  if (typeof payload.userId === "number") {
    body.userId = payload.userId;
    body.user_id = payload.userId;
  }
  console.log("[CHAR-CARD PATCH] body =>", JSON.stringify(body, null, 2));
  return httpClient.patch<{ card: CharacterCardDto }>(
    `/api/character-cards/${id}`,
    body
  );
}
const characterCardCache = new Map<string, CharacterCardDto | null>();
export async function getGlobalCharacterCardForCharacter(
  characterName: string
): Promise<CharacterCardDto | null> {
  const key = characterName;
  if (characterCardCache.has(key)) {
    return characterCardCache.get(key) ?? null;
  }
  const res = await httpClient.get<{ card: CharacterCardDto | null }>(
    `/api/characters/${encodeURIComponent(characterName)}/character-card`
  );
  const card = res.card ?? null;
  characterCardCache.set(key, card);
  return card;
}
export async function deleteCharacterCard(
  id: number,
  userId?: number
): Promise<void> {
  const query =
    typeof userId === "number" ? `?userId=${userId}&user_id=${userId}` : "";
  await httpClient.delete(`/api/character-cards/${id}${query}`);
}
export type CharacterCatalogItemDto = {
  characterName: string;
  parodyName: string | null;
  cardsCount: number;
  imageUrl: string | null;
  rect: Rect | null;
  userId: number | null;
  userName: string | null;
  cardId: number | null;
  bookExternalId: number | null;
};
export async function getCharacterCatalog(): Promise<
  CharacterCatalogItemDto[]
> {
  const res = await httpClient.get<{ items: CharacterCatalogItemDto[] }>(
    "/api/character-cards/catalog"
  );
  return res.items ?? [];
}
