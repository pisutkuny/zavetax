export interface TaxDeductions {
    personal_allowance: number // 60,000
    spouse_allowance: number // 60,000 (if no income)
    child_allowance: number // 30,000 per child
    parent_allowance: number // 30,000 per parent
    social_security: number // Max 9,000
    life_insurance: number // Max 100,000
    health_insurance: number // Max 25,000 (Life + Health <= 100,000)
    pvd_rmf_ssf: number // Retirement funds (Max 500,000 total)
    donation: number // 2x for education/sport, 1x for others (Max 10% of net income)
    other: number
}

export const DEFAULT_DEDUCTIONS: TaxDeductions = {
    personal_allowance: 60000,
    spouse_allowance: 0,
    child_allowance: 0,
    parent_allowance: 0,
    social_security: 0,
    life_insurance: 0,
    health_insurance: 0,
    pvd_rmf_ssf: 0,
    donation: 0,
    other: 0
}

export const calculateTaxStep = (netIncome: number) => {
    let tax = 0

    // Tax Brackets (Thailand 2024)
    const brackets = [
        { limit: 150000, rate: 0 },
        { limit: 300000, rate: 0.05 }, // 150,001 - 300,000
        { limit: 500000, rate: 0.10 }, // 300,001 - 500,000
        { limit: 750000, rate: 0.15 }, // 500,001 - 750,000
        { limit: 1000000, rate: 0.20 }, // 750,001 - 1,000,000
        { limit: 2000000, rate: 0.25 }, // 1,000,001 - 2,000,000
        { limit: 5000000, rate: 0.30 }, // 2,000,001 - 5,000,000
        { limit: Infinity, rate: 0.35 } // > 5,000,000
    ]

    let previousLimit = 0

    for (const bracket of brackets) {
        if (netIncome <= previousLimit) break

        const taxableInBracket = Math.min(netIncome, bracket.limit) - previousLimit
        tax += taxableInBracket * bracket.rate

        previousLimit = bracket.limit
    }

    return tax
}

export const calculateNetTaxableIncome = (
    totalIncome: number,
    deductions: TaxDeductions,
    expenseType: 'actual' | 'standard',
    actualExpense: number
) => {
    // 1. Deduct Expenses (Standard 60% or Actual)
    // Note: Standard deduction for 40(8) is 60%
    const expenseAmount = expenseType === 'standard'
        ? totalIncome * 0.6
        : actualExpense

    const incomeAfterExpenses = Math.max(0, totalIncome - expenseAmount)

    // 2. Deduct Allowances
    let totalDeductions = 0
    totalDeductions += deductions.personal_allowance
    totalDeductions += deductions.spouse_allowance
    totalDeductions += deductions.child_allowance
    totalDeductions += deductions.parent_allowance
    totalDeductions += deductions.social_security

    // Life + Health Insurance logic (Max 100k combined)
    const life = Math.min(100000, deductions.life_insurance)
    const health = Math.min(25000, deductions.health_insurance)
    const insuranceTotal = Math.min(100000, life + health)
    totalDeductions += insuranceTotal

    totalDeductions += deductions.pvd_rmf_ssf
    totalDeductions += deductions.other

    const incomeAfterDeductions = Math.max(0, incomeAfterExpenses - totalDeductions)

    // 3. Deduct Donations (Max 10% of remaining)
    const maxDonation = incomeAfterDeductions * 0.1
    const allowableDonation = Math.min(deductions.donation, maxDonation)

    return Math.max(0, incomeAfterDeductions - allowableDonation)
}
