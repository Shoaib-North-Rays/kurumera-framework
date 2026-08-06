"use client";
import { useRef, useState, type ChangeEvent } from "react";
import { useEditableField } from "../useEditableField.js";
import { useEditableContext } from "../context.js";
import { editableClassName } from "../chrome.js";
import { toEmbedSrc, type EditableVideoValue } from "./videoField.js";

export interface EditableVideoClientProps {
  field: string;
  defaultValue: EditableVideoValue;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
}

function detectProvider(src: string): EditableVideoValue["provider"] {
  if (/youtu\.?be/.test(src)) return "youtube";
  if (/vimeo\.com/.test(src)) return "vimeo";
  return "file";
}

export function EditableVideoClient({ field, defaultValue, className, autoPlay, loop, muted, controls = true }: EditableVideoClientProps) {
  const { value, setValue, status, retry } = useEditableField<EditableVideoValue>(field, defaultValue, { type: "video" });
  const { uploadMedia } = useEditableContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadMedia(file, file.name, { contentType: "VIDEO" });
      if (uploaded.url) setValue({ src: uploaded.url, poster: value.poster, provider: "file" });
      setEditing(false);
    } catch {
      // merchant can retry from the still-open popover; nothing was set
    } finally {
      setUploading(false);
    }
  }

  function commitUrl() {
    const next = urlInputRef.current?.value?.trim();
    if (next) setValue({ src: next, poster: value.poster, provider: detectProvider(next) });
    setEditing(false);
  }

  return (
    <span className="kurumera-editable-video" style={{ position: "relative", display: "inline-block" }}>
      {value.provider === "file" ? (
        <video
          src={value.src}
          poster={value.poster}
          className={editableClassName(className, status)}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          controls={controls}
          playsInline
          data-kurumera-field={field}
          title={status === "error" ? "Couldn't save — click to retry" : undefined}
          onClick={status === "error" ? () => retry() : undefined}
        />
      ) : (
        <iframe
          src={toEmbedSrc(value.provider, value.src)}
          className={editableClassName(className, status)}
          title="Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          data-kurumera-field={field}
        />
      )}
      <button type="button" className="kurumera-editable-video__change" onClick={() => setEditing((v) => !v)}>
        Change video
      </button>
      {editing ? (
        <span className="kurumera-editable-video__popover">
          <input ref={urlInputRef} type="text" defaultValue={value.provider !== "file" ? value.src : ""} placeholder="YouTube / Vimeo URL…" />
          <button type="button" onClick={commitUrl}>
            Use URL
          </button>
          <span className="kurumera-editable-video__popover-or">or</span>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload file"}
          </button>
          <input ref={fileInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={handleFile} />
        </span>
      ) : null}
    </span>
  );
}
