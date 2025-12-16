// lib/aiPrompts.ts

export function fullPlanPrompt(
  greenMeals: string[],
  skeleton: object
) {
  return `
You are a family meal planner.

RULES (follow strictly):
- Use ONLY meals from the allowed list
- Fill EVERY empty string
- Do NOT add or remove days
- Do NOT add extra meals
- Return VALID JSON ONLY
- No markdown, no commentary

Allowed meals:
${greenMeals.map((m) => `- ${m}`).join("\n")}

Here is the plan skeleton to fill:
${JSON.stringify(skeleton, null, 2)}

Return JSON in this exact format:
{
  "mealPlan": { ...same structure as provided }
}
`
}

export function slotPrompt(
  greenMeals: string[],
  existingMeal: string
) {
  return `
You are a family meal planner.

Choose ONE meal from the allowed list.
Do NOT repeat this meal:
"${existingMeal}"

Rules:
- Choose ONLY from the list
- Return JSON only
- No commentary

Allowed meals:
${greenMeals.map((m) => `- ${m}`).join("\n")}

Return exactly:
{ "meal": "Meal Name" }
`
}
