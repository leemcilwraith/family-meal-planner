import { NextResponse } from "next/server"
import OpenAI from "openai"
import { supabaseServer } from "@/lib/supabaseServer"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export async function POST(req: Request) {
  try {
    const { householdId, weekStart } = await req.json()

    if (!householdId || !weekStart) {
      return NextResponse.json(
        { error: "Missing householdId or weekStart" },
        { status: 400 }
      )
    }

    /* ---------------------------------------
       1. Load weekly plan
    ----------------------------------------*/
    const { data: planRow, error } = await supabaseServer
      .from("weekly_plans")
      .select("plan_json")
      .eq("household_id", householdId)
      .eq("week_start", weekStart)
      .maybeSingle()

    if (error || !planRow?.plan_json) {
      return NextResponse.json(
        { error: "No plan found for this week" },
        { status: 400 }
      )
    }

    const plan = planRow.plan_json

    /* ---------------------------------------
       2. Ask AI to extract ingredients
    ----------------------------------------*/
    const prompt = `
You are generating a family shopping list.

TASK:
- Convert the weekly meal plan into a shopping list
- Extract INGREDIENTS, not meals
- Group items into logical supermarket sections
- Keep quantities vague (no numbers)
- Avoid duplicates
- Family-friendly ingredients only

WEEKLY PLAN:
${JSON.stringify(plan, null, 2)}

OUTPUT FORMAT (JSON ONLY):
{
  "Meat & Fish": [
    { "name": "Chicken breast", "checked": false }
  ],
  "Vegetables": [
    { "name": "Carrots", "checked": false }
  ],
  "Carbs": [
    { "name": "Rice", "checked": false }
  ],
  "Dairy": [],
  "Other": []
}
`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    })

    const raw = completion.choices[0].message.content
      ?.replace(/```json|```/g, "")
      .trim()

    const items = JSON.parse(raw || "{}")

    /* ---------------------------------------
       3. Save shopping list
    ----------------------------------------*/
    await supabaseServer
      .from("shopping_lists")
      .upsert(
        {
          household_id: householdId,
          week_start: weekStart,
          items,
        },
        { onConflict: "household_id,week_start" }
      )

    return NextResponse.json({ items })
  } catch (err: any) {
    console.error("🔥 SHOPPING LIST ERROR", err)
    return NextResponse.json(
      { error: "Failed to generate shopping list", details: err.message },
      { status: 500 }
    )
  }
}
