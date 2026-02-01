export const calculateVAT = (amount: number, taxType: 'vat_inc' | 'vat_exc' | 'no_vat') => {
    if (taxType === 'no_vat') return 0

    // VAT Included: Price = Base + VAT (Base * 0.07) -> Price = Base * 1.07 -> VAT = Price * 7 / 107
    if (taxType === 'vat_inc') {
        return (amount * 7) / 107
    }

    // VAT Excluded: VAT = Base * 0.07
    if (taxType === 'vat_exc') {
        return amount * 0.07
    }

    return 0
}

export const calculateWHT = (amount: number, rate: number) => {
    if (!rate) return 0
    return amount * (rate / 100)
}
