import { createServerClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { hasFeature } from "@/lib/plan";

interface ExtractedFields {
  [key: string]: string | null;
}

interface ConfidenceScores {
  [key: string]: number;
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization + plan
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("organization_id, organizations(plan)")
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return Response.json(
        { error: "You don't have access to any organization" },
        { status: 403 }
      );
    }

    const orgId = (membership as any).organization_id;

    // OCR is a Pro/Scale feature — block on the free plan
    const plan = (membership as any).organizations?.plan ?? "free";
    if (!hasFeature(plan, "ocr")) {
      return Response.json(
        { error: "OCR document scanning is available on the Pro and Scale plans. Upgrade to unlock it.", upgradeRequired: true },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { imageUrl, documentType } = body;

    if (!imageUrl) {
      return Response.json({ error: "Image URL is required" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY not configured");
      return Response.json(
        { error: "OCR service not configured" },
        { status: 500 }
      );
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Extract image type from URL or use base64 detection
    let imageMediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" =
      "image/jpeg";
    if (imageUrl.startsWith("data:")) {
      const match = imageUrl.match(/^data:([a-z/]+);base64,/);
      if (match) {
        imageMediaType = match[1] as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp";
      }
    } else if (imageUrl.includes(".png")) {
      imageMediaType = "image/png";
    }

    // Handle base64 vs URL
    let imageSource: { type: "base64" | "url"; media_type?: string; data?: string; url?: string };
    if (imageUrl.startsWith("data:")) {
      // Extract base64 data
      const base64Data = imageUrl.split(",")[1];
      imageSource = {
        type: "base64",
        media_type: imageMediaType,
        data: base64Data,
      };
    } else {
      imageSource = {
        type: "url",
        url: imageUrl,
      };
    }

    // Call Claude Vision API with extraction prompt
    const prompt = `Extract the following information from this ${documentType || "identity"} document.
Return ONLY valid JSON (no markdown, no code blocks).

Extract these fields (return null if not found or unreadable):
- first_name
- last_name
- date_of_birth (YYYY-MM-DD format)
- gender (M/F/Other)
- nationality (full adjective form, e.g. "Serbian", "Colombian", "American" — never ISO codes like SRB, COL, USA)
- document_number
- document_expiry (YYYY-MM-DD format)
- document_type (passport/national_id/drivers_license)
- place_of_birth (city name)
- country_of_birth (full country name, e.g. "Serbia", "Colombia", "United States" — never ISO codes)

For each field, also include a confidence level (0-1) in a separate "confidence" object.
Include "warnings" array for any unreadable or unclear fields.

Response MUST be valid JSON in exactly this format:
{
  "first_name": "string or null",
  "last_name": "string or null",
  "date_of_birth": "YYYY-MM-DD or null",
  "gender": "M/F/Other or null",
  "nationality": "string or null",
  "document_number": "string or null",
  "document_expiry": "YYYY-MM-DD or null",
  "document_type": "string or null",
  "place_of_birth": "string or null",
  "country_of_birth": "string or null",
  "confidence": {
    "first_name": 0.95,
    "last_name": 0.92,
    ...
  },
  "warnings": ["any warnings about unreadable text"]
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: imageSource as any,
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    // Extract text content
    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      return Response.json(
        { error: "Failed to extract text from image" },
        { status: 500 }
      );
    }

    // Parse JSON response
    let extractionResult;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      extractionResult = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "Response:", textContent.text);
      return Response.json(
        { error: "Failed to parse OCR response" },
        { status: 500 }
      );
    }

    // Validate and clean up response
    const extractedFields: ExtractedFields = {};
    const confidence: ConfidenceScores = {};
    const warnings: string[] = extractionResult.warnings || [];

    // Map and validate extracted fields
    const fieldNames = [
      "first_name",
      "last_name",
      "date_of_birth",
      "gender",
      "nationality",
      "document_number",
      "document_expiry",
      "document_type",
      "place_of_birth",
      "country_of_birth",
    ];

    for (const field of fieldNames) {
      extractedFields[field] = extractionResult[field] || null;
      confidence[field] = extractionResult.confidence?.[field] || 0;
    }

    // Calculate overall confidence
    const confidenceValues = Object.values(confidence).filter((c) => c > 0);
    const overallConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
        : 0;

    // Save to ScanSession table for audit trail
    const { error: scanError } = await supabase.from("scan_sessions").insert({
      organization_id: orgId,
      created_by: user.id,
      token: crypto.randomUUID(),
      extracted_fields: extractedFields,
      photo_path: imageUrl.startsWith("data:") ? null : imageUrl,
      status: "completed",
    });

    if (scanError) {
      console.error("Error saving scan session:", scanError);
      // Don't fail the extraction if audit trail fails
    }

    return Response.json(
      {
        success: true,
        extractedFields,
        confidence: {
          ...confidence,
          overall: overallConfidence,
        },
        warnings,
        rawText: textContent.text,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error extracting OCR data:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
