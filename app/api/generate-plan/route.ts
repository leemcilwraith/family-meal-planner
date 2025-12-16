import { NextResponse } from "next/server"
import OpenAI from "openai"
import { supabaseServer } from "@/lib/supabaseServer"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

type JoinedMeal =
  | {
      id: string
      name: string
      type: string
    }
  | {
      id: string
      name: string
      type: string
    }[]

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { householdId, daysConfig } = body

    if (!householdId) {
      console.error("❌ Missing householdId")
      return NextResponse.json({ error: "Missing householdId" }, { status: 400 })
    }

    /* -------------------------------------------------
       1. Fetch household meals WITH joined meal records
    ---------------------------------------------------*/
    const { data: rows, error } = await supabaseServer
      .from("household_meals")
      .select(
        `
        rating,
        meals (
          id,
          name,
          type
        )
      `
      )
      .eq("household_id", householdId)

    if (error) {
      console.error("❌ Supabase query error:", error)
      return NextResponse.json({ error: "DB query failed" }, { status: 500 })
    }

    console.log("🔎 RAW household_meals rows:", JSON.stringify(rows, null, 2))

    if (!rows || rows.length === 0) {
      console.error("❌ No household_meals rows found")
      return NextResponse.json(
        { error: "No meals linked to household" },
        { status: 400 }
      )
    }

    /* -------------------------------------------------
       2. Extract GREEN MEALS safely
    ---------------------------------------------------*/
    const greenMeals: string[] = []

    for (const row of rows as { rating: string; meals: JoinedMeal | null }[]) {
      if (row.rating !== "green" || !row.meals) continue

      const meal = Array.isArray(row.meals) ? row.meals[0] : row.meals

      if (!meal) continue
      if (meal.type !== "meal") continue

      greenMeals.push(meal.name)
    }

    console.log("✅ GREEN MEALS FOUND:", greenMeals)

    if (greenMeals.length === 0) {
      console.error("❌ Green meals array empty AFTER processing")
      return NextResponse.json(
        {
          error: "No green meals exist for this household",
          debug: rows,
        },
        { status: 400 }
      )
    }

    /* -------------------------------------------------
       3. Build plan skeleton from selected days/meals
    ---------------------------------------------------*/
    const plan: Record<string, { lunch?: string; dinner?: string }> = {}

    for (const day of Object.keys(daysConfig || {})) {
      plan[day] = {}
      if (daysConfig[day].lunch) plan[day].lunch = ""
      if (daysConfig[day].dinner) plan[day].dinner = ""
    }

    /* -------------------------------------------------
       4. Ask OpenAI to fill the plan
    ---------------------------------------------------*/
    const prompt = `
You are a family meal planner.

Only choose meals from this list:
${greenMeals.map((m) => `- ${m}`).join("\n")}

Fill in the following meal plan using ONLY meals from the list above.

Return VALID JSON ONLY in this exact format:
{
  "mealPlan": {
    "Monday": { "lunch": "...", "dinner": "..." }
  }
}

Here is the plan skeleton:
${JSON.stringify(plan, null, 2)}
`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    })

    let raw = completion.choices[0].message.content || ""
    raw = raw.replace(/```json|```/g, "").trim()

    console.log("🧠 RAW AI OUTPUT:", raw)

    const parsed = JSON.parse(raw)

    return NextResponse.json({ plan: parsed.mealPlan })
  } catch (err: any) {
    console.error("🔥 AI GENERATION ERROR:", err)
    return NextResponse.json(
      { error: "Failed to generate plan", details: err.message },
      { status: 500 }
    )
  }
}
