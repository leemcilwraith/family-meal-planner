"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export default function Step1() {
  const router = useRouter()

  useEffect(() => {
    async function init() {
      // Get session
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) {
        router.push("/login")
        return
      }
      const userId = user.id

      // Does user already have a household?
      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", userId)
        .maybeSingle()

      if (link?.household_id) {
        const { data: settings } = await supabase
          .from("household_settings")
          .select("onboarding_step")
          .eq("household_id", link.household_id)
          .single()

        router.push(`/onboarding/step-${settings.onboarding_step}`)
        return
      }

      // Create household
      const { data: household, error: hErr } = await supabase
        .from("households")
        .insert({})
        .select()
        .single()

      if (hErr || !household) {
        console.error(hErr)
        return
      }

      // Link user
      await supabase.from("user_households").insert({
        user_id: userId,
        household_id: household.id,
        role: "owner",
      })

      // Create settings
      await supabase.from("household_settings").insert({
        household_id: household.id,
        risk_level: 5,
        prep_time_preference: "standard",
        kids_appetite: "medium",
        onboarding_step: 2,
      })

      router.push("/onboarding/step-2")
    }

    init()
  }, [])

  return (
    <div className="pt-20 space-y-6 text-center">
      <h1 className="text-3xl font-semibold">Setting up your household…</h1>
      <p className="text-gray-600">Please wait just a moment.</p>
    </div>
  )
}
