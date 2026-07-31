"use client";
import { useRef } from "react";
import { Chevron } from "@/components/Icons";

/** Horizontal scrollable rail with arrow buttons — used for the category strip. */
export function CategoryRail({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => trackRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  return (
    <div className="cat-rail">
      <button type="button" className="cat-rail__arrow cat-rail__arrow--l" onClick={() => scroll(-1)} aria-label="Scroll categories left">
        <Chevron style={{ transform: "rotate(180deg)" }} />
      </button>
      <div className="cat-rail__track" ref={trackRef}>{children}</div>
      <button type="button" className="cat-rail__arrow cat-rail__arrow--r" onClick={() => scroll(1)} aria-label="Scroll categories right">
        <Chevron />
      </button>
    </div>
  );
}
