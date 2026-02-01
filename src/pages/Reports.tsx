import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTransactions, type Transaction } from '../services/transactionService'
import { calculateVAT, calculateWHT } from '../utils/tax'
import { calculateNetTaxableIncome, calculateTaxStep, DEFAULT_DEDUCTIONS, type TaxDeductions } from '../utils/personalTax'
import { useLanguage } from '../contexts/LanguageContext'

import { generateTaxReportPDF } from '../services/pdfGenerator'
import { convertToCSV, downloadCSV } from '../services/csvGenerator'

export default function Reports() {
    const navigate = useNavigate()
    const { t, language } = useLanguage()
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [profile, setProfile] = useState<any>(null)
    const [deductions, setDeductions] = useState<TaxDeductions>(DEFAULT_DEDUCTIONS)

    const [loading, setLoading] = useState(true)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [activeTab, setActiveTab] = useState<'vat' | 'wht' | 'pnd94' | 'pnd90'>('vat')

    // PND Expense Mode Checkbox
    const [useStandardDeduction, setUseStandardDeduction] = useState(true)

    // ... (existing effects and loaders) ...

    useEffect(() => {
        loadData()
    }, [currentDate, activeTab])

    const loadData = async () => {
        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()

            const month = currentDate.getMonth() + 1
            const year = currentDate.getFullYear()

            // Fetch Transactions logic
            let data: Transaction[] = []

            if (activeTab.startsWith('pnd')) {
                const allData = await getTransactions()
                data = allData.filter(tx => new Date(tx.date).getFullYear() === year)
            } else {
                data = await getTransactions(month, year)
            }

            setTransactions(data || [])

            if (session) {
                const profileData = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
                if (profileData.data) setProfile(profileData.data)

                const taxSettings = await supabase.from('tax_settings').select('deductions').eq('user_id', session.user.id).eq('year', year).single()
                if (taxSettings.data) {
                    setDeductions({ ...DEFAULT_DEDUCTIONS, ...taxSettings.data.deductions })
                }
            }

        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }


    // Helper to safely convert to number
    const SafeNumber = (val: any) => {
        const num = Number(val)
        return isNaN(num) ? 0 : num
    }

    // --- VAT Calculation ---
    // Output VAT (Sales)
    const salesTransactions = transactions.filter(tx => tx.type === 'income')
    const totalSales = salesTransactions.reduce((sum, tx) => sum + SafeNumber(tx.amount), 0)
    const totalOutputVAT = salesTransactions.reduce((sum, tx) => sum + calculateVAT(SafeNumber(tx.amount), tx.tax_type || 'no_vat'), 0)

    // Input VAT (Expenses with Tax Invoice)
    const purchaseTransactions = transactions.filter(tx => tx.type === 'expense' && tx.tax_invoice)
    const totalPurchase = purchaseTransactions.reduce((sum, tx) => sum + SafeNumber(tx.amount), 0)
    const totalInputVAT = purchaseTransactions.reduce((sum, tx) => sum + calculateVAT(SafeNumber(tx.amount), 'vat_inc'), 0)

    const netVatPayable = totalOutputVAT - totalInputVAT

    // --- WHT Calculation ---
    const whtTransactions = transactions.filter(tx => tx.type === 'expense' && (tx.wht_rate || 0) > 0)
    const whtSummary = [1, 2, 3, 5].map(rate => {
        const txs = whtTransactions.filter(tx => tx.wht_rate === rate)
        const baseAmount = txs.reduce((sum, tx) => sum + SafeNumber(tx.amount), 0)
        const taxAmount = txs.reduce((sum, tx) => sum + calculateWHT(SafeNumber(tx.amount), rate), 0)
        return { rate, baseAmount, taxAmount, count: txs.length }
    }).filter(item => item.count > 0)
    const totalWHT = whtSummary.reduce((sum, item) => sum + item.taxAmount, 0)


    // --- PND Calculation (Annual/Half-Year) ---
    // For PND 94 (Half Year), we use data from Jan - Jun
    const pndSales = activeTab === 'pnd94'
        ? salesTransactions.filter(tx => new Date(tx.date).getMonth() < 6)
        : salesTransactions

    const pndExpenses = activeTab === 'pnd94'
        ? transactions.filter(tx => tx.type === 'expense' && new Date(tx.date).getMonth() < 6)
        : transactions.filter(tx => tx.type === 'expense')

    const totalIncomePND = pndSales.reduce((sum, tx) => sum + SafeNumber(tx.amount), 0)
    const totalActualExpensePND = pndExpenses.reduce((sum, tx) => sum + SafeNumber(tx.amount), 0)

    // Calculate PND Steps
    let netTaxableIncome = 0
    let taxPND = 0
    let pndError = null
    let reportData = null // Store calculated data for PDF

    // Default to current deductions for rendering (safe)
    let effectiveDeductions: TaxDeductions = deductions || DEFAULT_DEDUCTIONS

    try {
        effectiveDeductions = activeTab === 'pnd94'
            ? Object.fromEntries(Object.entries(deductions || DEFAULT_DEDUCTIONS).map(([k, v]) => [k, SafeNumber(v) / 2])) as unknown as TaxDeductions
            : (deductions || DEFAULT_DEDUCTIONS)

        // Explicitly cast deduction entries to numbers to be sure
        const cleanDeductions = {} as TaxDeductions
        for (const key in effectiveDeductions) {
            // @ts-ignore
            cleanDeductions[key] = SafeNumber(effectiveDeductions[key])
        }

        netTaxableIncome = calculateNetTaxableIncome(
            totalIncomePND,
            cleanDeductions,
            useStandardDeduction ? 'standard' : 'actual',
            totalActualExpensePND
        )

        taxPND = calculateTaxStep(netTaxableIncome)

        // Prepare data for PDF
        const calculateTotalDeductions = (
            effectiveDeductions.personal_allowance +
            effectiveDeductions.spouse_allowance +
            effectiveDeductions.child_allowance +
            effectiveDeductions.parent_allowance +
            effectiveDeductions.social_security +
            Math.min(100000, effectiveDeductions.life_insurance + Math.min(25000, effectiveDeductions.health_insurance)) +
            effectiveDeductions.pvd_rmf_ssf +
            effectiveDeductions.other
        )

        reportData = {
            totalIncome: totalIncomePND,
            totalExpenses: useStandardDeduction ? totalIncomePND * 0.6 : totalActualExpensePND,
            netIncome: totalIncomePND - (useStandardDeduction ? totalIncomePND * 0.6 : totalActualExpensePND),
            totalDeductions: calculateTotalDeductions,
            deductions: cleanDeductions,
            netTaxableIncome,
            taxPayable: taxPND
        }

    } catch (err: any) {
        console.error("PND Calculation Crash:", err)
        pndError = err.message
    }


    // --- Handlers ---
    const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    const formatMonth = (date: Date) => date.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { month: 'long', year: 'numeric' })

    const handleExportPDF = async () => {
        if (!reportData) return
        try {
            await generateTaxReportPDF(currentDate.getFullYear(), reportData, profile)
        } catch (error) {
            console.error(error)
            alert("Error generating PDF")
        }
    }

    const handleExportCSV = () => {
        if (!transactions.length) {
            alert(t('report.no_data') || "No data to export")
            return
        }

        try {
            const fileName = `ZaveTax_Export_${activeTab}_${currentDate.toISOString().split('T')[0]}.csv`
            const csv = convertToCSV(transactions)
            downloadCSV(csv, fileName)
        } catch (error) {
            console.error(error)
            alert("Error generating CSV")
        }
    }

    if (loading) return <div className="p-10 text-center">{t('common.loading')}</div>

    return (
        <div className="min-h-screen bg-slate-50 pb-24 print:bg-white print:pb-0">
            {/* Header (Hidden in Print) */}
            <header className="bg-white p-4 shadow-sm border-b border-slate-100 print:hidden sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="text-slate-500 text-xl">←</button>
                    <h1 className="flex-1 font-bold text-lg text-slate-800">{t('report.title')}</h1>

                    {(activeTab === 'pnd90' || activeTab === 'pnd94') ? (
                        <button
                            onClick={handleExportPDF}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md flex items-center gap-2 transition-all active:scale-95"
                        >
                            📄 Export PDF
                        </button>
                    ) : (
                        <button
                            onClick={() => window.print()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md flex items-center gap-2 transition-all active:scale-95"
                        >
                            🖨️ Print PDF
                        </button>
                    )}

                    <button
                        onClick={handleExportCSV}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md flex items-center gap-2 transition-all active:scale-95"
                    >
                        📊 Export CSV
                    </button>
                </div>

                {/* Month/Year Selector */}
                <div className="flex items-center justify-center gap-4 mt-4 bg-slate-100 p-2 rounded-xl">
                    <button onClick={handlePrevMonth} className="px-3 text-slate-500">◀</button>
                    <span className="font-bold text-slate-700">
                        {activeTab.startsWith('pnd')
                            ? currentDate.getFullYear()
                            : formatMonth(currentDate)
                        }
                    </span>
                    <button onClick={handleNextMonth} className="px-3 text-slate-500">▶</button>
                </div>

                {/* Tabs */}
                <div className="flex mt-4 border-b border-slate-200 overflow-x-auto">
                    <button onClick={() => setActiveTab('vat')} className={`flex-1 min-w-[80px] pb-2 font-bold text-xs ${activeTab === 'vat' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>VAT (PP.30)</button>
                    <button onClick={() => setActiveTab('wht')} className={`flex-1 min-w-[80px] pb-2 font-bold text-xs ${activeTab === 'wht' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>WHT</button>
                    <button onClick={() => setActiveTab('pnd94')} className={`flex-1 min-w-[80px] pb-2 font-bold text-xs ${activeTab === 'pnd94' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-400'}`}>PND 94</button>
                    <button onClick={() => setActiveTab('pnd90')} className={`flex-1 min-w-[80px] pb-2 font-bold text-xs ${activeTab === 'pnd90' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-400'}`}>PND 90</button>
                </div>
            </header>

            {/* Print Header (Visible only in Print) */}
            <div className="hidden print:block text-center mb-8 pt-8">
                <h1 className="text-2xl font-bold mb-2">{profile?.restaurant_name}</h1>
                <p className="text-sm text-slate-600">{profile?.address}</p>
                <p className="text-sm text-slate-600">Tax ID: {profile?.tax_id}</p>
                <h2 className="text-xl font-bold mt-4 border-t border-b py-2 uppercase">
                    {activeTab} Report ({currentDate.getFullYear()})
                </h2>
            </div>

            {/* Content */}
            <div className="p-4 max-w-2xl mx-auto print:p-0 print:max-w-none">

                {/* VAT Tab */}
                {activeTab === 'vat' && (
                    <div className="space-y-6">
                        {/* VAT Summary Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:shadow-none print:border-none print:p-0">
                            <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 hidden print:block">Summary</h3>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-green-700">
                                    <span>{t('report.total_sales')}</span>
                                    <span className="font-bold">฿{totalSales.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-600 pl-4 border-l-2 border-green-100">
                                    <span>{t('report.total_vat_output')} (7%)</span>
                                    <span>฿{totalOutputVAT.toLocaleString()}</span>
                                </div>

                                <hr className="border-slate-100 my-2" />

                                <div className="flex justify-between items-center text-orange-700">
                                    <span>{t('report.total_purchase')} (Tax Inv.)</span>
                                    <span className="font-bold">฿{totalPurchase.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-600 pl-4 border-l-2 border-orange-100">
                                    <span>{t('report.total_vat_input')} (7%)</span>
                                    <span>฿{totalInputVAT.toLocaleString()}</span>
                                </div>

                                <hr className="border-slate-200 my-4 border-dashed" />

                                <div className={`flex justify-between items-center text-lg font-bold p-4 rounded-xl ${netVatPayable > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'} print:bg-transparent print:p-0`}>
                                    <span>{netVatPayable > 0 ? t('report.vat_payable') : t('report.vat_refundable')}</span>
                                    <span>฿{Math.abs(netVatPayable).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* WHT Tab */}
                {activeTab === 'wht' && (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:shadow-none print:border-none print:p-0">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-600 print:bg-white print:border-b">
                                        <th className="py-2 text-left p-2">{t('report.wht_rate')}</th>
                                        <th className="py-2 text-right p-2">{t('report.base_amount')}</th>
                                        <th className="py-2 text-right p-2">{t('report.tax_amount')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {whtSummary.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="py-8 text-center text-slate-400">{t('report.no_data')}</td>
                                        </tr>
                                    ) : (
                                        whtSummary.map(item => (
                                            <tr key={item.rate} className="border-b border-slate-50">
                                                <td className="py-3 p-2 font-medium">{item.rate}%</td>
                                                <td className="py-3 p-2 text-right text-slate-600">฿{item.baseAmount.toLocaleString()}</td>
                                                <td className="py-3 p-2 text-right font-bold text-slate-800">฿{item.taxAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-100 bg-slate-50 font-bold text-slate-800 print:bg-white">
                                        <td className="py-3 p-2">Total</td>
                                        <td className="py-3 p-2 text-right">-</td>
                                        <td className="py-3 p-2 text-right">฿{totalWHT.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                {/* PND 90/94 Tab */}
                {(activeTab === 'pnd90' || activeTab === 'pnd94') && (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:shadow-none print:border-none print:p-0">
                            {pndError && (
                                <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
                                    Calculation Error: {pndError}
                                </div>
                            )}
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-slate-800">
                                    {activeTab === 'pnd90' ? 'Annual P.N.D. 90' : 'Half-Year P.N.D. 94'}
                                </h3>
                                {/* Toggle Standard Deduction */}
                                <div className="flex items-center gap-2 print:hidden">
                                    <span className="text-xs text-slate-500">Exp:</span>
                                    <button
                                        onClick={() => setUseStandardDeduction(true)}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold ${useStandardDeduction ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}
                                    >
                                        60%
                                    </button>
                                    <button
                                        onClick={() => setUseStandardDeduction(false)}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold ${!useStandardDeduction ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}
                                    >
                                        Actual
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between text-slate-600">
                                    <span>Total Income (40(8))</span>
                                    <span className="font-medium">฿{totalIncomePND.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-red-500">
                                    <span>
                                        Less Expenses {useStandardDeduction ? '(Standard 60%)' : '(Actual)'}
                                    </span>
                                    <span>-฿{(useStandardDeduction ? totalIncomePND * 0.6 : totalActualExpensePND).toLocaleString()}</span>
                                </div>

                                <div className="flex justify-between text-slate-600 pl-4 border-l-2 border-slate-100 py-1">
                                    <span>Less Allowances (Total)</span>
                                    <span>
                                        -฿{(
                                            effectiveDeductions.personal_allowance +
                                            effectiveDeductions.spouse_allowance +
                                            effectiveDeductions.child_allowance +
                                            effectiveDeductions.parent_allowance +
                                            effectiveDeductions.social_security +
                                            Math.min(100000, effectiveDeductions.life_insurance + Math.min(25000, effectiveDeductions.health_insurance)) +
                                            effectiveDeductions.pvd_rmf_ssf +
                                            effectiveDeductions.other
                                        ).toLocaleString()}
                                    </span>
                                </div>

                                <hr className="border-slate-100 my-2" />

                                <div className="flex justify-between font-bold text-slate-800">
                                    <span>Net Taxable Income</span>
                                    <span>฿{netTaxableIncome.toLocaleString()}</span>
                                </div>

                                <div className="mt-4 p-4 bg-purple-50 rounded-xl flex justify-between items-center text-purple-800 font-bold border border-purple-100">
                                    <span>Estimated Tax Payable</span>
                                    <span className="text-xl">฿{taxPND.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                </div>

                                <p className="text-xs text-gray-400 mt-2 text-center">
                                    *Estimation only. Please verify with Revenue Dept.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Notes */}
                <div className="mt-8 text-center text-xs text-slate-400 print:mt-12">
                    <p>Generated by ZaveTax</p>
                    <p>{new Date().toLocaleString()}</p>
                </div>
            </div>
        </div>
    )
}
