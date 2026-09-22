import { createServerClient } from "@/lib/supabase/server";
import { getPrimaryOrgSlug } from "@/lib/org-membership";
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

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  // A password-recovery link whose redirect fell back to the Site URL lands
  // here as /?code=… — forward it to the set-password form.
  const { code } = await searchParams;
  if (code) redirect(`/reset-password?code=${encodeURIComponent(code)}`);

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const slug = await getPrimaryOrgSlug(supabase, user.id);
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
