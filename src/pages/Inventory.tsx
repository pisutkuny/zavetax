import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getInventoryItems, upsertInventoryItem, adjustStock, type InventoryItem } from '../services/inventoryService'

export default function Inventory() {
    const navigate = useNavigate()
    const [items, setItems] = useState<InventoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showAdjustModal, setShowAdjustModal] = useState(false)
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
    const [adjustType, setAdjustType] = useState<'in' | 'out'>('in') // 'in' or 'out'

    // Form States
    const [newItemName, setNewItemName] = useState('')
    const [newItemUnit, setNewItemUnit] = useState('')
    const [newItemThreshold, setNewItemThreshold] = useState('5')

    // Adjust States
    const [adjustAmount, setAdjustAmount] = useState('')
    const [adjustReason, setAdjustReason] = useState('')

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const data = await getInventoryItems()
            setItems(data)
        } catch (error) {
            console.error(error)
            alert('Failed to load inventory')
        } finally {
            setLoading(false)
        }
    }

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await upsertInventoryItem({
                name: newItemName,
                unit: newItemUnit,
                low_stock_threshold: parseFloat(newItemThreshold) || 5,
                quantity: 0 // Start with 0
            })
            setNewItemName('')
            setNewItemUnit('')
            setShowAddModal(false)
            loadData()
        } catch (error) {
            console.error(error)
            alert('Failed to add item')
        }
    }

    const handleOpenAdjust = (item: InventoryItem, type: 'in' | 'out') => {
        setSelectedItem(item)
        setAdjustType(type)
        setAdjustAmount('')
        setAdjustReason(type === 'in' ? 'Purchase' : 'Daily Usage')
        setShowAdjustModal(true)
    }

    const handleConfirmAdjust = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedItem) return

        const amount = parseFloat(adjustAmount)
        if (isNaN(amount) || amount <= 0) return alert('Invalid amount')

        const finalAmount = adjustType === 'in' ? amount : -amount

        try {
            await adjustStock(selectedItem.id, finalAmount, adjustReason)
            setShowAdjustModal(false)
            loadData()
        } catch (error) {
            console.error(error)
            alert('Failed to update stock')
        }
    }



    if (loading) return <div className="p-10 text-center">Loading Inventory...</div>

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <header className="bg-white p-4 shadow-sm border-b border-slate-100 sticky top-0 z-10 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="text-slate-500 text-xl">←</button>
                    <h1 className="font-bold text-lg text-slate-800">Inventory 📦</h1>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition"
                >
                    + New Item
                </button>
            </header>

            <div className="p-4 max-w-2xl mx-auto space-y-4">
                {/* Low Stock Alert */}
                {items.some(i => i.quantity <= i.low_stock_threshold) && (
                    <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 flex items-center gap-3">
                        <span className="text-xl">⚠️</span>
                        <div>
                            <p className="font-bold text-orange-800 text-sm">Low Stock Alert</p>
                            <p className="text-xs text-orange-600">Some items are running low. Check below.</p>
                        </div>
                    </div>
                )}

                {/* Inventory List */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    {items.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <span className="text-4xl block mb-2">📦</span>
                            <p>No items yet. Add one!</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {items.map(item => {
                                const isLow = item.quantity <= item.low_stock_threshold
                                return (
                                    <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-slate-700">{item.name}</h3>
                                                {isLow && <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">LOW</span>}
                                            </div>
                                            <p className="text-xs text-slate-400">Target: {item.low_stock_threshold} {item.unit}</p>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="text-right mr-2">
                                                <p className={`font-bold text-lg ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
                                                    {item.quantity}
                                                </p>
                                                <p className="text-[10px] text-slate-400 uppercase">{item.unit}</p>
                                            </div>

                                            <div className="flex bg-slate-100 rounded-lg p-1">
                                                <button
                                                    onClick={() => handleOpenAdjust(item, 'out')}
                                                    className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-red-500 font-bold hover:bg-red-50"
                                                >
                                                    -
                                                </button>
                                                <button
                                                    onClick={() => handleOpenAdjust(item, 'in')}
                                                    className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-green-500 font-bold ml-1 hover:bg-green-50"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Item Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in">
                        <h2 className="text-lg font-bold mb-4">New Item</h2>
                        <form onSubmit={handleAddItem} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Item Name</label>
                                <input autoFocus required value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50" placeholder="e.g. Pork" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Unit</label>
                                    <input required value={newItemUnit} onChange={e => setNewItemUnit(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50" placeholder="e.g. Kg" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Alert at</label>
                                    <input type="number" required value={newItemThreshold} onChange={e => setNewItemThreshold(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50" />
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 text-slate-500 font-bold">Cancel</button>
                                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Adjust Stock Modal */}
            {showAdjustModal && selectedItem && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold">
                                {adjustType === 'in' ? 'Stock IN (+)' : 'Stock OUT (-)'}
                            </h2>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${adjustType === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {selectedItem.name}
                            </span>
                        </div>

                        <form onSubmit={handleConfirmAdjust} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Amount ({selectedItem.unit})</label>
                                <input
                                    type="number"
                                    autoFocus
                                    required
                                    step="0.01"
                                    value={adjustAmount}
                                    onChange={e => setAdjustAmount(e.target.value)}
                                    className="w-full p-3 border rounded-xl bg-slate-50 text-2xl font-bold text-center"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Reason</label>
                                {adjustType === 'in' ? (
                                    <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50">
                                        <option value="Purchase">Purchase (ซื้อเข้า)</option>
                                        <option value="Return">Customer Return (คืนของ)</option>
                                        <option value="Correction">Adjustment (ปรับยอด)</option>
                                        <option value="Other">Other</option>
                                    </select>
                                ) : (
                                    <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50">
                                        <option value="Daily Usage">Daily Usage (ใช้ขาย)</option>
                                        <option value="Spoilage">Spoilage/Waste (เสีย/ทิ้ง)</option>
                                        <option value="Staff Meal">Staff Meal (เลี้ยงพนักงาน)</option>
                                        <option value="Correction">Adjustment (ปรับยอด)</option>
                                        <option value="Other">Other</option>
                                    </select>
                                )}
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setShowAdjustModal(false)} className="flex-1 py-2 text-slate-500 font-bold">Cancel</button>
                                <button type="submit" className={`flex-1 py-2 rounded-xl font-bold text-white ${adjustType === 'in' ? 'bg-green-600' : 'bg-red-600'}`}>
                                    Confirm
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
