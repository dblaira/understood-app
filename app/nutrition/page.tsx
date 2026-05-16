import { Dumbbell, Utensils, Droplets } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { QuickLogButtons } from "@/components/nutrition/QuickLogButtons";
import { DashboardTopBar } from "@/components/nutrition/DashboardTopBar";
import { C } from "@/lib/nutrition/colors";

const fontFamily = `'Outfit', 'Avenir Next', 'Helvetica Neue', sans-serif`;

export const dynamic = "force-dynamic";

/* ═══════════════════════════════════════════════════════════ */

/* ── Massive Calorie Ring — Optimism Sun Poster Style ── */
function CalorieRing({
  consumed,
  goal,
}: {
  consumed: number;
  goal: number;
}) {
  const size = 300;
  const strokeWidth = 18;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(consumed / goal, 1);
  const offset = circumference * (1 - pct);
  const remaining = Math.max(goal - consumed, 0);
  const pctDisplay = Math.round(pct * 100);

  return (
    <div style={{ position: "relative", width: size, height: size + 60 }}>
      {/* Decorative concentric glow rings — inspired by the sunset poster */}
      <svg
        width={size}
        height={size}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 2} fill={C.sunPale} opacity={0.35} />
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 22} fill={C.sunLight} opacity={0.25} />
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 44} fill={C.sun} opacity={0.18} />
      </svg>

      {/* Progress ring */}
      <svg
        width={size}
        height={size}
        style={{ position: "relative", transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={C.orange + "18"}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={C.orange}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>

      {/* Center content */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size,
          height: size,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: C.charcoal,
            fontFamily,
            lineHeight: 1,
          }}
        >
          {remaining}
        </span>
        <span
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: C.warmGray,
            fontFamily,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginTop: 4,
          }}
        >
          cal remaining
        </span>
      </div>

      {/* Half-circle motif below — the Optimism sun mark */}
      <svg
        width={200}
        height={60}
        viewBox="0 0 200 60"
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        <path
          d="M 10 60 A 90 90 0 0 1 190 60"
          fill={C.white}
          opacity={0.7}
        />
      </svg>

      {/* Percentage in the half-circle */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 18,
          fontWeight: 800,
          color: C.charcoal,
          fontFamily,
          opacity: 0.5,
        }}
      >
        {pctDisplay}%
      </div>
    </div>
  );
}

/* ── Types ── */
interface MealEntry {
  id: string;
  quantity: number;
  foods: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
}

interface Meal {
  id: string;
  name: string;
  meal_entries: MealEntry[];
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE — Server Component
   ═══════════════════════════════════════════════════════════ */
export default async function Home() {
  const supabase = await createClient();

  /* ── Auth ── */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  /* ── Profile ── */
  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    const { data: newProfile, error } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || "Friend",
      })
      .select()
      .single();
    if (!error) profile = newProfile;
  }

  /* ── Today's meals ── */
  const today = new Date().toISOString().split("T")[0];

  const { data: meals } = await supabase
    .from("meals")
    .select(
      `
      id,
      name,
      meal_entries (
        id,
        quantity,
        foods (
          name,
          calories,
          protein,
          carbs,
          fat
        )
      )
    `
    )
    .eq("user_id", user.id)
    .eq("date", today);

  /* ── Calculate totals ── */
  let consumed = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const recentActivity: {
    id: string;
    name: string;
    calories: number;
    meal: string;
  }[] = [];

  (meals as unknown as Meal[])?.forEach((meal) => {
    meal.meal_entries.forEach((entry) => {
      const food = entry.foods;
      if (!food) return;
      const m = entry.quantity;
      consumed.calories += food.calories * m;
      consumed.protein += food.protein * m;
      consumed.carbs += food.carbs * m;
      consumed.fat += food.fat * m;
      recentActivity.push({
        id: entry.id,
        name: food.name,
        calories: Math.round(food.calories * m),
        meal: meal.name,
      });
    });
  });

  consumed = {
    calories: Math.round(consumed.calories),
    protein: Math.round(consumed.protein),
    carbs: Math.round(consumed.carbs),
    fat: Math.round(consumed.fat),
  };

  const goals = {
    calories: profile?.calorie_goal || 2400,
    protein: profile?.protein_goal || 150,
    carbs: profile?.carbs_goal || 250,
    fat: profile?.fat_goal || 80,
  };

  const firstName =
    profile?.full_name?.split(" ")[0] ||
    profile?.email?.[0]?.toUpperCase() ||
    "Friend";

  /* ── Today's water & caffeine totals ── */
  const { data: waterLogs } = await supabase
    .from("water_logs")
    .select("amount_oz")
    .eq("user_id", user.id)
    .gte("logged_at", `${today}T00:00:00`)
    .lte("logged_at", `${today}T23:59:59`);

  const todayWaterOz = (waterLogs || []).reduce(
    (sum: number, row: any) => sum + Number(row.amount_oz), 0
  );

  const { data: caffeineLogs } = await supabase
    .from("caffeine_logs")
    .select("amount_mg")
    .eq("user_id", user.id)
    .gte("logged_at", `${today}T00:00:00`)
    .lte("logged_at", `${today}T23:59:59`);

  const todayCaffeineMg = (caffeineLogs || []).reduce(
    (sum: number, row: any) => sum + Number(row.amount_mg), 0
  );

  /* Today's workout route */
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayWorkoutSlug = dayNames[new Date().getDay()];
  const todayWorkoutHref = `/workouts/${todayWorkoutSlug}`;

  /* Macro carousel data */
  const macros = [
    {
      label: "Protein",
      consumed: consumed.protein,
      goal: goals.protein,
      unit: "g",
      bg: C.magenta,
      bgLight: "#C92585",
      textColor: C.white,
      barBg: "rgba(255,255,255,0.2)",
      barFill: C.white,
    },
    {
      label: "Carbs",
      consumed: consumed.carbs,
      goal: goals.carbs,
      unit: "g",
      bg: C.ocean,
      bgLight: C.oceanLight,
      textColor: C.white,
      barBg: "rgba(255,255,255,0.2)",
      barFill: C.white,
    },
    {
      label: "Fat",
      consumed: consumed.fat,
      goal: goals.fat,
      unit: "g",
      bg: C.orange,
      bgLight: "#FBBA42",
      textColor: C.white,
      barBg: "rgba(255,255,255,0.2)",
      barFill: C.white,
    },
  ];

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${C.sun} 0%, ${C.sunLight} 30%, ${C.sand} 55%, ${C.cream} 100%)`,
        fontFamily,
        overflowX: "hidden",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)",
      }}
    >
      {/* ══════════ TOP BAR ══════════ */}
      <DashboardTopBar firstName={firstName} />

      {/* ══════════ CALORIE HERO — poster-scale ══════════ */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "36px 20px 0",
        }}
      >
        <CalorieRing consumed={consumed.calories} goal={goals.calories} />

        {/* Big stat row */}
        <div
          style={{
            display: "flex",
            gap: 40,
            marginTop: 20,
            textAlign: "center",
          }}
        >
          {[
            { label: "Consumed", value: consumed.calories },
            { label: "Goal", value: goals.calories },
          ].map((s) => (
            <div key={s.label}>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: C.charcoal,
                  fontFamily,
                  lineHeight: 1,
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.warmGray,
                  fontFamily,
                  marginTop: 4,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════ MACRO CAROUSEL — swipe right ══════════ */}
      <div style={{ marginTop: 40 }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: C.charcoal,
            margin: "0 0 16px",
            padding: "0 20px",
            fontFamily,
          }}
        >
          Macros
        </h2>

        <div
          className="hide-scrollbar"
          style={{
            display: "flex",
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            gap: 14,
            paddingLeft: 20,
            paddingRight: 20,
          }}
        >
          {macros.map((macro) => {
            const pct = Math.min(
              Math.round((macro.consumed / macro.goal) * 100),
              100
            );
            return (
              <div
                key={macro.label}
                style={{
                  scrollSnapAlign: "start",
                  flexShrink: 0,
                  width: "78vw",
                  minHeight: 200,
                  background: macro.bg,
                  borderRadius: 24,
                  padding: "28px 24px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Decorative circle — poster motif */}
                <div
                  style={{
                    position: "absolute",
                    right: -30,
                    top: -30,
                    width: 160,
                    height: 160,
                    borderRadius: "50%",
                    background: macro.bgLight,
                    opacity: 0.3,
                  }}
                />

                <div style={{ position: "relative", zIndex: 1 }}>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: macro.textColor,
                      fontFamily,
                      opacity: 0.7,
                      marginBottom: 8,
                    }}
                  >
                    {macro.label}
                  </div>
                  <div
                    style={{
                      fontSize: 56,
                      fontWeight: 800,
                      color: macro.textColor,
                      fontFamily,
                      lineHeight: 1,
                    }}
                  >
                    {macro.consumed}
                    <span style={{ fontSize: 24, fontWeight: 600, opacity: 0.6 }}>
                      {macro.unit}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: macro.textColor,
                      fontFamily,
                      opacity: 0.5,
                      marginTop: 4,
                    }}
                  >
                    of {macro.goal}
                    {macro.unit} goal
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ position: "relative", zIndex: 1, marginTop: 20 }}>
                  <div
                    style={{
                      height: 10,
                      background: macro.barBg,
                      borderRadius: 5,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: macro.barFill,
                        borderRadius: 5,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      fontSize: 14,
                      fontWeight: 700,
                      color: macro.textColor,
                      fontFamily,
                      marginTop: 6,
                      opacity: 0.6,
                    }}
                  >
                    {pct}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════ QUICK ACTIONS — oversized icons, no labels ══════════ */}
      <div
        style={{
          padding: "40px 20px 0",
          display: "flex",
          gap: 12,
        }}
      >
        {(
          [
            {
              label: "Log Food",
              icon: <Utensils size={120} strokeWidth={1.2} />,
              bg: C.red,
              color: C.white,
              href: "/log-food",
            },
            {
              label: "Workouts",
              icon: <Dumbbell size={120} strokeWidth={1.2} />,
              bg: C.sun,
              color: C.charcoal,
              href: todayWorkoutHref,
            },
            {
              label: "Water",
              icon: <Droplets size={120} strokeWidth={1.2} />,
              bg: C.ocean,
              color: C.white,
              href: "#",
            },
          ]
        ).map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-label={item.label}
            style={{
              flex: 1,
              background: item.bg,
              borderRadius: 22,
              height: 120,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              textDecoration: "none",
              overflow: "hidden",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              position: "relative",
            }}
          >
            <div
              style={{
                color: item.color,
                opacity: 0.85,
                marginBottom: -28,
              }}
            >
              {item.icon}
            </div>
          </Link>
        ))}
      </div>

      {/* ══════════ QUICK LOG BUTTONS ══════════ */}
      <div style={{ marginTop: 28 }}>
        <QuickLogButtons todayWaterOz={todayWaterOz} todayCaffeineMg={todayCaffeineMg} />
      </div>

      {/* ══════════ TODAY'S TRAINING — massive, bold ══════════ */}
      <div style={{ padding: "28px 20px 0" }}>
        <Link href={todayWorkoutHref} style={{ textDecoration: "none" }}>
          <div
            style={{
              background: C.charcoal,
              borderRadius: 24,
              padding: "40px 28px",
              boxShadow: "0 6px 30px rgba(0,0,0,0.15)",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              minHeight: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Decorative */}
            <div
              style={{
                position: "absolute",
                right: -40,
                top: -40,
                width: 200,
                height: 200,
                borderRadius: "50%",
                background: C.red,
                opacity: 0.12,
              }}
            />
            <div
              style={{
                position: "absolute",
                right: 20,
                bottom: -30,
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: C.sun,
                opacity: 0.08,
              }}
            />

            <h3
              style={{
                margin: 0,
                fontSize: 44,
                fontWeight: 800,
                color: C.cream,
                fontFamily,
                lineHeight: 1,
                position: "relative",
                zIndex: 1,
                textAlign: "center",
                width: "100%",
              }}
            >
              Training
            </h3>
          </div>
        </Link>
      </div>

      {/* ══════════ MEALS — white card, brown border ══════════ */}
      <div style={{ padding: "14px 20px 0" }}>
        <Link href="/log-food" style={{ textDecoration: "none" }}>
          <div
            style={{
              background: C.white,
              borderRadius: 24,
              padding: "40px 28px",
              boxShadow: "0 6px 30px rgba(0,0,0,0.06)",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              minHeight: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `4px solid ${C.charcoal}`,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 44,
                fontWeight: 800,
                color: C.charcoal,
                fontFamily,
                lineHeight: 1,
                textAlign: "center",
                width: "100%",
              }}
            >
              Meals
            </h3>
          </div>
        </Link>
      </div>

      {/* ══════════ RECENT MEALS ══════════ */}
      <div style={{ padding: "14px 20px 0" }}>
        <div
          style={{
            background: C.white,
            borderRadius: 24,
            padding: 24,
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          }}
        >
          {recentActivity.length > 0 ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 18px",
                    background: C.sand,
                    borderRadius: 16,
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 18,
                        fontWeight: 700,
                        color: C.charcoal,
                        fontFamily,
                      }}
                    >
                      {item.name}
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: 14,
                        color: C.warmGray,
                        fontFamily,
                      }}
                    >
                      {item.meal}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: C.orange,
                      fontFamily,
                    }}
                  >
                    {item.calories}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: "36px 0",
                textAlign: "center",
                fontFamily,
              }}
            >
              <p
                style={{
                  fontSize: 18,
                  color: C.warmGray,
                  margin: "0 0 12px",
                }}
              >
                No meals logged yet today.
              </p>
              <Link
                href="/log-food"
                style={{
                  color: C.ocean,
                  fontWeight: 700,
                  textDecoration: "none",
                  fontSize: 18,
                }}
              >
                Log your first meal &rarr;
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
