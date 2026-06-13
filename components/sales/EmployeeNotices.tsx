'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { getEmployeeNotificationsAction, markEmployeeNotificationRead, type EmployeeNotice } from '@/lib/actions/employees'

/**
 * Banner de notificaciones que el jefe envió al empleado.
 * Para dueños no muestra nada (no tienen notificaciones de empleado).
 */
export default function EmployeeNotices() {
  const [items, setItems] = useState<EmployeeNotice[]>([])

  useEffect(() => {
    let active = true
    const load = async () => {
      const n = await getEmployeeNotificationsAction()
      if (active) setItems(n)
    }
    load()
    const t = setInterval(load, 60000)
    return () => { active = false; clearInterval(t) }
  }, [])

  async function dismiss(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await markEmployeeNotificationRead(id)
  }

  if (items.length === 0) return null

  return (
    <div className="space-y-2">
      {items.map(n => (
        <div key={n.id} className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <Bell size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="flex-1 text-sm text-blue-900">{n.message}</p>
          <button onClick={() => dismiss(n.id)} className="text-blue-400 hover:text-blue-700"><X size={15} /></button>
        </div>
      ))}
    </div>
  )
}
