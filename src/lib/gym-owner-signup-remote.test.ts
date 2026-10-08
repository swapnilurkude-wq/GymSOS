import { describe, expect, it, vi } from "vitest"

// The signup helper imports the Supabase seam at load
// time — install the remote-mode mock before importing it.
vi.mock("@/lib/supabase", () => ({
  SUPABASE_URL: "https://mock.supabase.co",
  SUPABASE_ANON_KEY: "mock-anon-key",
  isSupabaseConfigured: () => true,
}))

import { signUpGymOwner } from "@/lib/gym-owner-signup"

const VALID = {
  gymName: "New Gym",
  ownerName: "New Owner",
  mobile: "9820000000",
  email: "new@gym.in",
  password: "Password1",
  confirmPassword: "Password1",
}

describe("gym owner signup — Supabase mode", () => {
  it("posts the form to the signup edge function with the anon key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        gymId: "gym-new",
        gymName: "New Gym",
        ownerName: "New Owner",
        email: "new@gym.in",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await signUpGymOwner(VALID)

    expect(result).toEqual({
      gymId: "gym-new",
      gymName: "New Gym",
      ownerName: "New Owner",
      email: "new@gym.in",
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(url).toBe("https://mock.supabase.co/functions/v1/gym-owner-signup")
    expect(init.method).toBe("POST")
    expect(headers["Content-Type"]).toBe("application/json")
    expect(headers.Authorization).toBe("Bearer mock-anon-key")
    expect(JSON.parse(init.body as string)).toEqual(VALID)

    vi.unstubAllGlobals()
  })

  it("surfaces duplicate email / mobile errors from the edge function", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error:
          "This mobile number is already linked to a gym. Please sign in instead.",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(signUpGymOwner(VALID)).rejects.toThrow(
      /already linked to a gym/
    )

    vi.unstubAllGlobals()
  })

  it("falls back to a generic error with the HTTP status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({}),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(signUpGymOwner(VALID)).rejects.toThrow(
      "Couldn't create your account (HTTP 502). Please try again."
    )

    vi.unstubAllGlobals()
  })
})
