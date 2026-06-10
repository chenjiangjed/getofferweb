import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth } from "./components/RequireAuth";
import { ChatPage } from "./pages/ChatPage";
import { HomePage } from "./pages/HomePage";
import { InterviewPage } from "./pages/InterviewPage";
import { LoginPage } from "./pages/LoginPage";
import { PlanPage } from "./pages/PlanPage";
import { ResumePage } from "./pages/ResumePage";

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "chat/:id", element: <ChatPage /> },
          { path: "plan", element: <PlanPage /> },
          { path: "resume", element: <ResumePage /> },
          { path: "interview", element: <InterviewPage /> }
        ]
      }
    ]
  },
  { path: "/login", element: <LoginPage /> },
  { path: "*", element: <Navigate to="/" replace /> }
]);
