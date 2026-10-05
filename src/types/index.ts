export type Role = "super-admin" | "gym-owner"

export type GymPlan = "trial" | "starter" | "growth" | "pro"
export type GymStatus = "active" | "suspended" | "expired"

export const GYM_PLAN_FEE: Record<GymPlan, number> = {
  trial: 0,
  starter: 799,
  growth: 1699,
  pro: 3499,
}

export interface Gym {
  id: string
  name: string
  location: string
  plan: GymPlan
  status: GymStatus
  ownerName: string
  ownerEmail: string
  ownerContact: string
  memberCount: number
  subscriptionEndDate: string
  createdAt: string
}

export type GymFormValues = Omit<Gym, "id" | "createdAt">

export interface AuthUser {
  id: string
  name: string
  email: string
  password: string
  role: Role
  avatarUrl?: string
  gymId?: string
  gymName?: string
  createdAt: string
}

export interface Session {
  userId: string
  role: Role
  name: string
  email: string
  avatarUrl?: string
  gymId?: string
  gymName?: string
}

export type Gender = "male" | "female" | "other"
export type MemberType = "new" | "renewal"
export type MembershipPlan = "Monthly" | "Quarterly" | "Half-Yearly" | "Annual"
export type PaymentMode = "cash" | "online" | "mixed"

export const PLAN_DURATION_MONTHS: Record<MembershipPlan, number> = {
  Monthly: 1,
  Quarterly: 3,
  "Half-Yearly": 6,
  Annual: 12,
}

export interface Member {
  id: string
  gymId: string
  receiptNumber: string
  photoUrl?: string
  name: string
  contactNumber: string
  gender: Gender
  address: string
  memberType: MemberType
  plan: MembershipPlan
  durationMonths: number
  startDate: string
  endDate: string
  amount: number
  discount: number
  paidAmount: number
  balanceAmount: number
  paymentMode: PaymentMode
  cashAmount: number
  onlineAmount: number
  paymentReceiver: string
  paymentDate: string
  notes: string
  termsAccepted: boolean
  createdAt: string
  updatedAt: string
}

export type MemberFormValues = Omit<
  Member,
  "id" | "gymId" | "receiptNumber" | "balanceAmount" | "createdAt" | "updatedAt"
>

export type ReceiptStatus = "paid" | "partial" | "pending"
export type ReceiptParticular = "new" | "renewal" | "add-on" | "facility"
export type ReceiptPaymentMode = "cash" | "online" | "mixed"

export const RECEIPT_PARTICULAR_LABEL: Record<ReceiptParticular, string> = {
  new: "New",
  renewal: "Renewal",
  "add-on": "Add-on",
  facility: "Facility",
}

export interface ReceiptTemplate {
  gymId: string
  logoUrl?: string
  gymName: string
  gymAddress: string
  contactNumber: string
  termsAndConditions: string
  authorizedSignatureName: string
  createdAt: string
  updatedAt: string
}

export type ReceiptTemplateValues = Omit<ReceiptTemplate, "gymId" | "createdAt" | "updatedAt">

export interface Receipt {
  id: string
  gymId: string
  memberId: string
  receiptNumber: string
  receiptDate: string
  status: ReceiptStatus

  memberName: string
  memberContact: string
  memberDob: string

  particular: ReceiptParticular
  plan: MembershipPlan
  durationMonths: number
  startDate: string
  endDate: string

  totalAmount: number
  amountPaid: number
  cashAmount: number
  onlineAmount: number
  balanceAmount: number
  balancePaid: number
  balanceDueDate: string

  paymentMode: ReceiptPaymentMode
  transactionId: string

  notes: string
  nutrition: boolean
  personalTraining: boolean

  customerSignature: string
  receiverSignature: string

  createdAt: string
  updatedAt: string
}

export type ReceiptFormValues = Omit<
  Receipt,
  "id" | "gymId" | "receiptNumber" | "balanceAmount" | "status" | "createdAt" | "updatedAt"
>

export type NotificationTone = "default" | "success" | "warning" | "destructive"

export interface AppNotification {
  id: string
  title: string
  time: string
  tone: NotificationTone
  link: string
}
