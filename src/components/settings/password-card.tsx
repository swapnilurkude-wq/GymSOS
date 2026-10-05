import { useState, type FormEvent } from "react"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/auth-context"

export function PasswordCard() {
  const { changePassword } = useAuth()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (next.length < 6) {
      setMessage({ type: "error", text: "New password must be at least 6 characters." })
      return
    }
    if (next !== confirm) {
      setMessage({ type: "error", text: "New password and confirmation do not match." })
      return
    }

    const result = await changePassword(current, next)
    if (!result.ok) {
      setMessage({ type: "error", text: result.message })
      return
    }

    setMessage({ type: "success", text: "Password updated successfully." })
    setCurrent("")
    setNext("")
    setConfirm("")
  }

  return (
    <Card className="p-6">
      <CardHeader className="p-0">
        <CardTitle>Password</CardTitle>
        <CardDescription>Update your account password</CardDescription>
      </CardHeader>
      <CardContent className="p-0 pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </div>

          {message && (
            <p
              className={`flex items-center gap-1.5 text-sm ${
                message.type === "success" ? "text-success" : "text-destructive"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <AlertCircle className="size-4" />
              )}
              {message.text}
            </p>
          )}

          <div>
            <Button type="submit" disabled={!current || !next || !confirm}>
              Update password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
