import React from "react";
import Card from "./Card";
import Section from "./Section";
import SliderRow from "./rows/SliderRow";
import SwitchRow from "./rows/SwitchRow";
import type { SettingsItem, SettingsSection } from "./schema";
export default function SettingsBuilder({ sections }: { sections: SettingsSection[] }) {
  return (
    <>
      {sections.map((sec) => (
        <React.Fragment key={sec.id}>
          <Section title={sec.title} />
          {sec.cards.map((card) => (
            <Card key={card.id}>
              {card.title ? <SectionTitleInline>{card.title}</SectionTitleInline> : null}
              {card.items.map((item) => (
                <ItemRenderer key={item.id} item={item} />
              ))}
            </Card>
          ))}
        </React.Fragment>
      ))}
    </>
  );
}
function SectionTitleInline({ children }: { children: React.ReactNode }) {
  return <></>;
}
function ItemRenderer({ item }: { item: SettingsItem }) {
  if (item.kind === "slider") {
    return (
      <SliderRow
        label={item.label}
        value={item.value}
        min={item.min}
        max={item.max}
        step={item.step ?? 1}
        onChange={item.onChange}
        onCommit={item.onCommit}
      />
    );
  }
  if (item.kind === "toggle") {
    return (
      <SwitchRow
        title={item.title}
        description={item.description}
        value={item.value}
        onChange={item.onToggle}
      />
    );
  }
  return <>{item.render()}</>;
}