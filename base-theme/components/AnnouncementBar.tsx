import { getSettings } from "@/lib/settings";

/** Thin promo bar above the header. Text + visibility come from theme settings. */
export async function AnnouncementBar() {
  const { announcement } = await getSettings();
  if (!announcement.show || !announcement.text) return null;
  return (
    <div className="announce">
      <span>{announcement.text}</span>
    </div>
  );
}
