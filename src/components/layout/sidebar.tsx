import { NavLink } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronsLeft, LogOut, X } from "lucide-react"
import { NAV_ITEMS, ROLE_LABEL } from "@/config/nav"
import { useAuth } from "@/context/auth-context"
import { Logo } from "@/components/shared/logo"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const { session, logout } = useAuth()
  if (!session) return null

  const items = NAV_ITEMS[session.role]
  const initials = session.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const content = (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border/60 px-4",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <Logo variant="light" iconOnly={collapsed} size="default" />
        <button
          onClick={onCloseMobile}
          className="rounded-md p-1.5 text-sidebar-muted hover:bg-white/5 lg:hidden"
          aria-label="Close menu"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 no-scrollbar">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onCloseMobile}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                isActive
                  ? "text-white"
                  : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-fg"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active-pill"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-500/90 to-brand-600/90 shadow-glow"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <item.icon className="relative z-10 size-[18px] shrink-0" />
                {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border/60 p-3">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-2 py-2",
            collapsed && "justify-center px-0"
          )}
        >
          <Avatar className="size-9 shrink-0 ring-2 ring-white/10">
            <AvatarImage src={session.avatarUrl} alt={session.name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-fg">{session.name}</p>
              <p className="truncate text-xs text-sidebar-muted">{ROLE_LABEL[session.role]}</p>
            </div>
          )}
          {!collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={logout}
                  className="rounded-lg p-2 text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Log out"
                >
                  <LogOut className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Sign out</TooltipContent>
            </Tooltip>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className={cn(
            "mt-1 hidden w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-sidebar-muted transition-colors hover:bg-white/5 hover:text-sidebar-fg lg:flex",
            collapsed ? "justify-center" : "justify-start"
          )}
        >
          <ChevronsLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && "Collapse"}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <motion.aside
        animate={{ width: collapsed ? 80 : 268 }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className="sticky top-0 hidden h-svh shrink-0 border-r border-sidebar-border bg-sidebar-bg lg:block"
      >
        {content}
      </motion.aside>

      {/* Mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] bg-sidebar-bg lg:hidden"
            >
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
