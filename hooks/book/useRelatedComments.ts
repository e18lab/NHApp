import type { Book } from "@/api/nhentai";
import { GalleryComment, getComments, getRelatedBooks } from "@/api/nhentai";
import { useCallback, useEffect, useState } from "react";
import { InteractionManager } from "react-native";

export const useRelatedComments = (book: Book | null) => {
  const [related, setRelated] = useState<Book[]>([]);
  const [relLoading, setRelLoading] = useState(false);

  const [allComments, setAllComments] = useState<GalleryComment[]>([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [cmtLoading, setCmtLoading] = useState(false);

  const refetchRelated = useCallback(async () => {
    if (!book) {
      console.log("[useRelatedComments] No book, skipping related fetch");
      return;
    }
    
    // Проверяем, что это не офлайн книга (офлайн книги могут не иметь всех данных)
    if (!book.id || book.id <= 0) {
      console.log("[useRelatedComments] Invalid book ID, skipping related fetch");
      setRelated([]);
      return;
    }
    
    try {
      setRelLoading(true);
      console.log(`[useRelatedComments] Fetching related books for ${book.id}`);
      const r = await getRelatedBooks(book.id);
      console.log(`[useRelatedComments] Got ${r.books.length} related books`);
      setRelated(r.books.slice(0, 5));
    } catch (err: any) {
      // Если это Cloudflare challenge, не логируем как ошибку, просто возвращаем пустой массив
      if (err?.message?.includes('Cloudflare') || err?.response?.data?.error?.includes('Cloudflare')) {
        console.warn("[useRelatedComments] Cloudflare challenge, skipping related books");
      } else {
        console.error("[useRelatedComments] Error fetching related books:", err?.message || err);
      }
      setRelated([]);
    } finally {
      setRelLoading(false);
    }
  }, [book?.id]);

  const refetchComments = useCallback(async () => {
    if (!book) {
      console.log("[useRelatedComments] No book, skipping comments fetch");
      return;
    }
    
    // Проверяем, что это не офлайн книга (офлайн книги могут не иметь всех данных)
    if (!book.id || book.id <= 0) {
      console.log("[useRelatedComments] Invalid book ID, skipping comments fetch");
      setAllComments([]);
      setVisibleCount(0);
      return;
    }
    
    try {
      setCmtLoading(true);
      console.log(`[useRelatedComments] Fetching comments for ${book.id}`);
      const cs = await getComments(book.id);
      console.log(`[useRelatedComments] Got ${cs.length} comments`);
      setAllComments(cs);
      setVisibleCount(20);
    } catch (err: any) {
      // Если это Cloudflare challenge, не логируем как ошибку, просто возвращаем пустой массив
      if (err?.message?.includes('Cloudflare') || err?.response?.data?.error?.includes('Cloudflare')) {
        console.warn("[useRelatedComments] Cloudflare challenge, skipping comments");
      } else {
        console.error("[useRelatedComments] Error fetching comments:", err?.message || err);
      }
      setAllComments([]);
      setVisibleCount(0);
    } finally {
      setCmtLoading(false);
    }
  }, [book?.id]);

  useEffect(() => {
    if (!book) {
      console.log("[useRelatedComments] No book in effect, clearing state");
      setRelated([]);
      setAllComments([]);
      return;
    }
    
    console.log(`[useRelatedComments] Book changed to ${book.id}, fetching related and comments`);
    
    // Используем небольшой таймаут для Electron, чтобы убедиться, что компонент готов
    const timeoutId = setTimeout(() => {
      refetchRelated();
      refetchComments();
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id]); // Зависим только от book.id, функции стабильны благодаря useCallback

  return {
    related,
    relLoading,
    refetchRelated,
    allComments,
    visibleCount,
    setVisibleCount,
    cmtLoading,
    refetchComments,
  };
};
