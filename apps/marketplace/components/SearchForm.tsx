"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { Search } from "@/components/Icons";

/**
 * The two on-page search fields (home hero, /templates header), submitted
 * through the router.
 *
 * WHY THIS EXISTS: both were plain `<form action="/templates">`, so pressing
 * Enter triggered a FULL DOCUMENT RELOAD — new HTML, fonts re-evaluated, every
 * live preview iframe on the page torn down and re-fetched from its origin.
 * On the home page that is sixteen cross-origin frames destroyed to change one
 * query string. Routing it through `router.push` keeps the document alive and
 * lets Next patch in only the part of the tree that changed.
 *
 * It stays a real <form> with a real `action`, and the filter state stays in
 * hidden inputs: if JS has not loaded yet, Enter still performs the native GET
 * and the user still gets their results. The client path is an enhancement on
 * top, not a replacement for, something that worked.
 *
 * Uncontrolled on purpose — the value is read from the form at submit time, so
 * this ships no per-keystroke re-render of a page that holds live iframes.
 */
export function SearchForm({
  className,
  placeholder,
  defaultValue = "",
  action = "/templates",
  hidden,
  children,
}: {
  className: string;
  placeholder: string;
  defaultValue?: string;
  /** Where the search lands. Defaults to the all-templates route; the dedicated
   *  discovery routes pass their own path so searching from
   *  /templates/category/restaurant searches WITHIN the category instead of
   *  silently dumping the user back on /templates. */
  action?: string;
  /** Filters to carry through the search (rendered as hidden inputs so the
   *  no-JS GET keeps them too). Empty/undefined entries are dropped. */
  hidden?: Record<string, string | undefined>;
  /** Optional trailing control, e.g. the submit button on /templates. */
  children?: ReactNode;
}) {
  const router = useRouter();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // FormData reads the field AND the hidden filter inputs in one go, so the
    // client path and the native GET fallback can never build different URLs.
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(e.currentTarget).entries()) {
      const v = String(value).trim();
      if (v) params.set(key, v);
    }
    const qs = params.toString();
    router.push(qs ? `${action}?${qs}` : action);
  }

  return (
    <form className={className} action={action} role="search" onSubmit={onSubmit}>
      {/* Direct child of the form: `.searchbox > svg` positions it in the field. */}
      <Search />
      <input
        className="input"
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label="Search templates"
      />
      {hidden &&
        Object.entries(hidden).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null,
        )}
      {children}
    </form>
  );
}
