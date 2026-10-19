import { Navigate, useLocation } from "react-router";
import { useAuth, type Role } from "../context/AuthContext";
import { homeFor } from "../auth/roleHome";

interface ProtectedRouteProps {
  allowedRoles: Role[];
  children: React.ReactNode;
}

export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();
  const { pathname } = useLocation();

  if (!isAuthenticated) return <Navigate to="/" replace />;

  if (!user?.activeRole || !allowedRoles.includes(user.activeRole)) {
    const target = homeFor(user?.activeRole);
    if (target === pathname) {
      return (
        <div className="h-full flex items-center justify-center px-6">
          <p className="text-sm text-muted-foreground text-center">
            Seu perfil não tem acesso a esta tela.
          </p>
        </div>
      );
    }
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}
