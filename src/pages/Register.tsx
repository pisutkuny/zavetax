import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Register() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            alert("Passwords don't match")
            return
        }

        setLoading(true)
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            })

            if (error) throw error
            alert('Registration successful! Please check your email/login.')
            navigate('/login')
        } catch (error: any) {
            alert(error.message || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center p-6 bg-cover bg-center relative"
            style={{
                backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070&auto=format&fit=crop')`
            }}
        >

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-md">Join ZaveTax</h1>
                    <p className="text-blue-100 mt-2 font-medium text-lg drop-shadow-sm">Start your financial journey today</p>
                </div>

                <form
                    onSubmit={handleRegister}
                    className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/50"
                >
                    <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Create Account</h2>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-slate-700 ml-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-4 rounded-xl bg-white/50 border border-white/50 focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400"
                                placeholder="owner@restaurant.com"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-slate-700 ml-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-4 rounded-xl bg-white/50 border border-white/50 focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400"
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-slate-700 ml-1">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full p-4 rounded-xl bg-white/50 border border-white/50 focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-4 text-lg"
                        >
                            {loading ? 'Creating Account...' : 'Register'}
                        </button>
                    </div>

                    <div className="mt-8 text-center text-sm text-slate-600">
                        Already have an account?{' '}
                        <Link to="/login" className="text-blue-700 font-extrabold hover:text-blue-900 transition underline decoration-2 underline-offset-2">
                            Sign In here
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Register
