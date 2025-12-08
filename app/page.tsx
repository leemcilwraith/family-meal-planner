"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function Home() {
  const router = useRouter()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <div className="space-y-8 max-w-xl">
        <h1 className="text-4xl font-bold">Family Meal Planner</h1>
        <p className="text-gray-600 text-lg">
          Create personalised weekly meal plans tailored to your family's tastes.
        </p>

        <div className="flex flex-col space-y-4 pt-4">
          <Button className="w-full py-6 text-lg" onClick={() => router.push("/signup")}>
            Sign Up
          </Button>
          <Button variant="outline" className="w-full py-6 text-lg" onClick={() => router.push("/login")}>
            Login
          </Button>
        </div>
      </div>
    </main>
  )
}
