"use client";
/**
 * The store's floating "Message us on WhatsApp" button.
 *
 * A store setting the merchant turns on in the Kurumera admin (Settings,
 * WhatsApp, "Chat button on your website"). The platform decides it in
 * `tenant-config.whatsapp_chat`: on only when the store switched it on AND its
 * WhatsApp number can take messages, so an off or unconnected store renders
 * nothing. The layout passes that raw value in (`setting`); it is read HERE, in
 * this client component.
 *
 * Read by hand rather than with the SDK's `whatsappChat()`: that helper arrives
 * in @kurumera/storefront 0.12.0, and a theme still on 0.11.0 would not build
 * if this imported it. The rule is the same: only ever a https://wa.me/ link.
 *
 * Do not export a helper from this file for the layout to call: everything
 * exported from a "use client" module is a client reference, and calling one
 * from a Server Component throws on every request (a storefront answered 500
 * on every page on 18 Nov 2026 until it was rolled back).
 *
 * The link opens WhatsApp with the store's request already typed ("please send
 * me updates and offers"). The shopper sending it is their own yes, which the
 * platform records, so draw it as a plain link: never rewrite `href` or its
 * message. A click is counted as a CONTACT_CLICK.
 *
 * A page that pins its own bar to the bottom of the screen hides it in CSS
 * (`.whatsapp-chat` in globals.css), so the two never overlap.
 */
import { trackEvent, EVENT } from "@kurumera/storefront";
import { ChatIcon } from "@/components/Icon";

/** The setting from tenant-config, or null. Only ever a WhatsApp link. */
function readSetting(raw: unknown): { href: string; label: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const href = typeof r.href === "string" ? r.href : "";
  if (r.enabled !== true || !href.startsWith("https://wa.me/")) return null;
  return { href, label: typeof r.label === "string" && r.label ? r.label : "Message us on WhatsApp" };
}

export function WhatsAppChatButton({ setting }: { setting: unknown }) {
  const chat = readSetting(setting);
  if (!chat) return null;
  return (
    <a
      className="whatsapp-chat"
      href={chat.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={chat.label}
      title={chat.label}
      onClick={() =>
        trackEvent(EVENT.CONTACT_CLICK, {
          data: { channel: "whatsapp", node_id: "store-chat-button", label: chat.label, destination: chat.href },
        })
      }
    >
      <ChatIcon width={26} height={26} />
    </a>
  );
}
