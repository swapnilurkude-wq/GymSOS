import type {
  Gym,
  GymFormValues,
  Member,
  MemberFormValues,
  Receipt,
  ReceiptFormValues,
  ReceiptTemplate,
} from "@/types"

/**
 * Row shapes and mappers between the app's camelCase types and the
 * snake_case rows stored in Supabase Postgres.
 */

export interface GymRow {
  id: string
  name: string
  location: string
  plan: string
  status: string
  owner_name: string
  owner_email: string
  owner_contact: string
  member_count: number
  subscription_end_date: string
  created_at: string
}

export interface ProfileRow {
  id: string
  name: string
  avatar_url: string | null
  email: string | null
  role: string
  gym_id: string | null
  gym_name: string | null
  created_at: string
}

export interface MemberRow {
  id: string
  gym_id: string
  receipt_number: string
  photo_url: string | null
  name: string
  contact_number: string
  gender: string
  address: string
  member_type: string
  plan: string
  duration_months: number
  start_date: string
  end_date: string
  amount: number
  discount: number
  paid_amount: number
  balance_amount: number
  payment_mode: string
  cash_amount: number
  online_amount: number
  payment_receiver: string
  payment_date: string
  notes: string
  terms_accepted: boolean
  created_at: string
  updated_at: string
}

export interface ReceiptRow {
  id: string
  gym_id: string
  member_id: string
  receipt_number: string
  receipt_date: string
  status: string
  member_name: string
  member_contact: string
  member_dob: string | null
  particular: string
  plan: string
  duration_months: number
  start_date: string
  end_date: string
  total_amount: number
  amount_paid: number
  cash_amount: number
  online_amount: number
  balance_amount: number
  balance_paid: number
  balance_due_date: string | null
  payment_mode: string
  transaction_id: string
  notes: string
  nutrition: boolean
  personal_training: boolean
  customer_signature: string
  receiver_signature: string
  created_at: string
  updated_at: string
}

export interface ReceiptTemplateRow {
  gym_id: string
  logo_url: string | null
  gym_name: string
  gym_address: string
  contact_number: string
  terms_and_conditions: string
  authorized_signature_name: string
  created_at: string
  updated_at: string
}

// ── Gyms ──────────────────────────────────────────────────────

export function fromGymRow(row: GymRow): Gym {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    plan: row.plan as Gym["plan"],
    status: row.status as Gym["status"],
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    ownerContact: row.owner_contact,
    memberCount: row.member_count,
    subscriptionEndDate: row.subscription_end_date,
    createdAt: row.created_at,
  }
}

export function toGymRow(gym: Gym): GymRow {
  return {
    id: gym.id,
    name: gym.name,
    location: gym.location,
    plan: gym.plan,
    status: gym.status,
    owner_name: gym.ownerName,
    owner_email: gym.ownerEmail,
    owner_contact: gym.ownerContact,
    member_count: gym.memberCount,
    subscription_end_date: gym.subscriptionEndDate,
    created_at: gym.createdAt,
  }
}

export function toGymPatch(values: GymFormValues): Partial<GymRow> {
  return {
    name: values.name,
    location: values.location,
    plan: values.plan,
    status: values.status,
    owner_name: values.ownerName,
    owner_email: values.ownerEmail,
    owner_contact: values.ownerContact,
    member_count: values.memberCount,
    subscription_end_date: values.subscriptionEndDate,
  }
}

// ── Members ───────────────────────────────────────────────────

export function fromMemberRow(row: MemberRow): Member {
  return {
    id: row.id,
    gymId: row.gym_id,
    receiptNumber: row.receipt_number,
    photoUrl: row.photo_url ?? undefined,
    name: row.name,
    contactNumber: row.contact_number,
    gender: row.gender as Member["gender"],
    address: row.address,
    memberType: row.member_type as Member["memberType"],
    plan: row.plan as Member["plan"],
    durationMonths: row.duration_months,
    startDate: row.start_date,
    endDate: row.end_date,
    amount: row.amount,
    discount: row.discount,
    paidAmount: row.paid_amount,
    balanceAmount: row.balance_amount,
    paymentMode: row.payment_mode as Member["paymentMode"],
    cashAmount: row.cash_amount,
    onlineAmount: row.online_amount,
    paymentReceiver: row.payment_receiver,
    paymentDate: row.payment_date,
    notes: row.notes,
    termsAccepted: row.terms_accepted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toMemberRow(member: Member): MemberRow {
  return {
    id: member.id,
    gym_id: member.gymId,
    receipt_number: member.receiptNumber,
    photo_url: member.photoUrl ?? null,
    name: member.name,
    contact_number: member.contactNumber,
    gender: member.gender,
    address: member.address,
    member_type: member.memberType,
    plan: member.plan,
    duration_months: member.durationMonths,
    start_date: member.startDate,
    end_date: member.endDate,
    amount: member.amount,
    discount: member.discount,
    paid_amount: member.paidAmount,
    balance_amount: member.balanceAmount,
    payment_mode: member.paymentMode,
    cash_amount: member.cashAmount,
    online_amount: member.onlineAmount,
    payment_receiver: member.paymentReceiver,
    payment_date: member.paymentDate,
    notes: member.notes,
    terms_accepted: member.termsAccepted,
    created_at: member.createdAt,
    updated_at: member.updatedAt,
  }
}

export function toMemberPatch(values: MemberFormValues): Partial<MemberRow> {
  return {
    photo_url: values.photoUrl ?? null,
    name: values.name,
    contact_number: values.contactNumber,
    gender: values.gender,
    address: values.address,
    member_type: values.memberType,
    plan: values.plan,
    duration_months: values.durationMonths,
    start_date: values.startDate,
    end_date: values.endDate,
    amount: values.amount,
    discount: values.discount,
    paid_amount: values.paidAmount,
    payment_mode: values.paymentMode,
    cash_amount: values.cashAmount,
    online_amount: values.onlineAmount,
    payment_receiver: values.paymentReceiver,
    payment_date: values.paymentDate,
    notes: values.notes,
    terms_accepted: values.termsAccepted,
  }
}

// ── Receipts ──────────────────────────────────────────────────

export function fromReceiptRow(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    gymId: row.gym_id,
    memberId: row.member_id,
    receiptNumber: row.receipt_number,
    receiptDate: row.receipt_date,
    status: row.status as Receipt["status"],
    memberName: row.member_name,
    memberContact: row.member_contact,
    memberDob: row.member_dob ?? "",
    particular: row.particular as Receipt["particular"],
    plan: row.plan as Receipt["plan"],
    durationMonths: row.duration_months,
    startDate: row.start_date,
    endDate: row.end_date,
    totalAmount: row.total_amount,
    amountPaid: row.amount_paid,
    cashAmount: row.cash_amount,
    onlineAmount: row.online_amount,
    balanceAmount: row.balance_amount,
    balancePaid: row.balance_paid,
    balanceDueDate: row.balance_due_date ?? "",
    paymentMode: row.payment_mode as Receipt["paymentMode"],
    transactionId: row.transaction_id,
    notes: row.notes,
    nutrition: row.nutrition,
    personalTraining: row.personal_training,
    customerSignature: row.customer_signature,
    receiverSignature: row.receiver_signature,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toReceiptRow(receipt: Receipt): ReceiptRow {
  return {
    id: receipt.id,
    gym_id: receipt.gymId,
    member_id: receipt.memberId,
    receipt_number: receipt.receiptNumber,
    receipt_date: receipt.receiptDate,
    status: receipt.status,
    member_name: receipt.memberName,
    member_contact: receipt.memberContact,
    member_dob: receipt.memberDob ? receipt.memberDob.slice(0, 10) : null,
    particular: receipt.particular,
    plan: receipt.plan,
    duration_months: receipt.durationMonths,
    start_date: receipt.startDate,
    end_date: receipt.endDate,
    total_amount: receipt.totalAmount,
    amount_paid: receipt.amountPaid,
    cash_amount: receipt.cashAmount,
    online_amount: receipt.onlineAmount,
    balance_amount: receipt.balanceAmount,
    balance_paid: receipt.balancePaid,
    balance_due_date: receipt.balanceDueDate || null,
    payment_mode: receipt.paymentMode,
    transaction_id: receipt.transactionId,
    notes: receipt.notes,
    nutrition: receipt.nutrition,
    personal_training: receipt.personalTraining,
    customer_signature: receipt.customerSignature,
    receiver_signature: receipt.receiverSignature,
    created_at: receipt.createdAt,
    updated_at: receipt.updatedAt,
  }
}

export function toReceiptPatch(values: ReceiptFormValues): Partial<ReceiptRow> {
  return {
    member_id: values.memberId,
    receipt_date: values.receiptDate,
    member_name: values.memberName,
    member_contact: values.memberContact,
    member_dob: values.memberDob ? values.memberDob.slice(0, 10) : null,
    particular: values.particular,
    plan: values.plan,
    duration_months: values.durationMonths,
    start_date: values.startDate,
    end_date: values.endDate,
    total_amount: values.totalAmount,
    amount_paid: values.amountPaid,
    cash_amount: values.cashAmount,
    online_amount: values.onlineAmount,
    balance_paid: values.balancePaid,
    balance_due_date: values.balanceDueDate || null,
    payment_mode: values.paymentMode,
    transaction_id: values.transactionId,
    notes: values.notes,
    nutrition: values.nutrition,
    personal_training: values.personalTraining,
    customer_signature: values.customerSignature,
    receiver_signature: values.receiverSignature,
  }
}

// ── Receipt templates ────────────────────────────────────────

export function fromReceiptTemplateRow(row: ReceiptTemplateRow): ReceiptTemplate {
  return {
    gymId: row.gym_id,
    logoUrl: row.logo_url ?? undefined,
    gymName: row.gym_name,
    gymAddress: row.gym_address,
    contactNumber: row.contact_number,
    termsAndConditions: row.terms_and_conditions,
    authorizedSignatureName: row.authorized_signature_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toReceiptTemplateRow(template: ReceiptTemplate): ReceiptTemplateRow {
  return {
    gym_id: template.gymId,
    logo_url: template.logoUrl ?? null,
    gym_name: template.gymName,
    gym_address: template.gymAddress,
    contact_number: template.contactNumber,
    terms_and_conditions: template.termsAndConditions,
    authorized_signature_name: template.authorizedSignatureName,
    created_at: template.createdAt,
    updated_at: template.updatedAt,
  }
}
