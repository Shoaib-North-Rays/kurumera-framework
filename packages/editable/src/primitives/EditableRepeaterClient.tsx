"use client";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEditableField } from "../useEditableField.js";

interface RenderedItem {
  id: string;
  node: ReactNode;
}

export interface EditableRepeaterClientProps {
  field: string;
  as: string;
  itemAs: string;
  className?: string;
  itemClassName?: string;
  order: string[];
  min?: number;
  max?: number;
  /** Pre-rendered (server-side, via the theme dev's render-prop) nodes for
   * every id CURRENTLY known to the server. A function/render-prop itself
   * can't cross the Server→Client boundary — only its already-rendered
   * output can — so reordering/removing existing ids works with zero extra
   * round trip, but a brand-new id has no node here until the page
   * refreshes (see add(), below). */
  items: RenderedItem[];
}

export function EditableRepeaterClient({
  field,
  as,
  itemAs,
  className,
  itemClassName,
  order,
  min,
  max,
  items,
}: EditableRepeaterClientProps) {
  const router = useRouter();
  const As = as as any;
  const ItemAs = itemAs as any;
  // `immediate: true` — reorder/add/remove are discrete actions, saved right
  // away rather than debounced like continuous typing.
  const { value: currentOrder, setValue: setOrder } = useEditableField<string[]>(field, order, {
    type: "repeater",
    immediate: true,
  });
  const byId = new Map(items.map((i) => [i.id, i.node]));

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= currentOrder.length) return;
    const next = [...currentOrder];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  function remove(id: string) {
    if (min !== undefined && currentOrder.length <= min) return;
    setOrder(currentOrder.filter((x) => x !== id));
  }

  function add() {
    if (max !== undefined && currentOrder.length >= max) return;
    const id = `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setOrder([...currentOrder, id]);
    // The new id's editable sub-fields are Server Components declared in the
    // theme's own render-prop — they only exist once the server re-renders
    // with the new id in `order`. Until this resolves, the item shows a
    // lightweight placeholder below.
    router.refresh();
  }

  const atMax = max !== undefined && currentOrder.length >= max;

  return (
    <As className={className}>
      {currentOrder.map((id, i) => (
        <ItemAs key={id} className={itemClassName} data-kurumera-repeater-item={id}>
          <div className="kurumera-editable-repeater__chrome" contentEditable={false}>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === currentOrder.length - 1}
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => remove(id)}
              disabled={min !== undefined && currentOrder.length <= min}
            >
              Remove
            </button>
          </div>
          {byId.get(id) ?? <div className="kurumera-editable-repeater__pending">Loading…</div>}
        </ItemAs>
      ))}
      {!atMax ? (
        <button type="button" className="kurumera-editable-repeater__add" onClick={add}>
          + Add item
        </button>
      ) : null}
    </As>
  );
}
