'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { DailySalesPoint } from '@/lib/actions/dashboard'
import { formatCurrency } from '@/lib/utils/format'

interface Props {
  data: DailySalesPoint[]
  color?: string
}

export default function SalesChart({ data, color = '#2563EB' }: Props) {
  const hasData = data.some(d => d.total > 0)

  if (!hasData) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-gray-300">
        <p className="text-4xl mb-2">📊</p>
        <p className="text-sm text-gray-400">
          Aún no hay ventas en los últimos 30 días
        </p>
        <p className="text-xs text-gray-300 mt-1">
          La gráfica aparecerá cuando registres ventas
        </p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={30}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
          width={45}
        />
        <Tooltip
          formatter={((value: number) => [formatCurrency(value), 'Ventas']) as never}
          labelFormatter={(label) => `Día: ${label}`}
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            fontSize: '13px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke={color}
          strokeWidth={2.5}
          fill="url(#salesGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
