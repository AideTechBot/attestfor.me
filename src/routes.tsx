import type { RouteObject } from "react-router";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage, profileLoader } from "./pages/ProfilePage";
import "./index.css";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <HomePage />,
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
];
