import { INDEXNOW_KEY, indexNowUrls, submitToIndexNow } from "@/lib/indexnow";

// GET /api/indexnow?key=<INDEXNOW_KEY>[&url=https://...]
// Submits the public URLs to IndexNow (Bing/Yandex). Hit it after a deploy, or
// wire it to a Vercel Deploy Hook / GitHub Action so it runs automatically.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("key") !== INDEXNOW_KEY) {
    return Response.json({ error: "Invalid key" }, { status: 403 });
  }
  const custom = searchParams.getAll("url");
  const urls = custom.length > 0 ? custom : indexNowUrls();
  try {
    const result = await submitToIndexNow(urls);
    return Response.json({ submitted: urls, ...result });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
