import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Building2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

function formatApiError(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e?.msg || JSON.stringify(e)).filter(Boolean).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, name);
      navigate('/');
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-slate-900 flex items-center justify-center p-4" data-testid="register-page">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">PropFlow</span>
        </div>
        <div className="bg-white border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1" data-testid="register-heading">Create account</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-6">Start managing your real estate pipeline</p>
          {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-md mb-4" data-testid="register-error">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Full Name</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required data-testid="register-name-input" className="bg-white border-slate-300 dark:border-slate-600" />
            </div>
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required data-testid="register-email-input" className="bg-white border-slate-300 dark:border-slate-600" />
            </div>
            <div>
              <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} data-testid="register-password-input" className="bg-white border-slate-300 dark:border-slate-600" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-slate-900 text-white hover:bg-slate-800 font-medium" data-testid="register-submit-button">
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 text-center mt-4">
            Already have an account? <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 font-medium" data-testid="login-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
