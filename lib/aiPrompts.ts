// lib/aiPrompts.ts

export function fullPlanPrompt({
  greenMeals,
  redMeals,
  foods,
  riskLevel,
  prepTime,
  appetite,
  skeleton,
}: {
  greenMeals: string[]
  redMeals: string[]
  foods: string[]
  riskLevel: number
  prepTime: string
  appetite: string
  skeleton: object
}) {
  return `
You are a family meal planner for young children.

Your goal is to produce a weekly meal plan that the children are likely to enjoy.

--------------------------------------------------
KNOWN PREFERENCES
--------------------------------------------------

Meals the children LIKE (safe meals):
${greenMeals.map((m) => `- ${m}`).join("\n")}

Meals the children DISLIKE (never include these):
${redMeals.map((m) => `- ${m}`).join("\n")}

Foods the children are comfortable eating:
${foods.map((f) => `- ${f}`).join("\n")}

--------------------------------------------------
ADVENTURE LEVEL
--------------------------------------------------

The current meal adventure level is: ${riskLevel} / 10

Rules:
- If adventure level is 0:
  - Use ONLY meals from the "liked meals" list
- If adventure level is 1–3:
  - Mostly liked meals
  - Very small variations only
- If adventure level is 4–6:
  - Mix of liked meals and NEW meals based on familiar foods
- If adventure level is 7–9:
  - Mostly new meals based on familiar foods
- If adventure level is 10:
  - Freely invent meals using familiar foods
  - Still NEVER include disliked meals

--------------------------------------------------
PRACTICAL CONSTRAINTS
--------------------------------------------------

Prep & cooking time preference:
${prepTime}

Appetite size:
${appetite}

Guidance:
- Bigger appetites → heartier meals
- Quick prep → simple, familiar dishes
- Longer prep allowed → slightly more complex meals

--------------------------------------------------
PLAN STRUCTURE (MUST FOLLOW EXACTLY)
--------------------------------------------------

Fill in the following plan.
- Do NOT add or remove days
- Do NOT add extra meal slots
- Fill every empty string
- Return VALID JSON ONLY
- No commentary, no markdown

${JSON.stringify(skeleton, null, 2)}

--------------------------------------------------
OUTPUT FORMAT
--------------------------------------------------

Return JSON in this exact format:

{
  "mealPlan": {
    "Monday": { "lunch": "...", "dinner": "..." }
  }
}
`
}

export function slotPrompt({
  greenMeals,
  redMeals,
  foods,
  riskLevel,
  prepTime,
  appetite,
  existingMeal,
}: {
  greenMeals: string[]
  redMeals: string[]
  foods: string[]
  riskLevel: number
  prepTime: string
  appetite: string
  existingMeal: string
}) {
  return `
You are a family meal planner helping replace ONE meal in a weekly plan.

--------------------------------------------------
CURRENT MEAL TO REPLACE
--------------------------------------------------

"${existingMeal}"

You MUST choose a DIFFERENT meal.

--------------------------------------------------
KNOWN PREFERENCES
--------------------------------------------------

Meals the children LIKE (safe meals):
${greenMeals.map((m) => `- ${m}`).join("\n")}

Meals the children DISLIKE (never include these):
${redMeals.map((m) => `- ${m}`).join("\n")}

Foods the children are comfortable eating:
${foods.map((f) => `- ${f}`).join("\n")}

--------------------------------------------------
ADVENTURE LEVEL
--------------------------------------------------

Current meal adventure level: ${riskLevel} / 10

Rules:
- If adventure level is 0:
  - Choose ONLY from the liked meals list
- If adventure level is 1–3:
  - Prefer liked meals
  - Very small variations allowed
- If adventure level is 4–6:
  - Mix liked meals with NEW meals based on familiar foods
- If adventure level is 7–9:
  - Prefer new meals based on familiar foods
- If adventure level is 10:
  - Freely invent a meal using familiar foods
  - Still NEVER include disliked meals

--------------------------------------------------
PRACTICAL CONSTRAINTS
--------------------------------------------------

Prep & cooking time preference:
${prepTime}

Appetite size:
${appetite}

Guidance:
- Bigger appetites → heartier meals
- Quick prep → simple, familiar dishes
- Longer prep allowed → slightly more complex meals

--------------------------------------------------
STRICT RULES
--------------------------------------------------

- Do NOT return the existing meal
- Do NOT include any disliked meals
- Choose ONE sensible replacement meal
- Return VALID JSON ONLY
- No commentary
- No markdown

--------------------------------------------------
OUTPUT FORMAT (EXACT)
--------------------------------------------------

{
  "meal": "Meal Name"
}
`
}

