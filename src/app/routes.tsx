import { lazy, Suspense, type ReactNode } from "react";
import { createMemoryRouter } from "react-router";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import ProtectedRoute from "./components/ProtectedRoute";
import { ALL_ROLES } from "./context/AuthContext";

const CategoryCalendar = lazy(() => import("./pages/CategoryCalendar"));
const DaHomePage = lazy(() => import("./pages/DaHomePage"));
const AdministracaoPage = lazy(() => import("./pages/AdministracaoPage"));
const GestaoFrotasPage = lazy(() => import("./pages/GestaoFrotasPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ConfiguracoesPage = lazy(() => import("./pages/ConfiguracoesPage"));

function PageFallback() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "40vh",
        color: "var(--muted-foreground, #888)",
      }}
    >
      Carregando…
    </div>
  );
}

function lazyEl(node: ReactNode) {
  return <Suspense fallback={<PageFallback />}>{node}</Suspense>;
}

export const router = createMemoryRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute allowedRoles={["geral", "admin"]}>
            <Home />
          </ProtectedRoute>
        ),
      },
      {
        path: "da",
        element: (
          <ProtectedRoute allowedRoles={["da", "admin"]}>
            {lazyEl(<DaHomePage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "calendario",
        element: (
          <ProtectedRoute allowedRoles={["geral", "admin"]}>
            {lazyEl(<CategoryCalendar />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "administracao",
        element: (
          <ProtectedRoute allowedRoles={["da", "admin"]}>
            {lazyEl(<AdministracaoPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "gestao-frotas",
        element: (
          <ProtectedRoute allowedRoles={["frotas", "admin"]}>
            {lazyEl(<GestaoFrotasPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "configuracoes",
        element: (
          <ProtectedRoute allowedRoles={ALL_ROLES}>
            {lazyEl(<ConfiguracoesPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "admin",
        element: (
          <ProtectedRoute allowedRoles={["admin"]}>
            {lazyEl(<AdminPage />)}
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
