import { JSX } from "react";
export type SliderItem = {
  id: string;
  kind: "slider";
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange?: (v: number) => void;
  onCommit: (v: number) => void;
};
export type ToggleItem = {
  id: string;
  kind: "toggle";
  title: string;
  description?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
};
export type CustomItem = {
  id: string;
  kind: "custom";
  render: () => JSX.Element;
};
export type SettingsItem = SliderItem | ToggleItem | CustomItem;
export type SettingsCard = {
  id: string;
  title?: string;
  items: SettingsItem[];
};
export type SettingsSection = {
  id: string;
  title: string;
  cards: SettingsCard[];
};