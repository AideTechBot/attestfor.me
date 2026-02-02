import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useParams } from "react-router";
import { NotFoundPage } from "./NotFoundPage";

const VALID_IDS = ["john"];

// TODO: replace this
// eslint-disable-next-line react-refresh/only-export-components
export function profileLoader({ params }: LoaderFunctionArgs) {
  const isValid = VALID_IDS.includes(params.id ?? "");
  return { isValid };
}

export function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { isValid } = useLoaderData() as { isValid: boolean };

  if (!isValid) {
    return <NotFoundPage />;
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
      {/* Header with Back Link */}
      <header style={{ marginBottom: "3rem" }}>
        <Link
          to="/"
          style={{
            color: "#646cff",
            textDecoration: "none",
            fontSize: "1rem",
          }}
        >
          ← Back to Home
        </Link>
      </header>

      {/* Profile Section */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2rem",
        }}
      >
        {/* Profile Picture */}
        <div
          style={{
            width: "150px",
            height: "150px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "3rem",
            color: "white",
            fontWeight: "bold",
          }}
        >
          {id?.[0].toUpperCase()}
        </div>

        {/* Profile Info */}
        <div style={{ textAlign: "center", maxWidth: "600px" }}>
          <h1 style={{ fontSize: "2.5rem", margin: "0 0 1rem 0" }}>{id}</h1>
          <p
            style={{
              fontSize: "1.1rem",
              lineHeight: "1.6",
              color: "#bbb",
              margin: 0,
            }}
          >
            This is the profile description for {id}. Here you can add
            information about this user, their interests, achievements, and
            anything else you'd like to share.
          </p>
        </div>
      </div>
    </div>
  );
}
