/**
 * Editor chrome styles, injected by <EditableProvider> ONLY in edit mode.
 *
 * Shipping this as a real .css file would force every theme to remember an
 * import (and silently render raw browser buttons if they forgot). Injecting
 * it from the provider means it costs a shopper nothing — the provider bails
 * out of rendering it entirely when mode !== "edit" — and a theme dev has
 * zero setup.
 *
 * Every rule is namespaced under `.kurumera-editable*` and every control
 * resets the properties a host theme's own `button {}` / `input {}` rules
 * would otherwise leak in. The theme's own design must look untouched;
 * only the controls we add are ours to style.
 */
export const CHROME_CSS = `
.kurumera-edit-mode [data-kurumera-field],
.kurumera-edit-mode .kurumera-editable {
  outline: 1px dashed rgba(37,99,235,.45);
  outline-offset: 3px;
  border-radius: 2px;
  transition: outline-color .12s ease, background-color .12s ease;
}
.kurumera-edit-mode .kurumera-editable:hover {
  outline: 1px dashed rgba(37,99,235,.9);
  background-color: rgba(37,99,235,.05);
}
.kurumera-edit-mode .kurumera-editable:focus,
.kurumera-edit-mode .kurumera-editable:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 3px;
  background-color: rgba(37,99,235,.06);
}
.kurumera-editable--saving { outline-color: #f59e0b !important; }
.kurumera-editable--saved  { outline-color: #10b981 !important; }
.kurumera-editable--error  { outline: 2px solid #ef4444 !important; cursor: pointer; }

/* ── Shared control chrome ──────────────────────────────────────────── */
.kurumera-editable-image__change,
.kurumera-editable-bg__change,
.kurumera-editable-video__change,
.kurumera-editable-linkfield__edit-link,
.kurumera-editable-section__chip button,
.kurumera-editable-repeater__chrome button,
.kurumera-editable-repeater__add,
.kurumera-editable-richtext__toolbar button,
.kurumera-editable-linkfield__popover button,
.kurumera-editable-video__popover button {
  -webkit-appearance: none; appearance: none;
  font: 600 11px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
  letter-spacing: .01em;
  padding: 5px 9px;
  margin: 0;
  border: 0;
  border-radius: 6px;
  background: #111827;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,.28);
  text-transform: none;
  white-space: nowrap;
  min-width: 0; min-height: 0; width: auto; height: auto;
  transition: background-color .12s ease, opacity .12s ease;
}
.kurumera-editable-image__change:hover,
.kurumera-editable-bg__change:hover,
.kurumera-editable-video__change:hover,
.kurumera-editable-linkfield__edit-link:hover,
.kurumera-editable-section__chip button:hover,
.kurumera-editable-repeater__chrome button:hover,
.kurumera-editable-repeater__add:hover,
.kurumera-editable-richtext__toolbar button:hover,
.kurumera-editable-linkfield__popover button:hover,
.kurumera-editable-video__popover button:hover { background: #2563eb; }
.kurumera-editable-repeater__chrome button:disabled { opacity: .35; cursor: default; background: #111827; }

/* ── Media: float the control over the media, never in the layout ───── */
.kurumera-editable-image,
.kurumera-editable-video { position: relative; display: inline-block; line-height: 0; }
.kurumera-editable-image__change,
.kurumera-editable-video__change,
.kurumera-editable-bg__change {
  position: absolute; top: 8px; right: 8px; z-index: 20;
  opacity: 0; pointer-events: none;
}
.kurumera-editable-image:hover .kurumera-editable-image__change,
.kurumera-editable-image:focus-within .kurumera-editable-image__change,
.kurumera-editable-video:hover .kurumera-editable-video__change,
.kurumera-editable-video:focus-within .kurumera-editable-video__change,
.kurumera-editable-bg:hover .kurumera-editable-bg__change,
.kurumera-editable-bg:focus-within .kurumera-editable-bg__change { opacity: 1; pointer-events: auto; }
/* Background image: the primitive IS the theme's container, so only add
   positioning context — never change its display/layout. */
.kurumera-edit-mode .kurumera-editable-bg { position: relative; }

/* ── Section chip: floats at the top-left corner, out of flow ───────── */
.kurumera-editable-section { position: relative; }
.kurumera-editable-section__chip {
  position: absolute; top: 6px; left: 6px; z-index: 25;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 4px 3px 9px;
  border-radius: 999px;
  background: rgba(17,24,39,.92);
  color: #fff;
  font: 600 11px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
  box-shadow: 0 1px 4px rgba(0,0,0,.3);
  opacity: 0; pointer-events: none; transition: opacity .12s ease;
}
.kurumera-editable-section:hover .kurumera-editable-section__chip,
.kurumera-editable-section:focus-within .kurumera-editable-section__chip { opacity: 1; pointer-events: auto; }
.kurumera-editable-section__chip button { padding: 3px 8px; border-radius: 999px; background: rgba(255,255,255,.16); }

/* ── Repeater: per-item controls float top-right of each item ───────── */
.kurumera-edit-mode [data-kurumera-repeater-item] { position: relative; }
.kurumera-editable-repeater__chrome {
  position: absolute; top: 6px; right: 6px; z-index: 25;
  display: inline-flex; gap: 4px;
  opacity: 0; pointer-events: none; transition: opacity .12s ease;
}
[data-kurumera-repeater-item]:hover .kurumera-editable-repeater__chrome,
[data-kurumera-repeater-item]:focus-within .kurumera-editable-repeater__chrome { opacity: 1; pointer-events: auto; }
.kurumera-editable-repeater__chrome button { padding: 4px 7px; }
.kurumera-editable-repeater__add {
  display: inline-flex; align-items: center; margin-top: 10px;
  background: #2563eb;
}
.kurumera-editable-repeater__add:hover { background: #1d4ed8; }
.kurumera-editable-repeater__pending { padding: 12px; font: 12px system-ui; color: #6b7280; }

/* ── Rich text toolbar ──────────────────────────────────────────────── */
.kurumera-editable-richtext { position: relative; }
.kurumera-editable-richtext__toolbar {
  position: absolute; top: 0; right: 0; z-index: 25;
  transform: translateY(-115%);
  display: inline-flex; gap: 4px; padding: 4px;
  border-radius: 8px; background: rgba(17,24,39,.92);
  box-shadow: 0 2px 6px rgba(0,0,0,.3);
  opacity: 0; pointer-events: none; transition: opacity .12s ease;
}
.kurumera-editable-richtext:hover .kurumera-editable-richtext__toolbar,
.kurumera-editable-richtext:focus-within .kurumera-editable-richtext__toolbar { opacity: 1; pointer-events: auto; }
.kurumera-editable-richtext__toolbar button { background: rgba(255,255,255,.16); min-width: 26px; text-align: center; }

/* ── Link / button field ────────────────────────────────────────────── */
.kurumera-editable-linkfield { position: relative; display: inline-block; }
.kurumera-editable-linkfield__edit-link {
  position: absolute; top: -8px; right: -8px; z-index: 25;
  padding: 3px 7px;
  opacity: 0; pointer-events: none; transition: opacity .12s ease;
}
.kurumera-editable-linkfield:hover .kurumera-editable-linkfield__edit-link,
.kurumera-editable-linkfield:focus-within .kurumera-editable-linkfield__edit-link { opacity: 1; pointer-events: auto; }

/* ── Popovers (link href, video source) ─────────────────────────────── */
.kurumera-editable-linkfield__popover,
.kurumera-editable-video__popover {
  position: absolute; top: calc(100% + 8px); left: 0; z-index: 30;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px; border-radius: 8px;
  background: #fff; border: 1px solid #e5e7eb;
  box-shadow: 0 6px 20px rgba(0,0,0,.16);
  white-space: nowrap;
}
.kurumera-editable-linkfield__popover input,
.kurumera-editable-video__popover input {
  -webkit-appearance: none; appearance: none;
  font: 12px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #111827; background: #fff;
  padding: 6px 8px; margin: 0;
  border: 1px solid #d1d5db; border-radius: 6px;
  min-width: 230px; width: auto; height: auto;
}
.kurumera-editable-linkfield__popover input:focus,
.kurumera-editable-video__popover input:focus { outline: 2px solid #2563eb; outline-offset: -1px; border-color: #2563eb; }
.kurumera-editable-video__popover-or { font: 11px system-ui; color: #6b7280; }

@media (prefers-reduced-motion: reduce) {
  .kurumera-editable, .kurumera-editable-section__chip, .kurumera-editable-repeater__chrome,
  .kurumera-editable-richtext__toolbar, .kurumera-editable-linkfield__edit-link,
  .kurumera-editable-image__change, .kurumera-editable-video__change, .kurumera-editable-bg__change {
    transition: none;
  }
}
`;
