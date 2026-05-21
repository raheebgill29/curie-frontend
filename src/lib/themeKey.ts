/**
 * Derive a stable theme_key from title + week (matches backend admin create flow).
 */
export function themeKeyFromTitle(title: string, weekNumber: number): string {
  let slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (slug.length < 2) slug = "theme";
  const wk = Number.isFinite(weekNumber) && weekNumber > 0 ? Math.floor(weekNumber) : 1;
  let key = `${slug}_w${wk}`;
  if (!/^[a-z0-9][a-z0-9_-]{1,79}$/.test(key)) {
    key = `theme_w${wk}`;
  }
  return key.slice(0, 80);
}
