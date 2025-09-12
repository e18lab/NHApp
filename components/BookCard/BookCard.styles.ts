import { ThemeColors } from "@/lib/ThemeContext";
import { ImageStyle, TextStyle, ViewStyle } from "react-native";

export function makeCardStyles(
  colors: ThemeColors,
  cardWidth: number,
  scale = 1
) {
  const S = scale;

  const radius = Math.round(cardWidth * 0.1 * S);
  const coverH = Math.round(cardWidth * 1.4);
  const bodyPad = Math.max(10, Math.round(cardWidth * 0.085 * S));

  const newFont = Math.max(10, Math.round(cardWidth * 0.08 * S));
  const newPadX = Math.max(6, Math.round(cardWidth * 0.04 * S));
  const newPadY = Math.max(2, Math.round(cardWidth * 0.03 * S));

  const titleSize = Math.max(12, Math.round(cardWidth * 0.105 * S));
  const subtitleSize = Math.max(11, Math.round(cardWidth * 0.095 * S));
  const metaFont = Math.max(12, Math.round(cardWidth * 0.09 * S));

  const tagFont = Math.max(10, Math.round(cardWidth * 0.088 * S));
  const tagPadX = Math.max(6, Math.round(cardWidth * 0.04 * S));
  const tagPadY = Math.max(3, Math.round(cardWidth * 0.028 * S));
  const tagRadius = Math.max(7, Math.round(cardWidth * 0.055 * S));

  const pillPadX = Math.max(10, Math.round(cardWidth * 0.06 * S));
  const pillPadY = Math.max(5, Math.round(cardWidth * 0.035 * S));

  return {
    card: {
      flex: 1,
      width: cardWidth,
      borderRadius: radius,
      backgroundColor: colors.bg,
      overflow: "hidden",
      elevation: 5,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    } as ViewStyle,

    hCard: {
      width: "100%",
      flexDirection: "row",
      borderRadius: radius,
      backgroundColor: colors.bg,
      overflow: "hidden",
      elevation: 2,
    } as ViewStyle,

    imageWrap: {
      position: "relative",
      width: "100%",
      height: coverH,
      borderTopLeftRadius: radius,
      borderTopRightRadius: radius,
      overflow: "hidden",
    } as ViewStyle,

    hImageWrap: {
      width: 120,
      height: 148,
      borderTopLeftRadius: radius,
      borderBottomLeftRadius: radius,
      overflow: "hidden",
    } as ViewStyle,

    cover: { width: "100%", height: "100%" } as ImageStyle,
    hCover: { width: "100%", height: "100%" } as ImageStyle,

    coverGradient: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "55%",
    } as ViewStyle,

    newBadge: {
      position: "absolute",
      right: 0,
      bottom: 22,
      marginHorizontal: pillPadX,
      marginVertical: pillPadY,
      backgroundColor: colors.newBadgeBg,
      color: "#fff",
      fontWeight: "800",
      fontSize: newFont,
      paddingHorizontal: newPadX,
      paddingVertical: newPadY,
      borderRadius: 999,
      letterSpacing: 0.6,
    } as TextStyle,

    ribbon: {
      paddingHorizontal: tagPadX - 2,
      paddingVertical: tagPadY - 2,
      borderRadius: tagRadius,
      fontSize: tagFont,
      color: "#ececec",
      backgroundColor: colors.tagBg,
      marginRight: tagPadX,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "#fff",
      fontWeight: "500",
      letterSpacing: 0.2,
    } as ViewStyle,
    ribbonBorderGood: { borderColor: "#7CFFAA" } as ViewStyle,
    ribbonBorderOk: { borderColor: "#FFE07C" } as ViewStyle,
    ribbonBorderWarn: { borderColor: "#FF8D8D" } as ViewStyle,

    ribbonText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: Math.max(11, Math.round(metaFont * 0.95)),
      textAlign: "center",
    } as TextStyle,

    ribbonGood: { color: "#7CFFAA" } as TextStyle,
    ribbonOk: { color: "#FFE07C" } as TextStyle,
    ribbonWarn: { color: "#FF8D8D" } as TextStyle,

    langBadge: {
      position: "absolute",
      top: 0,
      left: 0,
      width: Math.max(18, Math.round(cardWidth * 0.15 * S)) * 1.3,
      height: Math.max(18, Math.round(cardWidth * 0.15 * S)),
      borderRadius: 3,
      overflow: "hidden",
      marginHorizontal: pillPadX,
      marginVertical: pillPadY * 2,
      borderWidth: 1,
      borderColor: colors.page,
      backgroundColor: colors.page,
    } as ViewStyle,
    langImg: { width: "100%", height: "100%" } as ImageStyle,

    favWrap: {
      position: "absolute",
      top: 0,
      right: 0,
      marginHorizontal: pillPadX,
      marginVertical: pillPadY * 2,
      alignItems: "center",
    } as ViewStyle,
    favBtn: {
      backgroundColor: "rgba(0,0,0,0.6)",
      padding: Math.max(6, Math.round(cardWidth * 0.045 * S)),
      borderRadius: 999,
    } as ViewStyle,
    favCount: {
      marginTop: 4,
      paddingHorizontal: 6,
      paddingVertical: 3,
      fontSize: Math.max(10, Math.round(cardWidth * 0.075 * S)),
      fontWeight: "800",
      color: "#fff",
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: 999,
      overflow: "hidden",
    } as TextStyle,

    body: {
      padding: bodyPad,
      backgroundColor: colors.bg,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderWidth: 1,
      borderColor: colors.bg,
      marginTop: -18,
    } as ViewStyle,

    hBody: {
      flex: 1,
      padding: bodyPad,
      backgroundColor: colors.searchBg,
      borderLeftWidth: 1,
      borderColor: colors.page,
      justifyContent: "space-between",
      gap: 8,
    } as ViewStyle,

    titleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
    } as ViewStyle,

    title: {
      flex: 1,
      fontSize: titleSize,
      fontWeight: "600",
      color: colors.title,
      lineHeight: Math.round(titleSize * 1.15),
    } as TextStyle,

    subtitle: {
      fontSize: subtitleSize,
      color: colors.metaText,
      marginTop: 4,
    } as TextStyle,

    hFavBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 999,
      backgroundColor: colors.tagBg,
    } as ViewStyle,
    hFavCount: {
      color: colors.title,
      fontWeight: "800",
      fontSize: Math.max(11, Math.round(metaFont)),
    } as TextStyle,

    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
      marginBottom: 4,
    } as ViewStyle,
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    } as ViewStyle,
    metaIcon: { fontSize: metaFont, color: colors.metaText } as TextStyle,
    metaText: { fontSize: metaFont, color: colors.metaText } as TextStyle,

    tagsRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "nowrap",
      marginTop: tagPadY,
      minWidth: 0,
    } as ViewStyle,

    tagsWrap: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "nowrap",
      overflow: "hidden",
      borderRadius: tagRadius,
      minWidth: 0,
      paddingRight: Math.round(tagPadX * 0.9),
    } as ViewStyle,

    tagsWrapExpanded: {
      flexWrap: "wrap",
      overflow: "visible",
      alignItems: "flex-start",
    } as ViewStyle,

    tagPill: {
      alignSelf: "flex-start",
      paddingHorizontal: tagPadX,
      paddingVertical: tagPadY,
      marginRight: tagPadX,
      borderRadius: tagRadius,
      backgroundColor: colors.tagBg,
      overflow: "hidden",
    } as ViewStyle,

    tapPillOpen: {
      marginBottom: Math.round(tagPadY * 1.4),
    } as ViewStyle,

    tagCap50: {
      maxWidth: "100%",
    } as ViewStyle,

    tagText: {
      fontSize: tagFont,
      fontWeight: "500",
      letterSpacing: 0.2,
    } as TextStyle,

    tag: {
      paddingHorizontal: tagPadX,
      paddingVertical: tagPadY,
      borderRadius: tagRadius,
      fontSize: tagFont,
      color: "#ececec",
      backgroundColor: colors.tagBg,
      marginBottom: Math.round(tagPadY * 1.4),
      marginRight: tagPadX,
      fontWeight: "500",
      letterSpacing: 0.2,
    } as TextStyle,

    tagOneLine: {
      flexGrow: 0,
      flexShrink: 0,
    } as ViewStyle,

    tagExpanded: {
      flexGrow: 0,
      flexShrink: 0,
      maxWidth: "100%",
    } as ViewStyle,

    plusWrap: {
      paddingHorizontal: tagPadX,
      paddingVertical: tagPadY,
      borderRadius: tagRadius,
      fontSize: tagFont,
      color: "#ececec",
      backgroundColor: colors.tagBg,
      marginRight: tagPadX,
      fontWeight: "500",
      letterSpacing: 0.2,
      marginLeft: Math.round(tagPadX * 0.9),
    } as ViewStyle,
    tagPlus: { marginRight: 0, fontSize: tagFont } as TextStyle,

    tagSelected: {
      borderWidth: 2,
      borderColor: "#fff",
    } as ViewStyle,

    classicBarBase: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingHorizontal: 0,
      paddingVertical: 0,
      backgroundColor: "rgba(39,39,39,0.9)",
      borderTopWidth: 0,
      borderBottomLeftRadius: radius,
      borderBottomRightRadius: radius,
    } as ViewStyle,
    classicBarAbs: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      overflow: "hidden",
      zIndex: 2,
    } as ViewStyle,
    classicInner: {
      flex: 1,
      alignSelf: "stretch",
      justifyContent: "flex-start",
    } as ViewStyle,
    classicSeamFix: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: -1,
      height: 2,
      backgroundColor: "rgba(39,39,39,0.9)",
    } as ViewStyle,
    classicTitle: {
      flex: 1,
      color: "#d9d9d9",
      fontWeight: "700",
      fontSize: Math.max(12, Math.round(cardWidth * 0.08 * S)),
      lineHeight: Math.max(14, Math.round(cardWidth * 0.09 * S)),
      textAlign: "center",
    } as TextStyle,
  };
}
