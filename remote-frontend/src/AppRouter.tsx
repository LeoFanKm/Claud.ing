import { createBrowserRouter, RouterProvider } from "react-router-dom";
import AccountCompletePage from "./pages/AccountCompletePage";
import AccountPage from "./pages/AccountPage";
import HomePage from "./pages/HomePage";
import InvitationCompletePage from "./pages/InvitationCompletePage";
import InvitationPage from "./pages/InvitationPage";
import NotFoundPage from "./pages/NotFoundPage";
import OrganizationPage from "./pages/OrganizationPage";
import ReviewPage from "./pages/ReviewPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "/review/:id",
    element: <ReviewPage />,
  },
  {
    path: "/invitations/:token/accept",
    element: <InvitationPage />,
  },
  {
    path: "/invitations/:token/complete",
    element: <InvitationCompletePage />,
  },
  {
    path: "/account",
    element: <AccountPage />,
  },
  {
    path: "/account/complete",
    element: <AccountCompletePage />,
  },
  {
    path: "/account/organizations/:orgId",
    element: <OrganizationPage />,
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
