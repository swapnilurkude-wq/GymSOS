import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
import { ProtectedRoute } from "@/routes/protected-route"
import { TrialGate } from "@/components/gym-owner/trial-gate"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { RouteLoader } from "@/components/shared/route-loader"
import { ComingSoon } from "@/pages/shared/coming-soon"
import LoginPage from "@/pages/auth/login"

// Pages are route-split with React.lazy so each dashboard and its
// charting code (recharts) load on first navigation instead of
// bloating the initial bundle. The login page stays static — it is
// the entry point and needs to paint instantly.
const SuperAdminDashboard = lazy(() => import("@/pages/super-admin/dashboard"))
const GymManagementPage = lazy(() => import("@/pages/super-admin/gyms"))
const SubscriptionManagementPage = lazy(() => import("@/pages/super-admin/subscriptions"))
const RevenueDashboardPage = lazy(() => import("@/pages/super-admin/revenue"))
const SuperAdminSettingsPage = lazy(() => import("@/pages/super-admin/settings"))
const SuperAdminReceiptsPage = lazy(() => import("@/pages/super-admin/receipts"))
const GymOwnerDashboard = lazy(() => import("@/pages/gym-owner/dashboard"))
const MembersPage = lazy(() => import("@/pages/gym-owner/members"))
const PaymentsPage = lazy(() => import("@/pages/gym-owner/payments"))
const GymOwnerReceiptsPage = lazy(() => import("@/pages/gym-owner/receipts"))
const GymOwnerSettingsPage = lazy(() => import("@/pages/gym-owner/settings"))
const GymOwnerReportsPage = lazy(() => import("@/pages/gym-owner/reports"))
const ResetPasswordPage = lazy(() => import("@/pages/auth/reset-password"))
const SignupPage = lazy(() => import("@/pages/auth/signup"))

function RootRedirect() {
  const { session, isLoading } = useAuth()
  if (isLoading) return null
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={session.role === "super-admin" ? "/super-admin" : "/gym-owner"} replace />
}

function LoginRoute() {
  const { session, isLoading } = useAuth()
  if (isLoading) return null
  if (session) {
    return <Navigate to={session.role === "super-admin" ? "/super-admin" : "/gym-owner"} replace />
  }
  return <LoginPage />
}

function SignupRoute() {
  const { session, isLoading } = useAuth()
  if (isLoading) return null
  if (session) {
    return <Navigate to={session.role === "super-admin" ? "/super-admin" : "/gym-owner"} replace />
  }
  return <SignupPage />
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginRoute />} />
        {/* Public Gym Owner signup — 10-day free trial. */}
        <Route path="/signup" element={<SignupRoute />} />
        {/* Email-link destination for "Forgot password?" — no session required. */}
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        <Route element={<ProtectedRoute allow={["super-admin"]} />}>
          <Route path="/super-admin" element={<DashboardLayout />}>
            <Route index element={<SuperAdminDashboard />} />
            <Route path="gyms" element={<GymManagementPage />} />
            <Route path="subscriptions" element={<SubscriptionManagementPage />} />
            <Route path="revenue" element={<RevenueDashboardPage />} />
            <Route path="receipts" element={<SuperAdminReceiptsPage />} />
            <Route path="analytics" element={<ComingSoon title="Analytics" />} />
            <Route path="reports" element={<ComingSoon title="Reports" />} />
            <Route path="settings" element={<SuperAdminSettingsPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allow={["gym-owner"]} />}>
          {/* Blocks the dashboard while a free trial has
              expired (server-side trial end date). */}
          <Route element={<TrialGate />}>
            <Route path="/gym-owner" element={<DashboardLayout />}>
              <Route index element={<GymOwnerDashboard />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="receipts" element={<GymOwnerReceiptsPage />} />
              <Route path="reports" element={<GymOwnerReportsPage />} />
              <Route path="settings" element={<GymOwnerSettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
