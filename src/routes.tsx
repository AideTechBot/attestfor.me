import type { RouteObject } from "react-router";
import { Outlet } from "react-router";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage, profileLoader } from "./pages/ProfilePage";
import {
  ProfileDetailsPage,
  profileDetailsLoader,
} from "./pages/ProfileDetailsPage";
import { FaqPage } from "./pages/FaqPage";
import { PageLayout } from "./components/PageLayout";
import { SimplePageLayout } from "./components/SimplePageLayout";
import { EditProfilePage } from "./pages/EditProfilePage";
import { VerificationProvider } from "./lib/verification-context";
import "./index.css";

/** Wraps child routes with a shared VerificationProvider so state persists across layouts. */
// eslint-disable-next-line react-refresh/only-export-components
function VerificationRoot() {
  return (
    <VerificationProvider>
      <Outlet />
    </VerificationProvider>
  );
}

export const routes: RouteObject[] = [
  {
    element: <VerificationRoot />,
    children: [
      {
        element: <PageLayout />,
        children: [
          {
            path: "/",
            element: <HomePage />,
          },
          {
            path: "/faq",
            element: <FaqPage />,
          },
          {
            path: "/edit/claims",
            element: <EditProfilePage />,
          },
          {
            path: "/:handle/details",
            element: <ProfileDetailsPage />,
            loader: profileDetailsLoader,
          },
          {
            path: "*",
            element: <NotFoundPage />,
          },
        ],
      },
      {
        element: <SimplePageLayout />,
        children: [
          {
            path: "/:handle",
            element: <ProfilePage />,
            loader: profileLoader,
          },
        ],
      },
    ],
  },
];
