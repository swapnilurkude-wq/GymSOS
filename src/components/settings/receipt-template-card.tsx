import { useEffect, useRef, useState } from "react"
import { Camera, CheckCircle2, Receipt as ReceiptIcon, X } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/context/auth-context"
import { getAllGyms } from "@/lib/gyms"
import { getReceiptTemplate, upsertReceiptTemplate } from "@/lib/receipt-template"
import type { ReceiptTemplate } from "@/types"

const MAX_LOGO_BYTES = 1.5 * 1024 * 1024
const DEFAULT_TERMS =
  "Fees once paid are non-refundable. Membership is non-transferable. The gym is not liable for personal belongings or injury sustained on premises."

export function ReceiptTemplateCard() {
  const { session } = useAuth()
  const gymId = session?.gymId ?? ""
  const [existing, setExisting] = useState<ReceiptTemplate | null>(null)

  const [logoUrl, setLogoUrl] = useState<string | undefined>()
  const [gymName, setGymName] = useState("")
  const [gymAddress, setGymAddress] = useState("")
  const [contactNumber, setContactNumber] = useState("")
  const [termsAndConditions, setTermsAndConditions] = useState(DEFAULT_TERMS)
  const [authorizedSignatureName, setAuthorizedSignatureName] = useState("")
  const [logoError, setLogoError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!gymId) return
    let cancelled = false
    Promise.all([getAllGyms(), getReceiptTemplate(gymId)])
      .then(([gyms, template]) => {
        if (cancelled) return
        const found = gyms.find((g) => g.id === gymId) ?? null
        setExisting(template)
        setLogoUrl(template?.logoUrl)
        setGymName(template?.gymName ?? found?.name ?? "")
        setGymAddress(template?.gymAddress ?? found?.location ?? "")
        setContactNumber(template?.contactNumber ?? found?.ownerContact ?? "")
        setTermsAndConditions(template?.termsAndConditions ?? DEFAULT_TERMS)
        setAuthorizedSignatureName(template?.authorizedSignatureName ?? session?.name ?? "")
      })
      .catch(() => {
        // Keep the empty form when the read fails.
      })
    return () => {
      cancelled = true
    }
    // session?.name only seeds the signature default on first load
  }, [gymId, session?.name])

  if (!gymId) return null

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setLogoError("Please select an image file.")
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Logo must be under 1.5MB.")
      return
    }

    setLogoError(null)
    const reader = new FileReader()
    reader.onload = () => setLogoUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    await upsertReceiptTemplate(gymId, {
      logoUrl,
      gymName: gymName.trim(),
      gymAddress: gymAddress.trim(),
      contactNumber: contactNumber.trim(),
      termsAndConditions: termsAndConditions.trim(),
      authorizedSignatureName: authorizedSignatureName.trim(),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const canSave = gymName.trim().length > 0 && gymAddress.trim().length > 0 && contactNumber.trim().length > 0

  return (
    <Card className="p-6">
      <CardHeader className="p-0">
        <CardTitle>Receipt Template</CardTitle>
        <CardDescription>
          {existing
            ? "Used automatically on every receipt you generate. Edit anytime."
            : "Set this up once — it's used automatically on every receipt going forward."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-0 pt-6">
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-secondary/40">
            {logoUrl ? (
              <img src={logoUrl} alt="Gym logo" className="size-full object-contain" />
            ) : (
              <ReceiptIcon className="size-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Camera className="size-3.5" />
                Upload logo
              </Button>
              {logoUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl(undefined)}>
                  <X className="size-3.5" />
                  Remove
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
            {logoError && <p className="text-xs text-destructive">{logoError}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="receipt-gym-name">Gym name *</Label>
            <Input id="receipt-gym-name" value={gymName} onChange={(e) => setGymName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="receipt-contact">Contact number *</Label>
            <Input
              id="receipt-contact"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="receipt-address">Gym address *</Label>
            <Textarea
              id="receipt-address"
              value={gymAddress}
              onChange={(e) => setGymAddress(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="receipt-terms">Terms &amp; Conditions</Label>
            <Textarea
              id="receipt-terms"
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="receipt-signature">Authorized signature name (optional)</Label>
            <Input
              id="receipt-signature"
              value={authorizedSignatureName}
              onChange={(e) => setAuthorizedSignatureName(e.target.value)}
              placeholder="Default name shown on the Authorized Signatory line"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={!canSave}>
            {existing ? "Save changes" : "Set up template"}
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
