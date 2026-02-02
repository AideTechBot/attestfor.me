import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useParams } from "react-router";
import { NotFoundPage } from "./NotFoundPage";
import "./ProfilePage.css";

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
    <div className="profile-page">
      {/* Header with Back Link */}
      <header className="profile-header">
        <Link to="/" className="profile-back-link">
          ← Back to Home
        </Link>
      </header>

      {/* Profile Section */}
      <div className="profile-section">
        {/* Profile Picture */}
        <div className="profile-picture">{id?.[0].toUpperCase()}</div>

        {/* Profile Info */}
        <div className="profile-info">
          <h1 className="profile-name">{id}</h1>
          <p className="profile-description">
            This is the profile description for {id}. Here you can add
            information about this user, their interests, achievements, and
            anything else you'd like to share.
          </p>
        </div>
      </div>
    </div>
  );
}
