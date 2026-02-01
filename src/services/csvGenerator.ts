import type { Transaction } from './transactionService'

export const convertToCSV = (transactions: Transaction[]): string => {
    // CSV Header
    const headers = [
        'Date',
        'Type',
        'Category',
        'Description',
        'Amount',
        'Tax Type',
        'WHT Rate',
        'Receipt URL'
    ]

    // CSV Rows
    const rows = transactions.map(tx => {
        const date = tx.date
        const type = tx.type === 'income' ? 'Income' : 'Expense'
        // Escape quotes in description to prevent CSV breaking
        const description = `"${(tx.note || '').replace(/"/g, '""')}"`
        const amount = tx.amount
        const taxType = tx.tax_type || (tx.tax_invoice ? 'VAT Claim' : 'No VAT')
        const wht = tx.wht_rate ? `${tx.wht_rate}%` : '-'
        const receipt = tx.receipt_url || ''

        return [date, type, tx.category, description, amount, taxType, wht, receipt].join(',')
    })

    // Combine with BOM for Excel UTF-8 support
    return '\uFEFF' + [headers.join(','), ...rows].join('\n')
}

export const downloadCSV = (csvContent: string, fileName: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}
