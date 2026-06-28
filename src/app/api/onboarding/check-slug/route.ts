import { createServiceClient } from "@/lib/supabase/server";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("slug") ?? "";
  const slug = slugify(raw);

  if (!slug) return Response.json({ available: false, error: "Invalid slug" });
  if (slug.length < 2) return Response.json({ available: false, error: "Too short" });
  if (slug.length > 63) return Response.json({ available: false, error: "Too long" });

  try {
    const service = await createServiceClient();
    const { data } = await service
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single();

    return Response.json({ slug, available: !data });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
