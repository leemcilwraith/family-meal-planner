"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"

export default function ShoppingListPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState("")
  const [items, setItems] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession()
      const user = session.session?.user
      if (!user) return

      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!link?.household_id) return

      const hid = link.household_id
      setHouseholdId(hid)

      const week = new Date().toISOString().slice(0, 10)
      setWeekStart(week)

      const { data } = await supabase
        .from("shopping_lists")
        .select("items")
        .eq("household_id", hid)
        .eq("week_start", week)
        .maybeSingle()

      if (data?.items) {
        setItems(data.items)
      }

      setLoading(false)
    }

    load()
  }, [])

  async function generateList() {
    if (!householdId || !weekStart) return

    const res = await fetch("/api/generate-shopping-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ householdId, weekStart }),
    })

    const data = await res.json()
    setItems(data.items)
  }

  if (loading) return <p>Loading shopping list…</p>

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Shopping List</h1>

      {!items && (
        <Button onClick={generateList}>Generate Shopping List</Button>
      )}

      {items &&
        Object.entries(items).map(([group, list]: any) => (
          <div key={group}>
            <h2 className="text-xl font-semibold mb-2">{group}</h2>
            <ul className="space-y-1">
              {list.map((item: any, idx: number) => (
                <li key={idx} className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked={item.checked} />
                  <span>{item.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  )
}
