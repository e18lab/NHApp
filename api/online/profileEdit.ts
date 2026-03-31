/**
 * nhentai profile edit: load edit form and submit.
 * Works on Electron (IPC) and native Android/iOS (HTTP with cookies).
 */

import { Platform } from "react-native";
import { NH_HOST, nhFetch } from "@/api/auth";
import { fetchHtml } from "./http";

const isElectron = () =>
  typeof window !== "undefined" && !!(window as any).electron?.isElectron;

const isNative = () => Platform.OS === "android" || Platform.OS === "ios";

export type ProfileEditFormData = {
  csrf: string;
  username: string;
  email: string;
  about: string;
  favorite_tags: string;
  theme: string;
  old_password?: string;
  new_password1?: string;
  new_password2?: string;
};

export type ProfileEditLoadResult =
  | { success: true; data: ProfileEditFormData }
  | { success: false; error: string; notLoggedIn?: boolean };

function parseProfileEditHtml(html: string): ProfileEditFormData {
  const getInput = (name: string) => {
    const re = new RegExp(
      `name=["']${name}["'][^>]*value=["']([^"']*)["']|value=["']([^"']*)["'][^>]*name=["']${name}["']`,
      "i"
    );
    const m = html.match(re);
    return m ? (m[1] || m[2] || "").trim() : "";
  };
  const getTextarea = (name: string) => {
    const re = new RegExp(
      `name=["']${name}["'][^>]*>([\\s\\S]*?)</textarea>`,
      "i"
    );
    const m = html.match(re);
    return m ? (m[1] || "").trim() : "";
  };

  const csrf = getInput("csrfmiddlewaretoken");
  const username = getInput("username");
  const email = getInput("email");
  const about = getTextarea("about");
  const favorite_tags = getInput("favorite_tags") || getTextarea("favorite_tags");

  let theme = getInput("theme");
  if (!theme) {
    const themeSelect =
      html.match(
        /name=["']theme["'][^>]*>[\s\S]*?<option[^>]*value=["']([^"']+)["'][^>]*selected/i
      ) ||
      html.match(
        /<option[^>]*selected[^>]*value=["']([^"']+)["'][^>]*>[\s\S]*?<\/select>/i
      );
    if (themeSelect) theme = themeSelect[1];
  }
  if (!theme) theme = "black";

  return { csrf, username, email, about, favorite_tags, theme };
}

export async function fetchProfileEditForm(
  userId: string,
  slug: string
): Promise<ProfileEditLoadResult> {
  if (isElectron()) {
    const electron = (window as any).electron;
    if (!electron?.fetchProfileEditPage) {
      return { success: false, error: "Not available" };
    }
    try {
      const result = await electron.fetchProfileEditPage({ userId, slug });
      if (result.success && result.data) {
        return { success: true, data: result.data };
      }
      return {
        success: false,
        error: result.error || "Failed to load",
        notLoggedIn: result.error === "not_logged_in",
      };
    } catch (e: any) {
      return { success: false, error: e?.message || "Unknown error" };
    }
  }

  if (isNative()) {
    try {
      const url = `${NH_HOST}/users/${userId}/${encodeURIComponent(slug)}/edit/`;
      const { html, finalUrl, status } = await fetchHtml(url);

      if (!html || status === 0) {
        return { success: false, error: "Network error" };
      }
      if (finalUrl.includes("/login") || status === 302 || status === 301) {
        return { success: false, error: "not_logged_in", notLoggedIn: true };
      }
      if (status >= 400) {
        return { success: false, error: `HTTP ${status}` };
      }

      const data = parseProfileEditHtml(html);
      if (!data.csrf) {
        return { success: false, error: "csrf_not_found" };
      }
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e?.message || "Request failed" };
    }
  }

  return { success: false, error: "Platform not supported" };
}

export type ProfileEditSubmitResult =
  | { success: true }
  | { success: false; error: string };

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

function avatarFileName(uri: string, mime: string): string {
  const parts = uri.split("/");
  const last = parts[parts.length - 1] || "";
  const hasExt = /\.(jpg|jpeg|png|gif|webp)$/i.test(last);
  if (hasExt) return last;
  if (mime === "image/png") return "avatar.png";
  if (mime === "image/gif") return "avatar.gif";
  if (mime === "image/webp") return "avatar.webp";
  return "avatar.jpg";
}

export async function submitProfileEdit(
  userId: string,
  slug: string,
  formData: ProfileEditFormData,
  options: { removeAvatar?: boolean; avatarFilePath?: string | null } = {}
): Promise<ProfileEditSubmitResult> {
  if (isElectron()) {
    const electron = (window as any).electron;
    if (!electron?.submitProfileEdit) {
      return { success: false, error: "Not available" };
    }
    try {
      const result = await electron.submitProfileEdit({
        userId,
        slug,
        formData: {
          csrf: formData.csrf,
          username: formData.username,
          email: formData.email,
          about: formData.about,
          favorite_tags: formData.favorite_tags,
          theme: formData.theme,
          old_password: formData.old_password || "",
          new_password1: formData.new_password1 || "",
          new_password2: formData.new_password2 || "",
        },
        removeAvatar: options.removeAvatar ?? false,
        avatarFilePath: options.avatarFilePath || undefined,
      });
      if (result.success) return { success: true };
      return { success: false, error: result.error || "Submit failed" };
    } catch (e: any) {
      return { success: false, error: e?.message || "Unknown error" };
    }
  }

  if (isNative()) {
    try {
      const urlPath = `/users/${userId}/${encodeURIComponent(slug)}/edit/`;
      const form = new FormData();

      form.append("csrfmiddlewaretoken", formData.csrf || "");
      form.append("username", formData.username || "");
      form.append("email", formData.email || "");

      if (options.removeAvatar) {
        form.append("remove_avatar", "on");
      } else if (
        options.avatarFilePath &&
        Platform.OS !== "web"
      ) {
        const uri = options.avatarFilePath;
        const mime = guessMimeType(uri);
        const fname = avatarFileName(uri, mime);
        form.append("avatar", {
          uri,
          name: fname,
          type: mime,
        } as any);
      }

      form.append("about", formData.about || "");
      form.append("favorite_tags", formData.favorite_tags || "");
      form.append("theme", formData.theme || "black");
      form.append("old_password", formData.old_password || "");
      form.append("new_password1", formData.new_password1 || "");
      form.append("new_password2", formData.new_password2 || "");

      const res = await nhFetch(urlPath, {
        method: "POST",
        csrf: true,
        withAuth: true,
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Origin: NH_HOST,
          Referer: `${NH_HOST}${urlPath}`,
        },
        body: form,
      });

      if (res.status >= 200 && res.status < 400) {
        return { success: true };
      }
      return { success: false, error: `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, error: e?.message || "Request failed" };
    }
  }

  return { success: false, error: "Platform not supported" };
}
