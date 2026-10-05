import { useRef, useState } from "react"
import { Camera, CheckCircle2 } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/context/auth-context"

const MAX_PHOTO_BYTES = 2 * 1024 * 1024

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function ProfileCard() {
  const { session, updateProfile } = useAuth()
  const [name, setName] = useState(session?.name ?? "")
  const [avatarUrl, setAvatarUrl] = useState(session?.avatarUrl)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!session) return null

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setPhotoError("Please select an image file.")
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Photo must be under 2MB.")
      return
    }

    setPhotoError(null)
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    await updateProfile({ name: name.trim(), avatarUrl })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const canSave = name.trim().length > 0

  return (
    <Card className="p-6">
      <CardHeader className="p-0">
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your personal account details</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-0 pt-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 border border-border/60">
            <AvatarImage src={avatarUrl} alt={name} />
            <AvatarFallback className="text-base">{initialsOf(name) || "?"}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Camera className="size-3.5" />
                Upload photo
              </Button>
              {avatarUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarUrl(undefined)}>
                  Remove
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            {photoError && <p className="text-xs text-destructive">{photoError}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-name">Full name</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-email">Email address</Label>
            <Input id="profile-email" value={session.email} disabled />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={!canSave}>
            Save changes
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-success">
              <CheckCircle2 className="size-4" />
              Saved
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
