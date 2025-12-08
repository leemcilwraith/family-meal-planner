"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")

    // 1️⃣ Attempt login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      return
    }

    const user = data.user
    if (!user) {
      setError("Unable to retrieve user after login.")
      return
    }

    // 2️⃣ Check if user has a household link
    const { data: link } = await supabase
      .from("user_households")
      .select("household_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!link?.household_id) {
      router.push("/onboarding/step-1")
      return
    }

    // 3️⃣ Check onboarding progress
    const { data: settings } = await supabase
      .from("household_settings")
      .select("onboarding_step")
      .eq("household_id", link.household_id)
      .single()

    // No settings row yet → send to step 1
    if (!settings) {
      router.push("/onboarding/step-1")
      return
    }

    // Settings exist → check progress
    if (settings.onboarding_step < 99) {
      router.push(`/onboarding/step-${settings.onboarding_step}`)
      return
    }

    // 4️⃣ Fully completed onboarding → go to dashboard
    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">
        <h1 className="text-3xl font-semibold text-center">Login</h1>

        <form 
  onSubmit={handleLogin} 
  className="space-y-6" 
  autoComplete="off"
>
  <div className="space-y-2">
    <Label>Email</Label>
    <Input
      type="email"
      autoComplete="off"
      data-lpignore="true"
      data-lpblock="true"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />
  </div>

  <div className="space-y-2">
    <Label>Password</Label>
    <Input
      type="password"
      autoComplete="new-password"
      data-lpignore="true"
      data-lpblock="true"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
    />
  </div>


          {error && <p className="text-red-500 text-center">{error}</p>}

          <Button type="submit" className="w-full py-6 text-lg">
            Login
          </Button>
        </form>

        <Button
          variant="outline"
          className="w-full py-6 text-lg"
          onClick={() => router.push("/signup")}
        >
          Create an Account
        </Button>
      </div>
    </div>
  )
}
