import { supabase } from '../lib/supabase'

export interface InventoryItem {
    id: string
    user_id: string
    name: string
    quantity: number
    unit: string
    cost_per_unit?: number
    low_stock_threshold: number
    created_at: string
}

export interface InventoryLog {
    id: string
    item_id: string
    change_amount: number
    reason: string
    created_at: string
}

export const getInventoryItems = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

    if (error) throw error
    return data as InventoryItem[]
}

export const upsertInventoryItem = async (item: Partial<InventoryItem>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('inventory_items')
        .upsert({ ...item, user_id: user.id })
        .select()
        .single()

    if (error) throw error
    return data as InventoryItem
}

export const deleteInventoryItem = async (id: string) => {
    const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id)

    if (error) throw error
}

export const adjustStock = async (itemId: string, amount: number, reason: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // 1. Fetch current quantity
    const { data: item, error: fetchError } = await supabase
        .from('inventory_items')
        .select('quantity')
        .eq('id', itemId)
        .single()

    if (fetchError) throw fetchError

    const newQuantity = (Number(item.quantity) || 0) + Number(amount)

    // 2. Update Item
    const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ quantity: newQuantity })
        .eq('id', itemId)

    if (updateError) throw updateError

    // 3. Log History
    const { error: logError } = await supabase
        .from('inventory_logs')
        .insert({
            item_id: itemId,
            user_id: user.id,
            change_amount: amount,
            reason
        })

    if (logError) throw logError

    return newQuantity
}
