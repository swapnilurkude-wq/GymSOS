import { useState } from "react"
import { CheckCircle2, Copy } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface GeneratedCredentials {
  gymName: string
  email: string
  password: string
}

interface GymCredentialsDialogProps {
  credentials: GeneratedCredentials | null
  onOpenChange: (open: boolean) => void
}

function CopyField({ id, label, value }: { id: string; label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input id={id} readOnly value={value} className="font-mono" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleCopy}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <CheckCircle2 className="size-4 text-success" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  )
}

export function GymCredentialsDialog({ credentials, onOpenChange }: GymCredentialsDialogProps) {
  return (
    <Dialog open={!!credentials} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Login account ready</DialogTitle>
          <DialogDescription>
            Share these credentials with {credentials?.gymName}'s owner — they can sign in immediately.
          </DialogDescription>
        </DialogHeader>

        {credentials && (
          <div className="flex flex-col gap-4 py-2">
            <CopyField id="cred-email" label="Login email" value={credentials.email} />
            <CopyField id="cred-password" label="Password" value={credentials.password} />
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
