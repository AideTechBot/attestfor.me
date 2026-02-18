import type { RouteObject } from "react-router";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage, profileLoader } from "./pages/ProfilePage";
import {
  ProfileDetailsPage,
  profileDetailsLoader,
} from "./pages/ProfileDetailsPage";
import { SignVerifyPage } from "./pages/SignVerifyPage";
import { EditProfilePage } from "./pages/EditProfilePage";
import { PageLayout } from "./components/PageLayout";
import "./index.css";

export const routes: RouteObject[] = [
  {
    element: <PageLayout />,
    children: [
      {
        path: "/",
        element: <HomePage />,
      },
      {
        path: "/sign-verify",
        element: <SignVerifyPage />,
      },
      {
        path: "/edit/proofs",
        element: <EditProfilePage />,
      },
      {
        path: "/:handle/details",
        element: <ProfileDetailsPage />,
        loader: profileDetailsLoader,
      },
      {
        path: "/:handle",
        element: <ProfilePage />,
        loader: profileLoader,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
];
