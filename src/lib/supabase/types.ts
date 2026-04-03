export type PaymentMethod = 'cash' | 'card'

export interface Receipt {
  id: string
  date: string // YYYY-MM-DD
  amount: number
  store_name: string
  item_name: string | null
  purpose: string | null
  payment_method: PaymentMethod
  card_info: string | null // e.g. "JCB 1139"
  image_url: string
  is_flagged: boolean
  month: string // YYYY-MM
  title: string | null
  created_at: string
  user_id?: string | null
}

export interface StoreName {
  id: string
  name: string
  user_id?: string | null
  created_at: string
}

export interface Purpose {
  id: string
  name: string
  sort_order: number
  user_id?: string | null
  created_at: string
}

export type ReceiptInsert = Omit<Receipt, 'id' | 'created_at'>
export type ReceiptUpdate = Partial<Omit<Receipt, 'id' | 'created_at' | 'user_id'>>

export interface OcrResult {
  date: string | null
  amount: number | null
  store_name: string | null
  item_name: string | null
  payment_method: PaymentMethod
  card_info: string | null
  is_flagged: boolean
  flag_reasons: string[]
}
