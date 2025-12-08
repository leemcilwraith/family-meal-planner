"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export default function Step1() {
  const router = useRouter()

  const [authLoaded, setAuthLoaded] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [hasRun, setHasRun] = useState(false)

  // 1️⃣ Load Supabase auth session once
  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      setUser(data.session?.user || null)
      setAuthLoaded(true)
    }
    loadSession()
  }, [])

  // 2️⃣ Main onboarding logic — runs once when auth is loaded + user present
  useEffect(() => {
    if (!authLoaded) return
    if (hasRun) return

    async function run() {
      // No user → go to login
      if (!user) {
        router.push("/login")
        return
      }

      setHasRun(true)

      // A. Does user already have a household?
      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (link?.household_id) {
        // B. See if settings exist
        const { data: settings } = await supabase
          .from("household_settings")
          .select("onboarding_step")
          .eq("household_id", link.household_id)
          .maybeSingle()

        if (settings?.onboarding_step) {
          // Resume at the correct step
          router.push(`/onboarding/step-${settings.onboarding_step}`)
          return
        }

        // No settings yet → create them, start at step 2
        await supabase.from("household_settings").insert({
          household_id: link.household_id,
          risk_level: 5,
          prep_time_preference: "standard",
          kids_appetite: "medium",
          onboarding_step: 2,
        })

        router.push("/onboarding/step-2")
        return
      }

      // C. No household yet → create one
      const { data: household, error: hErr } = await supabase
        .from("households")
        .insert({})
        .select()
        .single()

      if (hErr || !household) {
        console.error("Household creation failed:", hErr)
        return
      }

      // D. Link user to household
      await supabase.from("user_households").insert({
        user_id: user.id,
        household_id: household.id,
        role: "owner",
      })

      // E. Create initial settings row
      await supabase.from("household_settings").insert({
        household_id: household.id,
        risk_level: 5,
        prep_time_preference: "standard",
        kids_appetite: "medium",
        onboarding_step: 2,
      })

      // F. Go to Step 2
      router.push("/onboarding/step-2")
    }

    run()
  }, [authLoaded, user, hasRun, router])

  // 3️⃣ Simple loading UI (no early returns before hooks)
  return (
    <div className="pt-20 text-center">
      <h1 className="text-3xl font-semibold">Setting up your household…</h1>
      <p className="text-gray-600 mt-2">Please wait a moment.</p>
    </div>
  )
}
