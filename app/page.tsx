export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Family Meal Planner</h1>
      <p>Welcome! This is your base app.</p>

      <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem" }}>
        <a
          href="/signup"
          style={{ padding: "0.5rem 1rem", border: "1px solid #ccc", borderRadius: 4 }}
        >
          Sign up
        </a>
        <a
          href="/login"
          style={{ padding: "0.5rem 1rem", border: "1px solid #ccc", borderRadius: 4 }}
        >
          Log in
        </a>
      </div>
    </main>
  );
}