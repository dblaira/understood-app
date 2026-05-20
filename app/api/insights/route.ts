import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/from-request";
import { logServerError } from "@/lib/nutrition/server-logger";
import { runClaudeWithPresentationGuardrail } from "@/lib/ai/presentation-pipeline.server";

const SYSTEM_PROMPT = `You are a nutrition and wellness analyst. Given a user's intake data across food, water, caffeine, and supplements for the past 7-30 days, generate actionable insights.

Focus on:
1. PATTERNS — What does this person eat consistently? Where are the gaps?
2. CORRELATIONS — Does caffeine timing affect anything? Is water intake lower on rest days?
3. MACRO TARGETS — Are they hitting their goals? Which macros are consistently under/over?
4. RECOMMENDATIONS — Specific, actionable suggestions. Not generic advice. Reference their actual data.
5. TRENDS — Is anything getting better or worse over time?

Be direct and specific. Use actual numbers from the data. Make 3-5 insights, ranked by impact.

Respond with ONLY valid JSON:
{
  "insights": [
    {
      "title": string,
      "body": string,
      "type": "pattern" | "correlation" | "recommendation" | "trend" | "alert",
      "impact": "high" | "medium" | "low",
      "data_points": string[]
    }
  ],
  "summary": string,
  "data_quality": "strong" | "moderate" | "weak"
}`;

export async function POST(request: NextRequest) {
  const { user, supabase } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Fetch all four data streams in parallel
    const [mealsRes, waterRes, caffeineRes, supLogsRes, profileRes, activityRes] =
      await Promise.all([
        supabase
          .from("meals")
          .select(
            `name, date, meal_entries(quantity, foods(name, calories, protein, carbs, fat, caffeine_mg))`
          )
          .eq("user_id", user.id)
          .gte("date", thirtyDaysAgo)
          .order("date", { ascending: true }),

        supabase
          .from("water_logs")
          .select("amount_oz, logged_at")
          .eq("user_id", user.id)
          .gte("logged_at", `${thirtyDaysAgo}T00:00:00`)
          .order("logged_at", { ascending: true }),

        supabase
          .from("caffeine_logs")
          .select("source, amount_mg, logged_at")
          .eq("user_id", user.id)
          .gte("logged_at", `${thirtyDaysAgo}T00:00:00`)
          .order("logged_at", { ascending: true }),

        supabase
          .from("supplement_logs")
          .select("taken_at, supplements(name)")
          .eq("user_id", user.id)
          .gte("taken_at", `${thirtyDaysAgo}T00:00:00`),

        supabase
          .from("profiles")
          .select("calorie_goal, protein_goal, carbs_goal, fat_goal")
          .eq("id", user.id)
          .single(),

        supabase
          .from("daily_activity")
          .select("date, active_calories, steps")
          .eq("user_id", user.id)
          .gte("date", thirtyDaysAgo),
      ]);

    const meals = mealsRes.data || [];
    const waterLogs = waterRes.data || [];
    const caffeineLogs = caffeineRes.data || [];
    const supLogs = supLogsRes.data || [];
    const profile = profileRes.data;
    const activity = activityRes.data || [];

    const totalDataPoints =
      meals.length + waterLogs.length + caffeineLogs.length + supLogs.length;

    if (totalDataPoints < 10) {
      return NextResponse.json({
        insights: [],
        summary: "Not enough data yet. Keep logging for a few more days.",
        data_quality: "weak",
      });
    }

    // Aggregate daily food data
    const dailyFood: Record<string, { calories: number; protein: number; carbs: number; fat: number; meals: string[] }> = {};
    for (const meal of meals as any[]) {
      const date = meal.date;
      if (!dailyFood[date]) {
        dailyFood[date] = { calories: 0, protein: 0, carbs: 0, fat: 0, meals: [] };
      }
      dailyFood[date].meals.push(meal.name);
      for (const entry of meal.meal_entries || []) {
        const f = entry.foods;
        if (!f) continue;
        const q = entry.quantity;
        dailyFood[date].calories += f.calories * q;
        dailyFood[date].protein += Number(f.protein) * q;
        dailyFood[date].carbs += Number(f.carbs) * q;
        dailyFood[date].fat += Number(f.fat) * q;
      }
    }

    // Aggregate daily water
    const dailyWater: Record<string, number> = {};
    for (const log of waterLogs as any[]) {
      const date = log.logged_at.split("T")[0];
      dailyWater[date] = (dailyWater[date] || 0) + Number(log.amount_oz);
    }

    // Aggregate daily caffeine
    const dailyCaffeine: Record<string, { total_mg: number; latest_time: string }> = {};
    for (const log of caffeineLogs as any[]) {
      const date = log.logged_at.split("T")[0];
      const time = log.logged_at.split("T")[1]?.substring(0, 5) || "";
      if (!dailyCaffeine[date]) {
        dailyCaffeine[date] = { total_mg: 0, latest_time: time };
      }
      dailyCaffeine[date].total_mg += Number(log.amount_mg);
      if (time > dailyCaffeine[date].latest_time) {
        dailyCaffeine[date].latest_time = time;
      }
    }

    const context = JSON.stringify({
      goals: profile || { calorie_goal: 2400, protein_goal: 150, carbs_goal: 250, fat_goal: 80 },
      daily_food: dailyFood,
      daily_water: dailyWater,
      daily_caffeine: dailyCaffeine,
      supplement_log_count: supLogs.length,
      activity: activity.reduce((acc: any, a: any) => {
        acc[a.date] = { active_calories: a.active_calories, steps: a.steps };
        return acc;
      }, {}),
      period: `${thirtyDaysAgo} to today`,
    });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const guarded = await runClaudeWithPresentationGuardrail({
      supabase,
      userId: user.id,
      apiKey,
      maxTokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: context }],
    });

    const responseText = guarded.text;

    try {
      const cleaned = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      return NextResponse.json({ ...parsed, presentation: guarded.presentation });
    } catch {
      return NextResponse.json(
        { error: "Failed to parse insights", raw: responseText, presentation: guarded.presentation },
        { status: 500 }
      );
    }
  } catch (e: any) {
    logServerError("api/insights", e.message || "Internal server error", {
      stack: e.stack,
    }, user.id);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}
