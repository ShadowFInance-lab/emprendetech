import { MessageSquare } from 'lucide-react'
import EmployeeNotices from '@/components/sales/EmployeeNotices'
import EmployeeReminders from '@/components/sales/EmployeeReminders'
import TeamGroupChat from '@/components/team/TeamGroupChat'

/**
 * Sección de Mensajes (separada del POS): chat con el jefe, chat grupal del
 * equipo y los recordatorios/entregas asignados al empleado.
 */
export default function MensajesPage() {
  return (
    <div className="max-w-2xl space-y-4 pb-28">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <MessageSquare size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">Mensajes</h1>
          <p className="text-gray-500 text-sm">Chat con tu jefe, el equipo y tus entregas asignadas</p>
        </div>
      </div>
      <EmployeeReminders />
      <EmployeeNotices />
      <TeamGroupChat />
    </div>
  )
}
