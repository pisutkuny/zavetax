import { createContext, useContext, useState, type ReactNode } from 'react'

type Language = 'en' | 'th'

type Translations = {
    [key: string]: {
        en: string
        th: string
    }
}

const dictionary: Translations = {
    // Common
    'common.save': { en: 'Save', th: 'บันทึก' },
    'common.cancel': { en: 'Cancel', th: 'ยกเลิก' },
    'common.delete': { en: 'Delete', th: 'ลบ' },
    'common.edit': { en: 'Edit', th: 'แก้ไข' },
    'common.loading': { en: 'Loading...', th: 'กำลังโหลด...' },
    'common.confirm_delete': { en: 'Are you sure you want to delete this transaction?', th: 'คุณแน่ใจหรือไม่ที่จะลบรายการนี้?' },
    'common.success': { en: 'Success', th: 'สำเร็จ' },
    'common.error': { en: 'Error', th: 'เกิดข้อผิดพลาด' },
    'common.day': { en: 'Day', th: 'รายวัน' },
    'common.month': { en: 'Month', th: 'รายเดือน' },

    // Dashboard
    'dashboard.net_profit': { en: 'Net Profit', th: 'กำไรสุทธิ' },
    'dashboard.income': { en: 'Income', th: 'รายรับ' },
    'dashboard.expense': { en: 'Expense', th: 'รายจ่าย' },
    'dashboard.tax_liability': { en: 'Tax Liability (Estimated)', th: 'ภาระภาษี (ประมาณการ)' },
    'dashboard.vat_payable': { en: 'VAT Payable (PP.30)', th: 'ภาษีมูลค่าเพิ่มที่ต้องชำระ (ภ.พ.30)' },
    'dashboard.wht_remit': { en: 'WHT to Remit', th: 'ภาษีหัก ณ ที่จ่ายนำส่ง' },
    'dashboard.recent_transactions': { en: 'Recent Transactions', th: 'รายการล่าสุด' },
    'dashboard.no_transactions': { en: 'No transactions', th: 'ไม่มีรายการ' },
    'dashboard.refresh': { en: 'Refresh', th: 'รีเฟรช' },

    // Transaction Form
    'form.add_income': { en: 'Add Income', th: 'เพิ่มรายรับ' },
    'form.add_expense': { en: 'Add Expense', th: 'เพิ่มรายจ่าย' },
    'form.edit_income': { en: 'Edit Income', th: 'แก้ไขรายรับ' },
    'form.edit_expense': { en: 'Edit Expense', th: 'แก้ไขรายจ่าย' },
    'form.amount': { en: 'Amount (THB)', th: 'จำนวนเงิน (บาท)' },
    'form.category': { en: 'Category', th: 'หมวดหมู่' },
    'form.select_category': { en: 'Select Category', th: 'เลือกหมวดหมู่' },
    'form.date': { en: 'Date', th: 'วันที่' },
    'form.note': { en: 'Note (Optional)', th: 'บันทึกพิ่มเติม (ระบุหรือไม่ก็ได้)' },
    'form.tax_details': { en: 'Tax Details', th: 'ข้อมูลภาษี' },
    'form.vat_included': { en: 'VAT Included (7%)', th: 'รวม VAT 7% แล้ว' },
    'form.no_vat': { en: 'No VAT', th: 'ไม่มี VAT' },
    'form.receive_tax_invoice': { en: 'Receive Tax Invoice', th: 'ได้รับใบกำกับภาษี (เคลมภาษีซื้อ)' },
    'form.wht': { en: 'Withholding Tax', th: 'ภาษีหัก ณ ที่จ่าย' },
    'form.wht_none': { en: 'None (0%)', th: 'ไม่มี (0%)' },
    'form.save_transaction': { en: 'Save Transaction', th: 'บันทึกรายการ' },
    'form.update_transaction': { en: 'Update Transaction', th: 'อัปเดตรายการ' },
    'form.receipt': { en: 'Receipt / Photo', th: 'รูปสลิป / ใบเสร็จ' },

    // Categories
    'cat.sales': { en: 'Food Sales', th: 'ยอดขายหน้าร้าน' },
    'cat.delivery': { en: 'Delivery App', th: 'เดลิเวอรี่' },
    'cat.catering': { en: 'Catering', th: 'จัดเลี้ยง' },
    'cat.food_cost': { en: 'Food Cost (Raw Materials)', th: 'ค่าวัตถุดิบ' },
    'cat.rent': { en: 'Rent', th: 'ค่าเช่า' },
    'cat.wages': { en: 'Staff Wages', th: 'เงินเดือนพนักงาน' },
    'cat.utilities': { en: 'Utilities (Water/Electric)', th: 'ค่าน้ำ/ค่าไฟ' },
    'cat.equipment': { en: 'Equipment', th: 'อุปกรณ์' },
    'cat.marketing': { en: 'Marketing', th: 'การตลาด' },

    // Settings
    'settings.title': { en: 'Settings', th: 'ตั้งค่า' },
    'settings.restaurant_details': { en: 'Restaurant Details', th: 'ข้อมูลร้าน' },
    'settings.restaurant_name': { en: 'Restaurant Name', th: 'ชื่อร้าน' },
    'settings.tax_id': { en: 'Tax ID (13 Digits)', th: 'เลขประจำตัวผู้เสียภาษี (13 หลัก)' },
    'settings.address': { en: 'Address', th: 'ที่อยู่' },
    'settings.save_changes': { en: 'Save Changes', th: 'บันทึกการเปลี่ยนแปลง' },
    'settings.saving': { en: 'Saving...', th: 'กำลังบันทึก...' },
    'settings.sign_out': { en: 'Sign Out', th: 'ออกจากระบบ' },
    'settings.language': { en: 'Language', th: 'ภาษา' },

    // Reports
    'report.title': { en: 'Tax Reports', th: 'รายงานภาษี' },
    'report.month': { en: 'Month', th: 'ประจำเดือน' },
    'report.vat_report': { en: 'VAT Report (P.P.30)', th: 'รายงานภาษีมูลค่าเพิ่ม (ภ.พ.30)' },
    'report.wht_report': { en: 'WHT Report', th: 'รายงานภาษีหัก ณ ที่จ่าย' },
    'report.total_sales': { en: 'Total Sales', th: 'ยอดขายรวม' },
    'report.total_vat_output': { en: 'Total Output Tax', th: 'ภาษีขายรวม' },
    'report.total_purchase': { en: 'Total Purchase', th: 'ยอดซื้อรวม' },
    'report.total_vat_input': { en: 'Total Input Tax', th: 'ภาษีซื้อรวม' },
    'report.vat_payable': { en: 'VAT Payable (Payment)', th: 'ภาษีที่ต้องชำระ' },
    'report.vat_refundable': { en: 'VAT Refundable (Claim)', th: 'ภาษีที่ขอคืนได้ (เครดิตยกไป)' },
    'report.wht_rate': { en: 'Tax Rate', th: 'อัตราภาษี' },
    'report.base_amount': { en: 'Base Amount', th: 'ยอดก่อนภาษี' },
    'report.tax_amount': { en: 'Tax Amount', th: 'ยอดภาษี' },
    'report.no_data': { en: 'No data for this month', th: 'ไม่มีข้อมูลในเดือนนี้' },
    'report.print_export': { en: 'Print / Export PDF', th: 'พิมพ์ / ส่งออก PDF' },
}

interface LanguageContextType {
    language: Language
    setLanguage: (lang: Language) => void
    t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
    // Default to English or saved preference (could use localStorage)
    const [language, setLanguageState] = useState<Language>(() => {
        const saved = localStorage.getItem('app_lang')
        return (saved === 'th' || saved === 'en') ? saved : 'en'
    })

    const setLanguage = (lang: Language) => {
        setLanguageState(lang)
        localStorage.setItem('app_lang', lang)
    }

    const t = (key: string): string => {
        if (!dictionary[key]) return key
        return dictionary[key][language]
    }

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    )
}

export function useLanguage() {
    const context = useContext(LanguageContext)
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider')
    }
    return context
}
