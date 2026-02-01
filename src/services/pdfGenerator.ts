import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency } from '../utils/format'

// Font URL (Sarabun Regular from Google Fonts)
const FONT_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf'

// Helper to load font
const loadThaiFont = async (doc: jsPDF) => {
    try {
        const response = await fetch(FONT_URL)
        const buffer = await response.arrayBuffer()

        // Convert array buffer to base64
        let binary = ''
        const bytes = new Uint8Array(buffer)
        const len = bytes.byteLength
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i])
        }
        const base64 = window.btoa(binary)

        // Add font
        doc.addFileToVFS('Sarabun-Regular.ttf', base64)
        doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal')
        doc.setFont('Sarabun')
    } catch (error) {
        console.error("Failed to load Thai font:", error)
        // Fallback
        doc.setFont('helvetica')
    }
}

export const generateTaxReportPDF = async (year: number, data: any, profile: any) => {
    // 1. Init Doc (A4)
    const doc = new jsPDF()

    // 2. Load Font
    await loadThaiFont(doc)

    // 3. Header
    doc.setFontSize(20)
    doc.text(`รายงานภาษีเงินได้บุคคลธรรมดา (P.N.D. 90) ปี ${year}`, 105, 20, { align: 'center' })

    doc.setFontSize(14)
    doc.text(`ร้าน: ${profile?.restaurant_name || '-'}`, 14, 35)
    doc.text(`เลขประจำตัวผู้เสียภาษี: ${profile?.tax_id || '-'}`, 14, 43)
    doc.text(`พิมพ์วันที่: ${new Date().toLocaleDateString('th-TH')}`, 140, 35)

    // 4. Content Table
    const tableBody = [
        ['1. รายได้พึงประเมิน (Total Income)', formatCurrency(data.totalIncome)],
        ['2. หักค่าใช้จ่าย (Expenses)', formatCurrency(data.totalExpenses)],
        ['3. เงินได้หลังหักค่าใช้จ่าย', formatCurrency(data.netIncome)],
        ['4. หักค่าลดหย่อน (Deductions)', formatCurrency(data.totalDeductions)],
        ['   - ส่วนตัว', formatCurrency(data.deductions?.personal_allowance || 0)],
        ['   - คู่สมรส/บุตร/บิดามารดา', formatCurrency((data.deductions?.spouse_allowance || 0) + (data.deductions?.child_allowance || 0) + (data.deductions?.parent_allowance || 0))],
        ['   - ประกันสังคม/ชีวิต/สุขภาพ', formatCurrency((data.deductions?.social_security || 0) + (data.deductions?.life_insurance || 0) + (data.deductions?.health_insurance || 0))],
        ['   - กองทุน (RMF/SSF/PVD)', formatCurrency(data.deductions?.pvd_rmf_ssf || 0)],
        ['5. เงินได้สุทธิ (Net Taxable Income)', formatCurrency(data.netTaxableIncome)],
        ['6. ภาษีที่ต้องชำระ (Tax Payable)', formatCurrency(data.taxPayable)]
    ]

    autoTable(doc, {
        startY: 55,
        head: [['รายการ (Description)', 'จำนวนเงิน (Amount)']],
        body: tableBody,
        styles: {
            font: 'Sarabun',
            fontSize: 12,
            cellPadding: 6
        },
        headStyles: {
            fillColor: [41, 128, 185], // Brand Blue
            textColor: 255,
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 50, halign: 'right' }
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        }
    })

    // 5. Summary Footer
    const finalY = (doc as any).lastAutoTable.finalY + 20

    doc.setFillColor(255, 241, 242) // Red-50
    doc.setDrawColor(254, 202, 202) // Red-200
    doc.roundedRect(14, finalY, 182, 40, 3, 3, 'FD')

    doc.setFontSize(16)
    doc.setTextColor(185, 28, 28) // Red-700
    doc.text('สรุปยอดภาษีที่ต้องชำระ', 105, finalY + 15, { align: 'center' })

    doc.setFontSize(24)
    doc.setFont('Sarabun', 'bold')
    doc.text(formatCurrency(data.taxPayable), 105, finalY + 30, { align: 'center' })

    // 6. Signature
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text('ลงชื่อ ผู้ยื่นแบบ ...........................................................', 105, 280, { align: 'center' })

    // Save
    doc.save(`tax-report-${year}.pdf`)
}
