import { Droplets, Coffee } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotificationIcon, MenuIcon } from "@/components/nutrition/PageHeaderIcons";

import { C } from "@/lib/nutrition/colors";

const fontFamily = `'Outfit', 'Avenir Next', 'Helvetica Neue', sans-serif`;

export const dynamic = "force-dynamic";

export default async function HydrationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/login");

  const today = new Date().toISOString().split("T")[0];

  const { data: waterLogs } = await supabase
    .from("water_logs")
    .select("amount_oz")
    .eq("user_id", user.id)
    .gte("logged_at", `${today}T00:00:00`)
    .lte("logged_at", `${today}T23:59:59`);

  const todayWaterOz = (waterLogs || []).reduce(
    (sum: number, row: any) => sum + Number(row.amount_oz),
    0
  );

  const { data: caffeineLogs } = await supabase
    .from("caffeine_logs")
    .select("amount_mg")
    .eq("user_id", user.id)
    .gte("logged_at", `${today}T00:00:00`)
    .lte("logged_at", `${today}T23:59:59`);

  const todayCaffeineMg = (caffeineLogs || []).reduce(
    (sum: number, row: any) => sum + Number(row.amount_mg),
    0
  );

  const waterGoal = 128;
  const caffeineLimit = 400;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${C.ocean} 0%, ${C.oceanLight} 30%, ${C.cream} 55%, ${C.white} 100%)`,
        fontFamily,
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)",
      }}
    >
      <div style={{ padding: "24px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <NotificationIcon iconColor={C.white} bgColor="rgba(255,255,255,0.15)" size={40} />
          <MenuIcon iconColor={C.white} bgColor="rgba(255,255,255,0.15)" size={40} />
        </div>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 800,
            color: C.white,
            margin: 0,
            letterSpacing: "-0.03em",
            textAlign: "center",
          }}
        >
          Hydration
        </h1>
        <p
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: C.white,
            opacity: 0.7,
            margin: "4px 0 0",
          }}
        >
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: 14,
          padding: "32px 20px 0",
        }}
      >
        {/* Water card */}
        <div
          style={{
            flex: 1,
            background: C.white,
            borderRadius: 24,
            padding: "32px 24px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            textAlign: "center",
          }}
        >
          <Droplets
            size={48}
            strokeWidth={1.5}
            color={C.ocean}
            style={{ marginBottom: 12 }}
          />
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: C.charcoal,
              lineHeight: 1,
            }}
          >
            {todayWaterOz}
            <span style={{ fontSize: 20, fontWeight: 600, color: C.warmGray }}>
              oz
            </span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: C.warmGray,
              marginTop: 6,
            }}
          >
            of {waterGoal}oz goal
          </div>
          <div
            style={{
              height: 8,
              background: C.sand,
              borderRadius: 4,
              overflow: "hidden",
              marginTop: 16,
            }}
          >
            <div
              style={{
                width: `${Math.min(
                  Math.round((todayWaterOz / waterGoal) * 100),
                  100
                )}%`,
                height: "100%",
                background: C.ocean,
                borderRadius: 4,
              }}
            />
          </div>
        </div>

        {/* Caffeine card */}
        <div
          style={{
            flex: 1,
            background: C.white,
            borderRadius: 24,
            padding: "32px 24px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            textAlign: "center",
          }}
        >
          <Coffee
            size={48}
            strokeWidth={1.5}
            color={C.ocean}
            style={{ marginBottom: 12 }}
          />
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: C.charcoal,
              lineHeight: 1,
            }}
          >
            {todayCaffeineMg}
            <span style={{ fontSize: 20, fontWeight: 600, color: C.warmGray }}>
              mg
            </span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: C.warmGray,
              marginTop: 6,
            }}
          >
            of {caffeineLimit}mg limit
          </div>
          <div
            style={{
              height: 8,
              background: C.sand,
              borderRadius: 4,
              overflow: "hidden",
              marginTop: 16,
            }}
          >
            <div
              style={{
                width: `${Math.min(
                  Math.round((todayCaffeineMg / caffeineLimit) * 100),
                  100
                )}%`,
                height: "100%",
                background: todayCaffeineMg > caffeineLimit ? C.red : C.ocean,
                borderRadius: 4,
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "32px 20px 0",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: C.warmGray,
            margin: 0,
          }}
        >
          Use the + button to log water or caffeine
        </p>
      </div>
    </div>
  );
}
