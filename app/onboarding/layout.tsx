export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full max-w-2xl mx-auto py-10 space-y-10 text-center">
      {children}
    </div>
  )
}
