import type { RouteObject } from "react-router";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage, profileLoader } from "./pages/ProfilePage";
import { SignVerifyPage } from "./pages/SignVerifyPage";
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
