import {
  LayoutDashboard,
  Building2,
  CreditCard,
  LineChart,
  BarChart3,
  Settings,
  Users,
  Wallet,
  Receipt,
  type LucideIcon,
} from "lucide-react"
import type { Role } from "@/types"

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  "super-admin": [
    { label: "Dashboard", to: "/super-admin", icon: LayoutDashboard, end: true },
    { label: "Gym Management", to: "/super-admin/gyms", icon: Building2 },
    { label: "Subscriptions", to: "/super-admin/subscriptions", icon: CreditCard },
    { label: "Revenue Dashboard", to: "/super-admin/revenue", icon: Wallet },
    { label: "Receipts", to: "/super-admin/receipts", icon: Receipt },
    { label: "Analytics", to: "/super-admin/analytics", icon: LineChart },
    { label: "Reports", to: "/super-admin/reports", icon: BarChart3 },
    { label: "Settings", to: "/super-admin/settings", icon: Settings },
  ],
  "gym-owner": [
    { label: "Dashboard", to: "/gym-owner", icon: LayoutDashboard, end: true },
    { label: "Members", to: "/gym-owner/members", icon: Users },
    { label: "Payments", to: "/gym-owner/payments", icon: CreditCard },
    { label: "Receipts", to: "/gym-owner/receipts", icon: Receipt },
    { label: "Reports", to: "/gym-owner/reports", icon: BarChart3 },
    { label: "Settings", to: "/gym-owner/settings", icon: Settings },
  ],
}

export const ROLE_LABEL: Record<Role, string> = {
  "super-admin": "Super Admin",
  "gym-owner": "Gym Owner",
}
