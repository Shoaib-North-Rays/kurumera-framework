"use client";
import { useRef, useState, type ChangeEvent } from "react";
import { useEditableField } from "../useEditableField.js";
import { useEditableContext } from "../context.js";
import { editableClassName } from "../chrome.js";
import type { EditableImageValue } from "./EditableImage.js";

export interface EditableImageClientProps {
  field: string;
  defaultSrc: string;
  defaultAlt?: string;
  className?: string;
  width?: number;
  height?: number;
  sizes?: string;
}

export function EditableImageClient({ field, defaultSrc, defaultAlt, className, width, height, sizes }: EditableImageClientProps) {
  const defaultValue: EditableImageValue = { src: defaultSrc, alt: defaultAlt ?? "" };
  const { value, setValue, status, retry } = useEditableField<EditableImageValue>(field, defaultValue, { type: "image" });
  const { uploadMedia } = useEditableContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadMedia(file, file.name);
      if (uploaded.url) setValue({ src: uploaded.url, alt: value.alt });
    } catch {
      // uploadMedia's own errors surface via a rejected promise only — the
      // field's save status is untouched (nothing was set), so just let the
      // merchant try again; no partial/broken state is left behind.
    } finally {
      setUploading(false);
    }
  }

  return (
    <span className="kurumera-editable-image" style={{ position: "relative", display: "inline-block" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={value.src}
        alt={value.alt}
        className={editableClassName(className, status)}
        width={width}
        height={height}
        sizes={sizes}
        data-kurumera-field={field}
        title={status === "error" ? "Couldn't save — click to retry" : undefined}
        onClick={status === "error" ? () => retry() : undefined}
      />
      <button
        type="button"
        className="kurumera-editable-image__change"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "Uploading…" : "Change image"}
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
    </span>
  );
}
