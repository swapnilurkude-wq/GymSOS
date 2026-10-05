import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
import type { Role } from "@/types"

export function ProtectedRoute({ allow }: { allow: Role[] }) {
  const { session, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return null

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!allow.includes(session.role)) {
    return <Navigate to={session.role === "super-admin" ? "/super-admin" : "/gym-owner"} replace />
  }

  return <Outlet />
}
