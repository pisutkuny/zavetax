import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { getCategories, type Category, getBudgets, upsertBudget, type Budget } from '../services/transactionService'

export default function BudgetSettings() {
    const navigate = useNavigate()
    const { t } = useLanguage()

    const [categories, setCategories] = useState<Category[]>([])
    const [budgets, setBudgets] = useState<Record<string, number>>({}) // Local state for inputs
    const [originalBudgets, setOriginalBudgets] = useState<Record<string, number>>({}) // To check for changes
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const [cats, buds] = await Promise.all([
                getCategories('expense'),
                getBudgets()
            ])
            setCategories(cats)

            const budgetMap: Record<string, number> = {}
            buds.forEach(b => {
                budgetMap[b.category] = b.amount
            })
            setBudgets(budgetMap)
            setOriginalBudgets({ ...budgetMap })
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (category: string, value: string) => {
        const amount = parseFloat(value)
        setBudgets(prev => ({
            ...prev,
            [category]: isNaN(amount) ? 0 : amount
        }))
    }

    const handleSaveAll = async () => {
        setSaving(true)
        try {
            // Find changed budgets
            const promises = categories.map(async (cat) => {
                const currentAmount = budgets[cat.name] || 0
                const originalAmount = originalBudgets[cat.name] || 0

                // Only save if changed (or if it's a new budget being set)
                if (currentAmount !== originalAmount) {
                    const budget: Budget = {
                        category: cat.name,
                        amount: currentAmount,
                        alert_threshold: 80
                    }
                    await upsertBudget(budget)
                }
            })

            await Promise.all(promises)
            setOriginalBudgets({ ...budgets }) // Update original state
            alert(t('common.saved') || 'Saved successfully!')
            navigate('/')
        } catch (error) {
            console.error(error)
            alert(t('common.error'))
        } finally {
            setSaving(false)
        }
    }

    const hasChanges = JSON.stringify(budgets) !== JSON.stringify(originalBudgets)

    if (loading) return <div className="p-10 text-center">{t('common.loading')}</div>

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <header className="bg-white p-4 shadow-sm border-b border-slate-100 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/settings')} className="text-slate-500 text-xl">←</button>
                    <h1 className="font-bold text-lg text-slate-800">Budget Settings</h1>
                </div>
            </header>

            <div className="p-4 max-w-lg mx-auto space-y-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <div>
                        <h3 className="font-bold text-blue-800 text-sm">Set Monthly Limits</h3>
                        <p className="text-xs text-blue-600 mt-1">
                            Adjust your monthly limits below. Don't forget to save your changes!
                        </p>
                    </div>
                </div>

                <div className="space-y-3 pb-20">
                    {categories.map(cat => {
                        const amount = budgets[cat.name] || ''
                        return (
                            <div key={cat.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-slate-700">{t(`cat.${cat.name}`) || cat.name}</p>
                                    <p className="text-xs text-slate-400">Monthly Limit</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400 font-bold">฿</span>
                                    <input
                                        type="number"
                                        placeholder="No Limit"
                                        value={amount || ''}
                                        onChange={(e) => handleInputChange(cat.name, e.target.value)}
                                        className="w-28 p-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Save Button Bar */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-lg">
                    <div className="max-w-lg mx-auto">
                        <button
                            onClick={handleSaveAll}
                            disabled={!hasChanges || saving}
                            className={`w-full py-3 rounded-xl font-bold text-white shadow-md transition-all flex items-center justify-center gap-2
                                ${!hasChanges ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'}`}
                        >
                            {saving ? (
                                <>
                                    <span className="animate-spin">⏳</span> Saving...
                                </>
                            ) : (
                                <>
                                    <span>💾</span> Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

