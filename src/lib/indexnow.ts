// IndexNow — instantly tells Bing / Yandex / Seznam that URLs changed.
// The key is public and must be served at `${siteUrl}/${INDEXNOW_KEY}.txt`.
export const INDEXNOW_KEY = "b0cc65e7c5148859022c199d938c69e3";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hostmagsmart.com";

/** Public URLs worth (re)crawling. Keep in sync with sitemap.ts. */
export function indexNowUrls(): string[] {
  return [`${siteUrl}/`, `${siteUrl}/en/signup`, `${siteUrl}/en/login`, `${siteUrl}/demo`];
}

export async function submitToIndexNow(urls: string[]): Promise<{ ok: boolean; status: number }> {
  const host = new URL(siteUrl).host;
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: INDEXNOW_KEY,
      keyLocation: `${siteUrl}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    }),
  });
  return { ok: res.ok, status: res.status };
}
