import { Routes, Route } from 'react-router-dom'
import RescueHome from './pages/RescueHome'
import VictimEmergency from './pages/VictimEmergency'
import VictimLogin from './pages/VictimLogin'
import VictimRegister from './pages/VictimRegister'
import VictimDashboard from './pages/VictimDashboard'
import VictimEmergencyContacts from './pages/VictimEmergencyContacts'
import NgoLogin from './pages/NgoLogin'
import NgoRegister from './pages/NgoRegister'
import NgoDashboard from './pages/NgoDashboard'
import AdminLogin from './pages/AdminLogin'
import AdminRegister from './pages/AdminRegister'
import AdminDashboard from './pages/AdminDashboard'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<RescueHome />} />
          <Route path="/victim/emergency" element={<VictimEmergency />} />
          <Route path="/victim/login" element={<VictimLogin />} />
          <Route path="/victim/register" element={<VictimRegister />} />
          <Route path="/victim/dashboard" element={<VictimDashboard />} />
          <Route path="/victim/contacts" element={<VictimEmergencyContacts />} />
          <Route path="/ngo/login" element={<NgoLogin />} />
          <Route path="/ngo/register" element={<NgoRegister />} />
          <Route path="/ngo/dashboard" element={<NgoDashboard />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/register" element={<AdminRegister />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-800 py-4 text-xs text-center opacity-70">
        RescueTech — Connecting people with help when every second matters.
      </footer>
    </div>
  )
}
