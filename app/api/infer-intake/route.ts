import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUserFromRequest } from "@/lib/supabase/from-request";
import { logServerError } from "@/lib/nutrition/server-logger";

const anthropic = new Anthropic();

interface FoodItem {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  caffeine_mg: number;
  confidence: "high" | "medium" | "low";
}

interface InferredIntake {
  type: "food" | "water" | "caffeine" | "supplement" | "multi";
  meal_name?: string;
  items?: FoodItem[];
  water_oz?: number;
  caffeine_source?: string;
  caffeine_mg?: number;
  supplements?: string[];
  raw_text: string;
}

const SYSTEM_PROMPT = `You are a nutrition intake parser. Given natural language text about food, water, caffeine, or supplements, classify it and extract structured data.

RULES:
1. Classify the input into one type: "food", "water", "caffeine", "supplement", or "multi" (if it contains more than one type).
2. For food: parse each distinct food item with estimated macros per the quantity described. Use USDA-standard values. If the user says "my usual X" or gives no quantity, use reasonable single-serving defaults.
3. For water: extract the amount in fluid ounces. Convert from cups (1 cup = 8oz), liters (1L ≈ 33.8oz), ml, glasses (1 glass = 8oz), bottles (1 bottle = 16.9oz).
4. For caffeine: identify the source and amount in mg. Common values: espresso shot = 63mg, 8oz coffee = 95mg, 12oz coffee = 140mg, 16oz coffee = 190mg, green tea 8oz = 28mg, pre-workout scoop ≈ 200mg, Diet Coke 12oz = 46mg, Red Bull 8.4oz = 80mg.
5. For supplements: list the supplement names mentioned.
6. For "multi": include all relevant fields.
7. Try to infer the meal context (Breakfast, Lunch, Dinner, Snack) from time references or food types. Default to null if unclear.

Respond with ONLY valid JSON matching this schema:
{
  "type": "food" | "water" | "caffeine" | "supplement" | "multi",
  "meal_name": "Breakfast" | "Lunch" | "Dinner" | "Snack" | null,
  "items": [{ "name": string, "quantity": number, "unit": string, "calories": number, "protein": number, "carbs": number, "fat": number, "caffeine_mg": number, "confidence": "high"|"medium"|"low" }],
  "water_oz": number | null,
  "caffeine_source": string | null,
  "caffeine_mg": number | null,
  "supplements": string[] | null
}`;

export async function POST(request: NextRequest) {
  const { user, supabase } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { content } = await request.json();

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Fetch user's recent food history for context
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data: recentMeals } = await supabase
      .from("meals")
      .select(
        `name, date, meal_entries(quantity, foods(name, calories, protein, carbs, fat, caffeine_mg, serving_size))`
      )
      .eq("user_id", user.id)
      .gte("date", weekAgo)
      .order("date", { ascending: false })
      .limit(20);

    // Fetch user's supplement stack
    const { data: supplements } = await supabase
      .from("supplements")
      .select("name, brand, default_dosage, time_of_day")
      .eq("user_id", user.id);

    let historyContext = "";
    if (recentMeals && recentMeals.length > 0) {
      const entries = recentMeals.flatMap((meal: any) =>
        (meal.meal_entries || []).map((e: any) => ({
          meal: meal.name,
          date: meal.date,
          food: e.foods?.name,
          qty: e.quantity,
          serving: e.foods?.serving_size,
          cal: e.foods?.calories,
          protein: e.foods?.protein,
          carbs: e.foods?.carbs,
          fat: e.foods?.fat,
        }))
      );
      historyContext = `\n\nUser's recent food history (use these exact portions when user says "my usual" or similar):\n${JSON.stringify(entries.slice(0, 30))}`;
    }

    if (supplements && supplements.length > 0) {
      historyContext += `\n\nUser's supplement stack:\n${JSON.stringify(supplements)}`;
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT + historyContext,
      messages: [{ role: "user", content: content.trim() }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse the JSON response, stripping markdown fences if present
    let parsed: InferredIntake;
    try {
      const cleaned = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
      parsed.raw_text = content.trim();
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: responseText },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (e: any) {
    logServerError("api/infer-intake", e.message || "Internal server error", {
      stack: e.stack,
    }, user.id);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}
