"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    // After successful login:
const { data: link } = await supabase
  .from("user_households")
  .select("household_id")
  .eq("user_id", user.id)
  .maybeSingle()

if (!link) {
  router.push("/onboarding/step-1")
} else {
  // After successful login:
const { data: link } = await supabase
  .from("user_households")
  .select("household_id")
  .eq("user_id", user.id)
  .maybeSingle()

// No household yet? Start onboarding.
if (!link?.household_id) {
  router.push("/onboarding/step-1")
  return
}

// Check onboarding progress
const { data: settings } = await supabase
  .from("household_settings")
  .select("onboarding_step")
  .eq("household_id", link.household_id)
  .single()

// Incomplete onboarding → resume where left off
if (settings.onboarding_step < 99) {
  router.push(`/onboarding/step-${settings.onboarding_step}`)
  return
}

// Fully set up → go to dashboard
router.push("/dashboard")

}

  }

  return (
    <div className="flex justify-center py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <p className="text-sm text-muted-foreground">
            Login to access your meal planner.
          </p>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <Label>Email</Label>
              <Input
                required
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <Label>Password</Label>
              <Input
                required
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>

            <p className="text-sm pt-2 text-center">
              Don’t have an account?{" "}
              <a href="/signup" className="underline">
                Create one
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
