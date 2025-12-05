export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-2xl text-center space-y-10">
          {children}
        </div>
      </body>
    </html>
  )
}
