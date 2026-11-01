import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PrefsProvider } from './context/PrefsContext'
import { ToastProvider } from './components/Toast'
import { Spinner } from './components/ui'
import Layout from './components/Layout'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Finance from './pages/Finance'
import Payments from './pages/Payments'
import Calculators from './pages/Calculators'
import Savings from './pages/Savings'
import SettingsPage from './pages/Settings'

function Protected() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <PrefsProvider>
            <Routes>
              <Route path="/login" element={<Auth />} />
              <Route element={<Protected />}>
                <Route element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="tasks" element={<Tasks />} />
                  <Route path="finance" element={<Finance />} />
                  <Route path="payments" element={<Payments />} />
                  <Route path="calculators" element={<Calculators />} />
                  <Route path="savings" element={<Savings />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PrefsProvider>
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  )
}
