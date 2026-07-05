import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/landing-page";
import { FAQS } from "@/lib/seo-faq";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hostmagsmart.com";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "HostMagSmart",
      url: siteUrl,
      logo: `${siteUrl}/botanical/logo.png`,
      description: "Smart property-management software for independent hostels.",
    },
    {
      "@type": "WebSite",
      name: "HostMagSmart",
      url: siteUrl,
    },
    {
      "@type": "SoftwareApplication",
      name: "HostMagSmart",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: siteUrl,
      description:
        "Hostel PMS with reservations, tape calendar, channel manager, guest self check-in, housekeeping and analytics.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default async function RootPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id, organizations(slug)")
      .eq("user_id", user.id)
      .single();
    const slug = (membership as any)?.organizations?.slug;
    redirect(slug ? `/${slug}/dashboard` : "/onboarding");
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
