import type { ReactNode } from "react";
import { resolveEditableContent } from "../server/resolve.js";
import { EditableRepeaterClient } from "./EditableRepeaterClient.js";

export interface RepeaterItem<Item> {
  id: string;
  /** Fallback data for this item — from `defaultItems` (by original seed
   * position) for a theme-shipped item, or `itemDefaults` for one the
   * merchant added. Individual sub-fields still resolve their OWN draft/live
   * value independently (via `fieldFor`) once edited — this is only what a
   * not-yet-edited sub-field falls back to. */
  data: Item;
  /** Qualifies a sub-field key for this item, e.g. fieldFor("quote") →
   * "home.testimonials.item-0.quote" — pass straight to a nested Editable*'s
   * `field` prop. */
  fieldFor: (subfield: string) => string;
}

export interface EditableRepeaterProps<Item> {
  field: string;
  /** The theme's shipped seed content — unaffected until a merchant edits. */
  defaultItems: Item[];
  /** Fallback data for a brand-new merchant-added item. */
  itemDefaults: Item;
  min?: number;
  max?: number;
  as?: string;
  itemAs?: string;
  className?: string;
  itemClassName?: string;
  /** The theme dev's per-item template — called for EVERY item, live or
   * edit, so a repeater full of EditableText children still ships zero
   * editor JS to shoppers, recursively. The merchant's add/remove/reorder
   * UI can only change WHICH ids exist and in what order — it never touches
   * this function, so it can't alter the template/layout. */
  children: (item: RepeaterItem<Item>, index: number) => ReactNode;
}

function resolveOrder(raw: unknown, seedCount: number): string[] {
  if (Array.isArray(raw) && raw.every((x) => typeof x === "string")) return raw as string[];
  return Array.from({ length: seedCount }, (_, i) => `item-${i}`);
}

function defaultDataForId<Item>(id: string, defaultItems: Item[], itemDefaults: Item): Item {
  const match = /^item-(\d+)$/.exec(id);
  if (match) {
    const seed = defaultItems[Number(match[1])];
    if (seed !== undefined) return seed;
  }
  return itemDefaults;
}

export async function EditableRepeater<Item>({
  field,
  defaultItems,
  itemDefaults,
  min,
  max,
  as = "div",
  itemAs = "div",
  className,
  itemClassName,
  children,
}: EditableRepeaterProps<Item>) {
  const { mode, fields } = await resolveEditableContent();
  const order = resolveOrder(fields[field]?.value, defaultItems.length);

  const rendered = order.map((id, i) => {
    const data = defaultDataForId(id, defaultItems, itemDefaults);
    const node = children({ id, data, fieldFor: (sub) => `${field}.${id}.${sub}` }, i);
    return { id, node };
  });

  const As = as as any;
  const ItemAs = itemAs as any;

  if (mode !== "edit") {
    return (
      <As className={className}>
        {rendered.map(({ id, node }) => (
          <ItemAs key={id} className={itemClassName}>
            {node}
          </ItemAs>
        ))}
      </As>
    );
  }

  return (
    <EditableRepeaterClient
      field={field}
      as={as}
      itemAs={itemAs}
      className={className}
      itemClassName={itemClassName}
      order={order}
      min={min}
      max={max}
      items={rendered}
    />
  );
}
