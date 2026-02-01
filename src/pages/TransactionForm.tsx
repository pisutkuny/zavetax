import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { addTransaction, getTransaction, updateTransaction, getCategories, uploadReceipt, type Category, DEFAULT_CATEGORIES_INCOME, DEFAULT_CATEGORIES_EXPENSE } from '../services/transactionService'
import { useLanguage } from '../contexts/LanguageContext'

function TransactionForm() {
    const navigate = useNavigate()
    const { t } = useLanguage()
    const { type, id } = useParams<{ type: 'income' | 'expense'; id?: string }>()
    const isIncome = type === 'income'
    const isEditMode = !!id

    const [amount, setAmount] = useState('')
    const [category, setCategory] = useState('')
    const [note, setNote] = useState('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [loading, setLoading] = useState(false)
    const [fetchLoading, setFetchLoading] = useState(false)

    // Receipt
    const [receiptFile, setReceiptFile] = useState<File | null>(null)
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null)

    // Dynamic Categories
    const [categories, setCategories] = useState<Category[]>([])

    // Tax States
    const [taxType, setTaxType] = useState<'vat_inc' | 'vat_exc' | 'no_vat'>('no_vat') // For Income
    const [taxInvoice, setTaxInvoice] = useState(false) // For Expense (Input Tax Claim)
    const [whtRate, setWhtRate] = useState(0) // For Expense (WHT to Remit)

    useEffect(() => {
        // Load Categories
        const loadCats = async () => {
            try {
                const cats = await getCategories(isIncome ? 'income' : 'expense')
                setCategories(cats)
            } catch (error) {
                console.error("Error loading categories", error)
                // Fallback to defaults if DB fails (e.g. table not created yet)
                const defaults = isIncome ? DEFAULT_CATEGORIES_INCOME : DEFAULT_CATEGORIES_EXPENSE
                setCategories(defaults.map(name => ({ id: name, name, type: isIncome ? 'income' : 'expense', user_id: '', is_default: true })))
            }
        }
        loadCats()

        if (isEditMode && id) {
            setFetchLoading(true)
            getTransaction(id)
                .then(data => {
                    if (data) {
                        setAmount(data.amount.toString())
                        setCategory(data.category)
                        setNote(data.note || '')
                        setDate(data.date)
                        if (data.type === 'income') {
                            setTaxType(data.tax_type || 'no_vat')
                        } else {
                            setTaxInvoice(data.tax_invoice || false)
                            setWhtRate(data.wht_rate || 0)
                        }
                        if (data.receipt_url) setReceiptPreview(data.receipt_url)
                    }
                })
                .catch(err => {
                    console.error(err)
                    alert(t('common.error'))
                })
                .finally(() => setFetchLoading(false))
        }
    }, [isEditMode, id, isIncome, t])

    const primaryColor = isIncome ? 'text-green-600' : 'text-orange-600'
    const buttonClass = isIncome ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'
    const bgSoft = isIncome ? 'bg-green-50' : 'bg-orange-50'

    const handleSave = async () => {
        if (!amount || !category) {
            alert(t('common.error')) // Basic alert, ideally validate better
            return
        }

        try {
            setLoading(true)

            let receiptUrl = receiptPreview
            // If new file attached, upload it
            if (receiptFile) {
                receiptUrl = await uploadReceipt(receiptFile)
            }

            const transactionData = {
                type: (isIncome ? 'income' : 'expense') as 'income' | 'expense',
                amount: parseFloat(amount),
                category,
                note,
                date,
                tax_type: isIncome ? taxType : 'no_vat',
                tax_invoice: !isIncome ? taxInvoice : false,
                wht_rate: !isIncome ? whtRate : 0,
                receipt_url: receiptUrl as string
            }

            if (isEditMode && id) {
                await updateTransaction(id, transactionData)
            } else {
                await addTransaction(transactionData)
            }

            navigate('/')
        } catch (error) {
            console.error(error)
            alert(t('common.error'))
        } finally {
            setLoading(false)
        }
    }

    if (fetchLoading) return <div className="p-10 text-center text-slate-500">{t('common.loading')}</div>

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <header className="flex items-center p-4 border-b border-slate-100">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 text-2xl">
                    ←
                </button>
                <h1 className="flex-1 text-center font-bold text-lg text-slate-800 capitalize">
                    {isEditMode
                        ? t(isIncome ? 'form.edit_income' : 'form.edit_expense')
                        : t(isIncome ? 'form.add_income' : 'form.add_expense')
                    }
                </h1>
                <div className="w-8" />
            </header>

            <div className="p-6 pb-32">
                {/* Amount Input */}
                <div className={`p-6 rounded-2xl mb-8 text-center ${bgSoft}`}>
                    <label className="text-slate-500 text-sm font-medium">{t('form.amount')}</label>
                    <div className="flex items-center justify-center mt-2">
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                            className={`w-full text-center text-5xl font-bold bg-transparent outline-none ${primaryColor}`}
                            autoFocus={!isEditMode}
                        />
                    </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-slate-500 text-sm font-medium mb-2">{t('form.category')}</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none text-slate-800 font-medium appearance-none"
                        >
                            <option value="">{t('form.select_category')}</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.name}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-slate-500 text-sm font-medium mb-2">{t('form.date')}</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none text-slate-800 font-medium"
                        />
                    </div>

                    {/* Tax Logic Section */}
                    <div className="p-4 border border-slate-100 rounded-xl">
                        <h3 className="text-sm font-bold text-slate-700 mb-3">{t('form.tax_details')}</h3>

                        {isIncome ? (
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-2">
                                    <input type="radio" checked={taxType === 'vat_inc'} onChange={() => setTaxType('vat_inc')} />
                                    <span className="text-sm">{t('form.vat_included')}</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="radio" checked={taxType === 'no_vat'} onChange={() => setTaxType('no_vat')} />
                                    <span className="text-sm">{t('form.no_vat')}</span>
                                </label>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <label className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={taxInvoice}
                                        onChange={(e) => setTaxInvoice(e.target.checked)}
                                        className="w-5 h-5 rounded text-blue-600"
                                    />
                                    <span className="text-sm font-medium text-slate-700">{t('form.receive_tax_invoice')}</span>
                                </label>

                                <div>
                                    <label className="block text-slate-500 text-xs mb-1">{t('form.wht')}</label>
                                    <select
                                        value={whtRate}
                                        onChange={(e) => setWhtRate(Number(e.target.value))}
                                        className="w-full p-2 bg-slate-50 rounded-lg text-sm"
                                    >
                                        <option value={0}>{t('form.wht_none')}</option>
                                        <option value={1}>1%</option>
                                        <option value={2}>2%</option>
                                        <option value={3}>3%</option>
                                        <option value={5}>5%</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Receipt Upload */}
                    <div className="p-4 border border-slate-100 rounded-xl">
                        <h3 className="text-sm font-bold text-slate-700 mb-3 block">📸 {t('form.receipt') || 'Receipt / Photo'}</h3>

                        {receiptPreview ? (
                            <div className="relative rounded-lg overflow-hidden border border-slate-200">
                                <img src={receiptPreview} alt="Receipt" className="w-full max-h-60 object-contain bg-slate-100" />
                                <button
                                    onClick={() => {
                                        setReceiptPreview(null)
                                        setReceiptFile(null)
                                    }}
                                    className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full shadow-md w-8 h-8 flex items-center justify-center font-bold"
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition">
                                <span className="text-2xl mb-1">📷</span>
                                <span className="text-xs text-slate-500 font-medium">Click to upload</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            const file = e.target.files[0]
                                            setReceiptFile(file)
                                            setReceiptPreview(URL.createObjectURL(file))
                                        }
                                    }}
                                />
                            </label>
                        )}
                    </div>

                    <div>
                        <label className="block text-slate-500 text-sm font-medium mb-2">{t('form.note')}</label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="..."
                            className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none text-slate-800 min-h-[100px]"
                        />
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100">
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition-transform active:scale-95 flex justify-center items-center ${buttonClass} ${loading ? 'opacity-70' : ''}`}
                >
                    {loading ? t('common.loading') : isEditMode ? t('form.update_transaction') : t('form.save_transaction')}
                </button>
            </div>
        </div >
    )
}

export default TransactionForm
