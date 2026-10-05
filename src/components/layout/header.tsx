import { Menu, Search, Bell, LogOut, Settings, User as UserIcon } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
import { useNotifications } from "@/hooks/use-notifications"
import { ROLE_LABEL } from "@/config/nav"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { formatTimeAgo } from "@/lib/format"
import type { AppNotification } from "@/types"

export function Header({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const { notifications, unreadCount, isRead, markRead, markAllRead, refresh } = useNotifications()
  if (!session) return null

  function handleNotificationClick(n: AppNotification) {
    markRead(n.id)
    navigate(n.link)
  }

  const initials = session.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const settingsPath = session.role === "super-admin" ? "/super-admin/settings" : "/gym-owner/settings"

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      <button
        onClick={onOpenMobile}
        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="hidden flex-1 max-w-md sm:block">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search members, payments, receipts…"
            className="h-10 border-transparent bg-secondary/60 pl-9 focus-visible:border-ring focus-visible:bg-background"
          />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-end gap-1.5 sm:flex-none">
        <DropdownMenu onOpenChange={(open) => open && refresh()}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="size-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute right-2 top-2 flex size-2 rounded-full bg-destructive ring-2 ring-background" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[10px]">{unreadCount} new</Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
            ) : (
              <div className="flex max-h-80 flex-col gap-1 overflow-y-auto p-1">
                {notifications.map((n) => (
                  <NotificationRow
                    key={n.id}
                    title={n.title}
                    time={formatTimeAgo(n.time)}
                    tone={n.tone}
                    read={isRead(n.id)}
                    onClick={() => handleNotificationClick(n)}
                  />
                ))}
              </div>
            )}
            {unreadCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <button
                  onClick={markAllRead}
                  className="w-full px-3 py-2 text-center text-xs font-medium text-primary hover:underline"
                >
                  Mark all as read
                </button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-full p-0.5 pr-1 transition-colors hover:bg-accent">
              <Avatar className="size-8">
                <AvatarImage src={session.avatarUrl} alt={session.name} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-semibold text-foreground">{session.name}</p>
              <p className="truncate text-xs text-muted-foreground">{session.email}</p>
              <Badge variant="default" className="mt-2">{ROLE_LABEL[session.role]}</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate(settingsPath)}>
              <UserIcon /> My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(settingsPath)}>
              <Settings /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={logout}>
              <LogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function NotificationRow({
  title,
  time,
  tone,
  read,
  onClick,
}: {
  title: string
  time: string
  tone: "default" | "success" | "warning" | "destructive"
  read: boolean
  onClick: () => void
}) {
  const dot =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : tone === "destructive"
          ? "bg-destructive"
          : "bg-primary"
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
        !read && "bg-accent/40"
      )}
    >
      <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate", read ? "text-muted-foreground" : "font-medium text-foreground")}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </button>
  )
}
