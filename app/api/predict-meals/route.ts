import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUserFromRequest } from "@/lib/supabase/from-request";
import { logServerError } from "@/lib/nutrition/server-logger";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a meal prediction engine. Given a user's eating history over the past 2-4 weeks, predict what they will likely eat for each meal slot (Breakfast, Lunch, Dinner, Snack) for each day of the upcoming week (Monday through Sunday).

RULES:
1. People who track nutrition are highly repetitive. Look for patterns: same breakfast every weekday, same lunch rotation, etc.
2. Predict specific foods with exact quantities and macros based on what you see in the history.
3. Assign a confidence level to each prediction: "high" (>80% likely, user eats this most days), "medium" (50-80%, appears regularly), "low" (<50%, extrapolated from limited data).
4. If there's not enough data to predict a meal slot, omit it.
5. Distinguish weekdays from weekends if the pattern differs.

Respond with ONLY valid JSON matching this schema:
{
  "predictions": [
    {
      "day": "Monday" | "Tuesday" | ... | "Sunday",
      "meals": [
        {
          "meal_name": "Breakfast" | "Lunch" | "Dinner" | "Snack",
          "confidence": "high" | "medium" | "low",
          "items": [
            {
              "name": string,
              "quantity": number,
              "unit": string,
              "calories": number,
              "protein": number,
              "carbs": number,
              "fat": number
            }
          ]
        }
      ]
    }
  ],
  "patterns_detected": string[],
  "data_quality": "strong" | "moderate" | "weak"
}`;

export async function POST(request: NextRequest) {
  const { user, supabase } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data: meals } = await supabase
      .from("meals")
      .select(
        `name, date, meal_entries(quantity, foods(name, calories, protein, carbs, fat, serving_size))`
      )
      .eq("user_id", user.id)
      .gte("date", threeWeeksAgo)
      .order("date", { ascending: true });

    if (!meals || meals.length < 7) {
      return NextResponse.json({
        error: "Not enough data yet",
        detail: `Found ${meals?.length || 0} meals. Need at least 7 for meaningful predictions. Keep logging for another week or two.`,
        predictions: [],
        data_quality: "weak",
      });
    }

    // Format history for Claude
    const history = meals.map((meal: any) => {
      const dayOfWeek = new Date(meal.date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
      });
      return {
        day: dayOfWeek,
        date: meal.date,
        meal: meal.name,
        items: (meal.meal_entries || []).map((e: any) => ({
          food: e.foods?.name,
          qty: e.quantity,
          serving: e.foods?.serving_size,
          cal: e.foods?.calories,
          protein: e.foods?.protein,
          carbs: e.foods?.carbs,
          fat: e.foods?.fat,
        })),
      };
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("calorie_goal, protein_goal, carbs_goal, fat_goal")
      .eq("id", user.id)
      .single();

    const goalsContext = profile
      ? `\n\nUser's daily goals: ${profile.calorie_goal} cal, ${profile.protein_goal}g protein, ${profile.carbs_goal}g carbs, ${profile.fat_goal}g fat.`
      : "";

    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT + goalsContext,
      messages: [
        {
          role: "user",
          content: `Here is my eating history from the past ${meals.length} meals over ${Math.ceil((Date.now() - new Date(threeWeeksAgo).getTime()) / (24 * 60 * 60 * 1000))} days:\n\n${JSON.stringify(history)}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    try {
      const cleaned = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse predictions", raw: responseText },
        { status: 500 }
      );
    }
  } catch (e: any) {
    logServerError("api/predict-meals", e.message || "Internal server error", {
      stack: e.stack,
    }, user.id);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}
