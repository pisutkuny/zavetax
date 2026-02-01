import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { DEFAULT_DEDUCTIONS, type TaxDeductions } from '../utils/personalTax'
import { getCategories, addCategory, deleteCategory, initializeDefaultCategories, type Category } from '../services/transactionService'

export default function Settings() {
    const navigate = useNavigate()
    const { t, language, setLanguage } = useLanguage()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [session, setSession] = useState<any>(null)

    // Profile State
    const [restaurantName, setRestaurantName] = useState('')
    const [taxId, setTaxId] = useState('')
    const [address, setAddress] = useState('')

    // Tax State
    const currentYear = new Date().getFullYear()
    const [taxSettingsId, setTaxSettingsId] = useState<string | null>(null)
    const [deductions, setDeductions] = useState<TaxDeductions>(DEFAULT_DEDUCTIONS)

    // Category State
    const [categories, setCategories] = useState<Category[]>([])
    const [categoryTab, setCategoryTab] = useState<'income' | 'expense'>('expense')
    const [newCategory, setNewCategory] = useState('')

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            if (session) {
                Promise.all([
                    getProfile(session),
                    getTaxSettings(session),
                    loadCategories(session.user.id)
                ]).finally(() => setLoading(false))
            } else {
                setLoading(false)
            }
        })
    }, [])

    const loadCategories = async (userId: string) => {
        try {
            await initializeDefaultCategories(userId)
            const income = await getCategories('income')
            const expense = await getCategories('expense')
            setCategories([...income, ...expense])
        } catch (error) {
            console.warn('Error loading categories', error)
        }
    }

    const handleAddCategory = async () => {
        if (!newCategory.trim()) return
        try {
            const added = await addCategory({ name: newCategory, type: categoryTab })
            setCategories([...categories, added])
            setNewCategory('')
        } catch (error) {
            console.error(error)
            alert(t('common.error'))
        }
    }

    const handleDeleteCategory = async (id: string) => {
        if (!confirm('Delete this category?')) return
        try {
            await deleteCategory(id)
            setCategories(categories.filter(c => c.id !== id))
        } catch (error) {
            console.error(error)
            alert(t('common.error'))
        }
    }

    const getProfile = async (session: any) => {
        try {
            const { user } = session
            const { data } = await supabase
                .from('profiles')
                .select(`restaurant_name, tax_id, address`)
                .eq('id', user.id)
                .single()

            if (data) {
                setRestaurantName(data.restaurant_name || '')
                setTaxId(data.tax_id || '')
                setAddress(data.address || '')
            }
        } catch (error) {
            console.warn('Error loading profile', error)
        }
    }

    const getTaxSettings = async (session: any) => {
        try {
            const { user } = session
            const { data } = await supabase
                .from('tax_settings')
                .select('*')
                .eq('user_id', user.id)
                .eq('year', currentYear)
                .single()

            if (data) {
                setTaxSettingsId(data.id)
                setDeductions({ ...DEFAULT_DEDUCTIONS, ...data.deductions })
            }
        } catch (error) {
            console.warn('Error loading tax settings', error)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const { user } = session

            // Save Profile
            const profileUpdates = {
                id: user.id,
                restaurant_name: restaurantName,
                tax_id: taxId,
                address,
                updated_at: new Date(),
            }
            await supabase.from('profiles').upsert(profileUpdates)

            // Save Tax Settings
            const taxUpdates = {
                user_id: user.id,
                year: currentYear,
                deductions,
                updated_at: new Date(),
            }

            // If we have an ID, we might want to update explicitly, but upsert with unique key works too if setup correctly.
            // However, to be safe with RLS match logic or if ID generation is needed:
            const { error: taxError } = await supabase
                .from('tax_settings')
                .upsert(taxSettingsId ? { ...taxUpdates, id: taxSettingsId } : taxUpdates, { onConflict: 'user_id, year' })

            if (taxError) throw taxError

            alert(t('common.success'))
            navigate('/')
        } catch (error) {
            alert(t('common.error'))
            console.error(error)
        } finally {
            setSaving(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    const handleDeductionChange = (key: keyof TaxDeductions, value: string) => {
        const numValue = Number(value) || 0
        setDeductions(prev => ({ ...prev, [key]: numValue }))
    }

    if (loading) return <div className="p-8 text-center text-slate-500">{t('common.loading')}</div>

    const currentCategories = categories.filter(c => c.type === categoryTab)

    return (
        <div className="min-h-screen bg-slate-50 relative pb-20">
            {/* Header */}
            <header className="bg-white p-4 shadow-sm border-b border-slate-100 flex items-center gap-4 sticky top-0 z-10">
                <button onClick={() => navigate('/')} className="text-slate-500 text-xl">←</button>
                <h1 className="font-bold text-lg text-slate-800">{t('settings.title')}</h1>
            </header>

            <div className="p-6 space-y-6">

                {/* Language Switcher */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                    <span className="font-medium text-slate-700">{t('settings.language')}</span>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setLanguage('en')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${language === 'en' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                        >
                            🇬🇧 EN
                        </button>
                        <button
                            onClick={() => setLanguage('th')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${language === 'th' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                        >
                            🇹🇭 TH
                        </button>
                    </div>
                </div>

                {/* Profile Section */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">{t('settings.restaurant_details')}</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">{t('settings.restaurant_name')}</label>
                            <input
                                value={restaurantName}
                                onChange={(e) => setRestaurantName(e.target.value)}
                                className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 transition-all font-semibold text-slate-800"
                                placeholder="My Awesome Cafe"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">{t('settings.tax_id')}</label>
                            <input
                                value={taxId}
                                onChange={(e) => setTaxId(e.target.value)}
                                className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 transition-all font-mono"
                                placeholder="01055xxxxxxxx"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">{t('settings.address')}</label>
                            <textarea
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 transition-all min-h-[80px]"
                                placeholder="Address..."
                            />
                        </div>
                    </div>
                </div>

                {/* Budget Settings Link */}
                <div
                    onClick={() => navigate('/settings/budget')}
                    className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer active:scale-[0.98] transition"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">💰</span>
                        <span className="font-bold text-slate-700">Budget Settings</span>
                    </div>
                    <span className="text-slate-400">→</span>
                </div>

                {/* Categories Section */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">Categories</h2>

                    {/* Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                        <button
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${categoryTab === 'expense' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400'}`}
                            onClick={() => setCategoryTab('expense')}
                        >
                            Expense
                        </button>
                        <button
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${categoryTab === 'income' ? 'bg-white shadow-sm text-green-600' : 'text-slate-400'}`}
                            onClick={() => setCategoryTab('income')}
                        >
                            Income
                        </button>
                    </div>

                    {/* List */}
                    <div className="space-y-2 mb-4">
                        {currentCategories.map(cat => (
                            <div key={cat.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="font-medium text-slate-700">{cat.name}</span>
                                <button
                                    onClick={() => handleDeleteCategory(cat.id)}
                                    className="text-red-400 hover:text-red-600 px-2"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add New */}
                    <div className="flex gap-2">
                        <input
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="New Category..."
                            className="flex-1 p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-blue-300"
                        />
                        <button
                            onClick={handleAddCategory}
                            disabled={!newCategory.trim()}
                            className="bg-slate-800 text-white px-4 rounded-xl font-bold disabled:opacity-50"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Tax Deductions Section */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 text-blue-800">
                        {t('settings.tax_deductions')} ({currentYear})
                    </h2>
                    <p className="text-xs text-slate-500 mb-6">Enter your annual deductions for P.N.D. 90/91 calculation.</p>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Personal</label>
                                <input
                                    type="number"
                                    value={deductions.personal_allowance}
                                    readOnly
                                    className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Spouse</label>
                                <input
                                    type="number"
                                    value={deductions.spouse_allowance}
                                    onChange={(e) => handleDeductionChange('spouse_allowance', e.target.value)}
                                    className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Child</label>
                                <input
                                    type="number"
                                    value={deductions.child_allowance}
                                    onChange={(e) => handleDeductionChange('child_allowance', e.target.value)}
                                    className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Parents</label>
                                <input
                                    type="number"
                                    value={deductions.parent_allowance}
                                    onChange={(e) => handleDeductionChange('parent_allowance', e.target.value)}
                                    className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        </div>

                        <hr className="border-slate-100" />

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Social Security</label>
                            <input
                                type="number"
                                value={deductions.social_security}
                                onChange={(e) => handleDeductionChange('social_security', e.target.value)}
                                className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Life Insurance + Health</label>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="number"
                                    placeholder="Life"
                                    value={deductions.life_insurance}
                                    onChange={(e) => handleDeductionChange('life_insurance', e.target.value)}
                                    className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
                                />
                                <input
                                    type="number"
                                    placeholder="Health"
                                    value={deductions.health_insurance}
                                    onChange={(e) => handleDeductionChange('health_insurance', e.target.value)}
                                    className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">PVD / RMF / SSF</label>
                            <input
                                type="number"
                                value={deductions.pvd_rmf_ssf}
                                onChange={(e) => handleDeductionChange('pvd_rmf_ssf', e.target.value)}
                                className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-70"
                >
                    {saving ? t('settings.saving') : t('settings.save_changes')}
                </button>

                <button
                    onClick={handleLogout}
                    className="w-full py-3 bg-white text-red-500 border border-red-100 font-bold rounded-xl shadow-sm transition-all active:scale-95 mt-8 hover:bg-red-50"
                >
                    {t('settings.sign_out')}
                </button>
            </div>
        </div>
    )
}
