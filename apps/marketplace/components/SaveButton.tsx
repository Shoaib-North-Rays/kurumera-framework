"use client";

import { useEffect, useState } from "react";
import { Heart } from "@/components/Icons";

const KEY = "kurumera_saved";
function read(): string[] { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }

/** Save-for-later (localStorage stub until Workspace/collections land in a later phase). */
export function SaveButton({ slug, className = "tpl-card__save", label }: { slug: string; className?: string; label?: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(read().includes(slug)); }, [slug]);
  return (
    <button
      type="button"
      className={`${className} ${on ? "on" : ""}`}
      aria-pressed={on}
      aria-label={on ? "Saved — remove from saved" : "Save template for later"}
      onClick={(e) => {
        e.preventDefault(); e.stopPropagation();
        const set = new Set(read());
        on ? set.delete(slug) : set.add(slug);
        try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch { /* private mode */ }
        setOn(!on);
      }}
    >
      <Heart width={17} height={17} fill={on ? "currentColor" : "none"} />
      {label && <span>{on ? "Saved" : "Save"}</span>}
    </button>
  );
}
