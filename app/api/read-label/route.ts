import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/nutrition/server-logger";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a nutrition label reader. The user will send you a photo of a Nutrition Facts panel from a food package.

Extract the following information and return it as JSON:
{
  "product_name": "Best guess from label or packaging text visible",
  "serving_size": "e.g. 1 cup (240ml)",
  "calories": number,
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams)
}

Rules:
- Use per-serving values, not per-container
- If you cannot read a value clearly, use 0
- If you cannot identify the product name, use "Unknown Product"
- Return ONLY the JSON object, no other text
- All numeric values should be numbers, not strings`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { image, media_type } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    const resolvedType = validTypes.includes(media_type)
      ? media_type
      : "image/jpeg";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: resolvedType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: image,
              },
            },
            {
              type: "text",
              text: "Read this nutrition label and extract the nutrition facts.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Could not read the label" },
        { status: 500 }
      );
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not parse nutrition data from the label" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      found: true,
      barcode: null,
      name: parsed.product_name || "Unknown Product",
      brand: null,
      serving_size: parsed.serving_size || "1 serving",
      calories: Math.round(parsed.calories || 0),
      protein: Math.round((parsed.protein || 0) * 10) / 10,
      carbs: Math.round((parsed.carbs || 0) * 10) / 10,
      fat: Math.round((parsed.fat || 0) * 10) / 10,
      image_url: null,
      source: "label_photo",
    });
  } catch (e: any) {
    logServerError("api/read-label", e.message || "Label reading failed", {
      stack: e.stack,
    }, user.id);
    return NextResponse.json(
      { error: `Failed to read label: ${e.message}` },
      { status: 500 }
    );
  }
}
