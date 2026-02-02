import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "4rem auto",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "4rem", marginBottom: "1rem" }}>404</h1>
      <p style={{ fontSize: "1.5rem", marginBottom: "2rem", color: "#888" }}>
        Page not found
      </p>
      <Link
        to="/"
        style={{
          color: "#646cff",
          textDecoration: "none",
          fontSize: "1.2rem",
        }}
      >
        ← Back to Home
      </Link>
    </div>
  );
}
