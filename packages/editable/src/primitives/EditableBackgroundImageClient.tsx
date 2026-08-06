"use client";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useEditableField } from "../useEditableField.js";
import { useEditableContext } from "../context.js";
import { editableClassName } from "../chrome.js";

export interface EditableBackgroundImageClientProps {
  field: string;
  defaultSrc: string;
  as: string;
  className?: string;
  children?: ReactNode;
}

export function EditableBackgroundImageClient({ field, defaultSrc, as, className, children }: EditableBackgroundImageClientProps) {
  const { value, setValue, status, retry } = useEditableField<string>(field, defaultSrc, { type: "image" });
  const { uploadMedia } = useEditableContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const As = as as any;

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadMedia(file, file.name);
      if (uploaded.url) setValue(uploaded.url);
    } catch {
      // nothing was set — the merchant can just try again
    } finally {
      setUploading(false);
    }
  }

  return (
    <As
      className={`kurumera-editable-bg ${editableClassName(className, status)}`}
      style={{ backgroundImage: `url(${value})`, position: "relative" }}
      data-kurumera-field={field}
      title={status === "error" ? "Couldn't save — click to retry" : undefined}
    >
      {children}
      <button
        type="button"
        className="kurumera-editable-bg__change"
        contentEditable={false}
        onClick={() => (status === "error" ? retry() : inputRef.current?.click())}
        disabled={uploading}
      >
        {uploading ? "Uploading…" : status === "error" ? "Retry save" : "Change background"}
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
    </As>
  );
}
