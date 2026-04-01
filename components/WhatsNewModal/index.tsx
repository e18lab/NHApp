import NhModal from "@/components/nhModal";
import { useTheme } from "@/lib/ThemeContext";
import ExpoImage from "@/components/ExpoImageCompat";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useMemo, useState } from "react";
import {
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import Markdown from "react-native-markdown-display";

const IMG_TAG_RE = /<img\b(?:[\s\S]*?)src=["']([^"']+)["'](?:[\s\S]*?)\/?>/gi;
const MD_IMAGE_RE = /!\[[^\]]*\]\(([^)\s]+)\)/gi;
const VIDEO_URL_RE = /(https?:\/\/[^\s)]+?\.(?:mp4|webm|mov)(?:\?[^\s)]*)?)/gi;
const GH_BARE_LINE_RE =
  /(?:^|\n)\s*(https?:\/\/(?:github|user-images|raw\.githubusercontent|objects\.githubusercontent)\.[^\s<>()]+\/user-attachments\/[^\s<>()]+)\s*(?=\n|$)/gi;

type Block =
  | { type: "md"; text: string }
  | { type: "media"; src: string; kind: "image" | "video" };

function splitNotesToBlocksImpl(raw: string): Block[] {
  const input = (raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/([^\n])\s+(###\s+)/g, "$1\n\n$2");

  type Hit = { start: number; end: number; block: Block };
  const hits: Hit[] = [];
  const used: Array<[number, number]> = [];

  const pushNonOverlapping = (
    re: RegExp,
    toBlock: (m: RegExpExecArray) => Block
  ) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input))) {
      const start = m.index;
      const end = start + m[0].length;
      const overlaps = used.some(([s, e]) => !(end <= s || start >= e));
      if (overlaps) continue;
      hits.push({ start, end, block: toBlock(m) });
      used.push([start, end]);
    }
  };

  pushNonOverlapping(IMG_TAG_RE, (m) => ({
    type: "media",
    kind: "image",
    src: m[1],
  }));
  pushNonOverlapping(MD_IMAGE_RE, (m) => ({
    type: "media",
    kind: "image",
    src: m[1],
  }));
  pushNonOverlapping(VIDEO_URL_RE, (m) => ({
    type: "media",
    kind: "video",
    src: m[1],
  }));
  pushNonOverlapping(GH_BARE_LINE_RE, (m) => ({
    type: "media",
    kind: "video",
    src: m[1],
  }));

  hits.sort((a, b) => a.start - b.start);

  const out: Block[] = [];
  let pos = 0;
  for (const h of hits) {
    if (h.start > pos) {
      const text = input.slice(pos, h.start).trim();
      if (text && !/^[\s/>]+$/.test(text)) out.push({ type: "md", text });
    }
    out.push(h.block);
    pos = h.end;
  }
  if (pos < input.length) {
    const tail = input.slice(pos).trim();
    if (tail && !/^[\s/>]+$/.test(tail)) out.push({ type: "md", text: tail });
  }
  return out;
}

export { splitNotesToBlocksImpl as splitNotesToBlocks };

/** Makes bare URLs (https://..., http://..., discord.gg/...) clickable in markdown. */
function wrapBareUrlsInMarkdown(text: string): string {
  const str = typeof text === "string" ? text : String(text ?? "");
  const urlRe = /(https?:\/\/[^\s<>\]()"\']+|discord\.gg\/[^\s<>\]()"\']+)/gi;
  return str.replace(urlRe, (match, offsetOrP1: unknown) => {
    const offset = typeof offsetOrP1 === "number" ? offsetOrP1 : 0;
    const before = str.slice(0, offset);
    const linkStart = before.lastIndexOf("](");
    const linkEnd = linkStart >= 0 ? before.indexOf(")", linkStart) : -1;
    if (linkStart !== -1 && (linkEnd === -1 || linkEnd > offset)) return match;
    return `[${match}](${match})`;
  });
}

function AutoImage({ uri, onError }: { uri: string; onError?: () => void }) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const maxW = Math.min(width - 24, 900);
  const [ratio, setRatio] = useState<number | null>(null);

  return (
    <View
      style={{
        width: maxW,
        alignSelf: "center",
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: colors.tagBg,
      }}
    >
      <ExpoImage
        source={{ uri }}
        style={{ width: "100%", aspectRatio: ratio ?? 16 / 9 }}
        contentFit="contain"
        onLoad={(e: any) => {
          const w = e?.source?.width,
            h = e?.source?.height;
          if (w && h && w > 0 && h > 0) setRatio(w / h);
        }}
        onError={onError}
      />
    </View>
  );
}

function VideoBlock({ uri }: { uri: string }) {
  const { width } = useWindowDimensions();
  const maxW = Math.min(width - 24, 900);
  const h = Math.round((maxW * 9) / 16);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    if (Platform.OS !== "web") p.muted = false;
  });

  return (
    <View
      style={{
        width: maxW,
        height: h,
        alignSelf: "center",
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      <VideoView
        style={{ width: "100%", height: "100%" }}
        player={player}
        surfaceType="textureView"
        contentFit="contain"
        allowsFullscreen
        allowsPictureInPicture
        nativeControls
      />
    </View>
  );
}

export default function WhatsNewModal({
  visible,
  onClose,
  notes,
}: {
  visible: boolean;
  onClose: () => void;
  notes: string;
}) {
  const { colors } = useTheme();
  const blocks = useMemo(() => splitNotesToBlocksImpl(notes), [notes]);

  const mdStyles = {
    body: { color: colors.txt, fontSize: 14, lineHeight: 20 },
    heading1: {
      color: colors.txt,
      fontSize: 24,
      fontWeight: "800",
      marginBottom: 6,
    },
    heading2: {
      color: colors.txt,
      fontSize: 20,
      fontWeight: "800",
      marginTop: 16,
      marginBottom: 6,
    },
    heading3: {
      color: colors.txt,
      fontSize: 18,
      fontWeight: "800",
      marginTop: 14,
      marginBottom: 6,
    },
    bullet_list: { marginVertical: 6 },
    list_item: { marginVertical: 2 },
    code_block: {
      backgroundColor: colors.tagBg,
      borderRadius: 8,
      padding: 8,
      color: colors.txt,
    },
    link: { color: colors.accent },
    strong: { color: colors.txt, fontWeight: "800" },
    em: { color: colors.txt },
  } as const;

  return (
    <NhModal
      visible={visible}
      onClose={onClose}
      title="Что нового"
      heightPercent={0.9}
      sizing="fixed"
      sheetStyle={{ backgroundColor: colors.page }}
    >
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={{ padding: 12, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {blocks.map((b, i) => {
          if (b.type === "md") {
            const raw = b.text.replace(/\t/g, "  ");
            const text = wrapBareUrlsInMarkdown(raw);
            return (
              <Markdown
                key={i}
                style={mdStyles}
                onLinkPress={(url) => {
                  Linking.openURL(url).catch(() => {});
                  return true;
                }}
              >
                {text}
              </Markdown>
            );
          }
          if (b.type === "media") {
            return b.kind === "image" ? (
              <AutoImage key={i} uri={b.src} />
            ) : (
              <VideoBlock key={i} uri={b.src} />
            );
          }
          return null;
        })}

        {blocks.length === 0 && (
          <View style={{ padding: 16 }}>
            <Text style={{ color: colors.txt, opacity: 0.7 }}>
              Нет заметок к релизу.
            </Text>
          </View>
        )}
      </ScrollView>
    </NhModal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
});

/** Renders release notes content (markdown + media). Use on a full-screen page. */
export function WhatsNewNotesContent({ notes }: { notes: string }) {
  const { colors } = useTheme();
  const blocks = useMemo(() => splitNotesToBlocksImpl(notes), [notes]);
  const mdStyles = {
    body: { color: colors.txt, fontSize: 14, lineHeight: 20 },
    heading1: { color: colors.txt, fontSize: 24, fontWeight: "800", marginBottom: 6 },
    heading2: { color: colors.txt, fontSize: 20, fontWeight: "800", marginTop: 16, marginBottom: 6 },
    heading3: { color: colors.txt, fontSize: 18, fontWeight: "800", marginTop: 14, marginBottom: 6 },
    bullet_list: { marginVertical: 6 },
    list_item: { marginVertical: 2 },
    code_block: { backgroundColor: colors.tagBg, borderRadius: 8, padding: 8, color: colors.txt },
    link: { color: colors.accent },
    strong: { color: colors.txt, fontWeight: "800" },
    em: { color: colors.txt },
  } as const;
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === "md") {
          const raw = b.text.replace(/\t/g, "  ");
          const text = wrapBareUrlsInMarkdown(raw);
          return (
            <Markdown
              key={i}
              style={mdStyles}
              onLinkPress={(url) => {
                Linking.openURL(url).catch(() => {});
                return true;
              }}
            >
              {text}
            </Markdown>
          );
        }
        if (b.type === "media") {
          return b.kind === "image" ? (
            <AutoImage key={i} uri={b.src} />
          ) : (
            <VideoBlock key={i} uri={b.src} />
          );
        }
        return null;
      })}
      {blocks.length === 0 && (
          <View style={{ padding: 16 }}>
          <Text style={{ color: colors.txt, opacity: 0.7 }}>Нет заметок к релизу.</Text>
        </View>
      )}
    </>
  );
}
