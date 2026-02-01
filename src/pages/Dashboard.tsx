import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
    getTransactions,
    deleteTransaction,
    getTransactionsByRange,
    getTransactionsByDay,
    type Transaction,
    getBudgetStatus
} from '../services/transactionService'
import { calculateVAT, calculateWHT } from '../utils/tax'
import { useLanguage } from '../contexts/LanguageContext'
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts'

function Dashboard() {
    const navigate = useNavigate()
    const { t, language } = useLanguage()

    // Data States
    const [transactions, setTransactions] = useState<Transaction[]>([]) // Current Month
    const [budgetStatus, setBudgetStatus] = useState<any[]>([]) // New state
    const [trendData, setTrendData] = useState<any[]>([]) // Kept for AreaChart
    const [expenseMix, setExpenseMix] = useState<any[]>([]) // Kept for PieChart
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]) // New state for recent transactions
    const [profile, setProfile] = useState<any>(null)

    const [loading, setLoading] = useState(true)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [viewMode, setViewMode] = useState<'month' | 'day'>('month')

    // Metrics
    const totalIncome = transactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + Number(tx.amount), 0)
    const totalExpense = transactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + Number(tx.amount), 0)
    const netProfit = totalIncome - totalExpense

    // Tax Calcs
    const totalOutputVAT = transactions.filter(tx => tx.type === 'income')
        .reduce((sum, tx) => sum + calculateVAT(Number(tx.amount), tx.tax_type || 'no_vat'), 0)
    const totalInputVAT = transactions.filter(tx => tx.type === 'expense' && tx.tax_invoice)
        .reduce((sum, tx) => sum + calculateVAT(Number(tx.amount), 'vat_inc'), 0)
    const vatPayable = totalOutputVAT - totalInputVAT
    const totalWHTPayable = transactions.filter(tx => tx.type === 'expense' && (tx.wht_rate || 0) > 0)
        .reduce((sum, tx) => sum + calculateWHT(Number(tx.amount), tx.wht_rate || 0), 0)

    useEffect(() => {
        loadData()
        if (viewMode === 'month') {
            loadTrendData()
        }
    }, [currentDate, viewMode])

    const loadData = async () => {
        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()

            const month = currentDate.getMonth() + 1
            const year = currentDate.getFullYear()
            const dateStr = currentDate.toISOString().split('T')[0]

            const txPromise = viewMode === 'month'
                ? getTransactions(month, year)
                : getTransactionsByDay(dateStr)

            const [txData, profileData] = await Promise.all([
                txPromise,
                session ? supabase.from('profiles').select('restaurant_name').eq('id', session.user.id).single() : Promise.resolve({ data: null })
            ])

            setTransactions(txData)
            if (profileData.data) setProfile(profileData.data)

            // New budget status loading
            const budgets = await getBudgetStatus(month, year)
            setBudgetStatus(budgets)
            setRecentTransactions(txData.slice(0, 5)) // Get latest 5 transactions for recent list

            // Prepare Pie Chart Data (kept for existing chart)
            const expenses = txData.filter(tx => tx.type === 'expense')
            const catMap: Record<string, number> = {}
            expenses.forEach(tx => {
                const cat = t(`cat.${tx.category}`) || tx.category
                catMap[cat] = (catMap[cat] || 0) + Number(tx.amount)
            })
            const pieData = Object.entries(catMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5) // Top 5
            setExpenseMix(pieData)

        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadTrendData = async () => {
        // Last 6 months
        const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        const start = new Date(currentDate.getFullYear(), currentDate.getMonth() - 5, 1)

        try {
            const txs = await getTransactionsByRange(start.toISOString(), end.toISOString())

            // Group by Month
            const groups: Record<string, { month: string, income: number, expense: number }> = {}

            // Init empty months
            for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
                const key = `${d.getFullYear()}-${d.getMonth()}`
                const label = d.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { month: 'short' })
                groups[key] = { month: label, income: 0, expense: 0 }
            }

            txs.forEach(tx => {
                const d = new Date(tx.date)
                const key = `${d.getFullYear()}-${d.getMonth()}`
                if (groups[key]) {
                    if (tx.type === 'income') groups[key].income += Number(tx.amount)
                    else groups[key].expense += Number(tx.amount)
                }
            })

            setTrendData(Object.values(groups))
        } catch (e) {
            console.error("Trend load error", e)
        }
    }

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (window.confirm(t('common.confirm_delete'))) {
            try {
                await deleteTransaction(id)
                loadData()
                loadTrendData()
            } catch (error) {
                alert(t('common.error'))
            }
        }
    }

    const handlePrev = () => {
        const newDate = new Date(currentDate)
        if (viewMode === 'month') {
            newDate.setMonth(newDate.getMonth() - 1)
            newDate.setDate(1)
        } else {
            newDate.setDate(newDate.getDate() - 1)
        }
        setCurrentDate(newDate)
    }

    const handleNext = () => {
        const newDate = new Date(currentDate)
        if (viewMode === 'month') {
            newDate.setMonth(newDate.getMonth() + 1)
            newDate.setDate(1)
        } else {
            newDate.setDate(newDate.getDate() + 1)
        }
        setCurrentDate(newDate)
    }

    const formatDateDisplay = (date: Date) => {
        if (viewMode === 'month') {
            return date.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { month: 'long', year: 'numeric' })
        } else {
            return date.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
        }
    }

    const formatCurrency = (amount: number) => {
        return `฿${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    };

    const COLORS = ['#FF8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042']

    return (
        <div className="min-h-screen bg-slate-50 relative pb-24">
            {/* Header */}
            <header className="bg-blue-900 text-white rounded-b-3xl p-6 pt-12 shadow-lg">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-blue-200 text-sm font-medium">
                            {profile?.restaurant_name ? profile.restaurant_name : t('dashboard.net_profit')}
                        </h2>
                        <h1 className="text-4xl font-bold mt-1">
                            {loading ? '...' : `฿${netProfit.toLocaleString()}`}
                        </h1>
                    </div>
                    <button
                        onClick={() => navigate('/settings')}
                        className="h-10 w-10 bg-blue-800 rounded-full flex items-center justify-center hover:bg-blue-700 transition cursor-pointer"
                    >
                        <span className="text-lg">⚙️</span>
                    </button>
                </div>

                <div className="flex items-center justify-between bg-blue-800/30 rounded-xl p-2 mb-6 backdrop-blur-sm gap-2">
                    <button onClick={handlePrev} className="px-3 py-1 text-blue-200 hover:text-white text-xl">◀</button>

                    <div className="flex flex-col items-center relative group">
                        {/* Interactive Date Picker Overlay */}
                        <div className="relative flex items-center justify-center">
                            <span className="font-semibold text-lg cursor-pointer flex items-center gap-2 group-hover:text-blue-100 transition">
                                {formatDateDisplay(currentDate)}
                                <span className="text-sm opacity-70">📅</span>
                            </span>
                            <input
                                type={viewMode === 'day' ? 'date' : 'month'}
                                value={viewMode === 'day'
                                    ? currentDate.toISOString().split('T')[0]
                                    : currentDate.toISOString().slice(0, 7)
                                }
                                onChange={(e) => {
                                    if (e.target.value) {
                                        const newDate = new Date(e.target.value)
                                        // If month mode, set to 1st of month to avoid overflow issues (e.g. Feb 30)
                                        if (viewMode === 'month') newDate.setDate(1)
                                        setCurrentDate(newDate)
                                    }
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                        </div>

                        <div className="flex bg-blue-900/50 rounded-lg p-0.5 mt-1 relative z-10">
                            <button
                                onClick={() => setViewMode('day')}
                                className={`px-3 py-0.5 text-xs rounded-md transition ${viewMode === 'day' ? 'bg-white text-blue-900 font-bold' : 'text-blue-300 hover:text-white'}`}
                            >
                                {t('common.day') || 'Day'}
                            </button>
                            <button
                                onClick={() => setViewMode('month')}
                                className={`px-3 py-0.5 text-xs rounded-md transition ${viewMode === 'month' ? 'bg-white text-blue-900 font-bold' : 'text-blue-300 hover:text-white'}`}
                            >
                                {t('common.month') || 'Month'}
                            </button>
                        </div>
                    </div>

                    <button onClick={handleNext} className="px-3 py-1 text-blue-200 hover:text-white text-xl">▶</button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="p-4 space-y-6 -mt-8">

                {/* 1. Tax Alert Card (Priority) */}
                <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-slate-800 font-bold flex items-center gap-2">
                            <span>🚨</span> {t('dashboard.tax_liability')}
                        </h3>
                        <button onClick={() => navigate('/reports')} className="text-blue-600 text-xs font-bold bg-blue-50 px-3 py-1 rounded-full">
                            📄 Report
                        </button>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1 p-3 bg-red-50 rounded-xl border border-red-100">
                            <p className="text-xs text-red-500 mb-1 font-bold">VAT ({t('report.vat_payable')})</p>
                            <p className="font-bold text-red-700 text-lg">
                                {vatPayable > 0 ? `฿${vatPayable.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '฿0'}
                            </p>
                        </div>
                        <div className="flex-1 p-3 bg-orange-50 rounded-xl border border-orange-100">
                            <p className="text-xs text-orange-500 mb-1 font-bold">WHT ({t('dashboard.wht_remit')})</p>
                            <p className="font-bold text-orange-700 text-lg">
                                ฿{totalWHTPayable.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. Charts Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Trend Chart */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-bold text-slate-700 mb-4">📈 Performance (6 Months)</h3>
                        <div className="h-48 text-xs">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ffc658" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#ffc658" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" />
                                    <YAxis hide />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="income" stroke="#82ca9d" fillOpacity={1} fill="url(#colorIncome)" />
                                    <Area type="monotone" dataKey="expense" stroke="#ffc658" fillOpacity={1} fill="url(#colorExpense)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Expense Mix Chart */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-bold text-slate-700 mb-4">💸 Top Expenses</h3>
                        <div className="h-48 text-xs flex">
                            <ResponsiveContainer width="60%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={expenseMix}
                                        innerRadius={40}
                                        outerRadius={60}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {expenseMix.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: any) => `฿${Number(value || 0).toLocaleString()}`} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex-1 flex flex-col justify-center gap-2">
                                {expenseMix.map((entry, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                        <span className="text-xs text-slate-600 truncate">{entry.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Budget Health Section */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-800">Budget Health 🏥</h2>
                        <button onClick={() => navigate('/settings/budget')} className="text-sm text-blue-600 font-bold hover:underline">Manage</button>
                    </div>
                    {budgetStatus.length > 0 ? (
                        <div className="space-y-4">
                            {budgetStatus.map((b: any) => {
                                const percent = Math.min((b.spent / b.amount) * 100, 100)
                                const color = b.status === 'over' ? 'bg-red-500' : b.status === 'warning' ? 'bg-orange-400' : 'bg-green-500'
                                return (
                                    <div key={b.category}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-bold text-slate-700">{b.category}</span>
                                            <span className={`font-bold ${b.status === 'over' ? 'text-red-500' : 'text-slate-500'}`}>
                                                {formatCurrency(b.spent)} / {formatCurrency(b.amount)}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className={`h-2.5 rounded-full ${color} transition-all duration-500`}
                                                style={{ width: `${percent}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <span className="text-4xl mb-2 block">📉</span>
                            <p className="text-slate-500 text-sm mb-3">You haven't set any budgets yet.</p>
                            <button
                                onClick={() => navigate('/settings/budget')}
                                className="text-blue-600 font-bold text-sm bg-white border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-50 transition shadow-sm"
                            >
                                + Set Monthly Limits
                            </button>
                        </div>
                    )}
                </div>

                {/* Recent Transactions List */}
                <div>
                    <h3 className="text-slate-800 font-bold text-lg mb-4">{t('dashboard.recent_transactions')}</h3>
                    <div className="space-y-3">
                        {loading ? (
                            <div className="text-center py-10 text-slate-400">{t('common.loading')}</div>
                        ) : recentTransactions.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-slate-100">{t('dashboard.no_transactions')}</div>
                        ) : (
                            transactions.map(tx => (
                                <div
                                    key={tx.id}
                                    onClick={() => navigate(`/edit/${tx.type}/${tx.id}`)}
                                    className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition active:scale-[0.99]"
                                >
                                    <div className="flex gap-3 items-center">
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xl ${tx.type === 'income' ? 'bg-green-100' : 'bg-orange-100'}`}>
                                            {tx.type === 'income' ? '💰' : '💸'}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800 capitalize">{t(`cat.${tx.category}`) || tx.category}</p>
                                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                                {tx.date}
                                                {tx.receipt_url && <span title="Has Receipt">📎</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className={`font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-orange-600'}`}>
                                            {tx.type === 'income' ? '+' : '-'}฿{Number(tx.amount).toLocaleString()}
                                        </p>
                                        <button
                                            onClick={(e) => handleDelete(e, tx.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 transition"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 pb-8 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex gap-4">
                    <button
                        onClick={() => navigate('/add/income')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold shadow-md transition-colors flex items-center justify-center gap-2"
                    >
                        <span>+</span> {t('dashboard.income')}
                    </button>
                    <button
                        onClick={() => navigate('/add/expense')}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold shadow-md transition-colors flex items-center justify-center gap-2"
                    >
                        <span>-</span> {t('dashboard.expense')}
                    </button>
                </div>
            </nav>
        </div>
    )
}

export default Dashboard
