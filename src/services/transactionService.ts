import { supabase } from '../lib/supabase'

export interface Transaction {
    id: string
    created_at?: string
    type: 'income' | 'expense'
    amount: number
    category: string
    note: string
    date: string
    // Tax Fields
    tax_type?: 'vat_inc' | 'vat_exc' | 'no_vat'
    tax_invoice?: boolean
    wht_rate?: number
    receipt_url?: string
}

export interface Budget {
    id?: string
    user_id?: string
    category: string
    amount: number
    alert_threshold: number
}



export type NewTransaction = Omit<Transaction, 'id' | 'created_at'>

export const addTransaction = async (transaction: NewTransaction) => {
    const { data, error } = await supabase
        .from('transactions')
        .insert([transaction])
        .select()

    if (error) throw error
    return data
}

export const getTransactions = async (month?: number, year?: number) => {
    let query = supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

    if (month && year) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        // Calculate end date (start of next month)
        const nextMonth = month === 12 ? 1 : month + 1
        const nextYear = month === 12 ? year + 1 : year
        const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

        query = query.gte('date', startDate).lt('date', endDate)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []) as Transaction[]
}

export const getTransactionsByRange = async (startDate: string, endDate: string) => {
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })

    if (error) throw error
    return (data || []) as Transaction[]
}



export const getTransactionsByDay = async (date: string) => {
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('date', date)
        .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as Transaction[]
}

export const getTransaction = async (id: string) => {
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw error
    return data as Transaction
}

export const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .select()

    if (error) throw error
    return data
}

export const deleteTransaction = async (id: string) => {
    const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)

    if (error) throw error
}

// --- Categories ---

export interface Category {
    id: string
    user_id: string
    name: string
    type: 'income' | 'expense'
    is_default: boolean
}

export const DEFAULT_CATEGORIES_INCOME = ['Sales', 'Delivery', 'Catering']
export const DEFAULT_CATEGORIES_EXPENSE = ['Food Cost', 'Rent', 'Wages', 'Utilities', 'Equipment', 'Marketing']

export const getCategories = async (type: 'income' | 'expense') => {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: true })

    if (error) throw error
    return data as Category[]
}

export const addCategory = async (category: Omit<Category, 'id' | 'user_id' | 'created_at' | 'is_default'>) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No session')

    const { data, error } = await supabase
        .from('categories')
        .insert([{
            ...category,
            user_id: session.user.id,
            is_default: false
        }])
        .select()
        .single()

    if (error) throw error
    return data as Category
}

export const deleteCategory = async (id: string) => {
    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)

    if (error) throw error
}

// Helper to initialize defaults if empty
export const initializeDefaultCategories = async (userId: string) => {
    // Check if categories exist
    const { count } = await supabase.from('categories').select('*', { count: 'exact', head: true }).eq('user_id', userId)

    if (count === 0) {
        const defaults = [
            ...DEFAULT_CATEGORIES_INCOME.map(name => ({ user_id: userId, name, type: 'income', is_default: true })),
            ...DEFAULT_CATEGORIES_EXPENSE.map(name => ({ user_id: userId, name, type: 'expense', is_default: true }))
        ]

        const { error } = await supabase.from('categories').insert(defaults)
        if (error) console.error("Error initializing defaults:", error)
    }
}

export const uploadReceipt = async (file: File) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${fileName}`

    const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file)

    if (uploadError) {
        throw uploadError
    }

    const { data } = supabase.storage.from('receipts').getPublicUrl(filePath)
    return data.publicUrl
}

// --- Budget Services ---

export const getBudgets = async () => {
    const { data, error } = await supabase
        .from('budgets')
        .select('*')

    if (error) throw error
    return data as Budget[]
}

export const upsertBudget = async (budget: Budget) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error("No session")

    const { data, error } = await supabase
        .from('budgets')
        .upsert({
            user_id: session.user.id,
            category: budget.category,
            amount: budget.amount,
            alert_threshold: budget.alert_threshold
        }, { onConflict: 'user_id, category' })
        .select()

    if (error) throw error
    return data
}

export const getBudgetStatus = async (month: number, year: number) => {
    // 1. Get Budgets
    const budgets = await getBudgets()
    if (!budgets.length) return []

    // 2. Get Expenses for that month
    const { data: transactions } = await supabase
        .from('transactions')
        .select('category, amount')
        .eq('type', 'expense')
        .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
        .lte('date', `${year}-${String(month).padStart(2, '0')}-31`)

    // 3. Aggregate spending by category
    const spending: Record<string, number> = {}
    transactions?.forEach((tx: any) => {
        spending[tx.category] = (spending[tx.category] || 0) + Number(tx.amount)
    })

    // 4. Combine
    return budgets.map(b => ({
        ...b,
        spent: spending[b.category] || 0,
        status: (spending[b.category] || 0) > b.amount ? 'over'
            : (spending[b.category] || 0) > (b.amount * (b.alert_threshold / 100)) ? 'warning'
                : 'ok'
    }))
}


