import { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/auth-context"
import { getAllGyms, updateGym } from "@/lib/gyms"
import { gymToFormValues } from "@/lib/gym-defaults"
import type { Gym } from "@/types"

export function GymProfileCard() {
  const { session, updateSessionGymName } = useAuth()
  const gymId = session?.gymId
  const [gym, setGym] = useState<Gym | null>(null)

  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!gymId) {
      setGym(null)
      return
    }
    let cancelled = false
    getAllGyms()
      .then((gyms) => {
        if (cancelled) return
        const found = gyms.find((g) => g.id === gymId) ?? null
        setGym(found)
        setName(found?.name ?? "")
        setLocation(found?.location ?? "")
      })
      .catch(() => {
        if (!cancelled) setGym(null)
      })
    return () => {
      cancelled = true
    }
  }, [gymId])

  if (!gymId || !gym) return null
  const currentGym: Gym = gym

  async function handleSave() {
    await updateGym(currentGym.id, {
      ...gymToFormValues(currentGym),
      name: name.trim(),
      location: location.trim(),
    })
    await updateSessionGymName(name.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const canSave = name.trim().length > 0 && location.trim().length > 0

  return (
    <Card className="p-6">
      <CardHeader className="p-0">
        <CardTitle>Gym profile</CardTitle>
        <CardDescription>Public details shown across GymSOS</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-0 pt-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="gym-settings-name">Gym name</Label>
            <Input id="gym-settings-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gym-settings-location">Location</Label>
            <Input id="gym-settings-location" value={location} onChange={(e) => setLocation(e.target.value)} />
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
