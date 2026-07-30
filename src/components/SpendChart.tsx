"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailySpend } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface SpendChartProps {
  data: DailySpend[];
}

export default function SpendChart({ data }: SpendChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-card border border-border p-8 text-center text-muted">
        Sem dados no período selecionado.
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(`${d.date}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
  }));

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <h3 className="font-semibold mb-4">Gasto x Conversões por dia</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formatted} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#2a2e3b" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#8b90a0" fontSize={12} tickLine={false} />
            <YAxis
              yAxisId="custo"
              stroke="#8b90a0"
              fontSize={12}
              tickLine={false}
              tickFormatter={(v: number) => `R$${v}`}
            />
            <YAxis yAxisId="conversoes" orientation="right" stroke="#8b90a0" fontSize={12} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1d27",
                border: "1px solid #2a2e3b",
                borderRadius: "8px",
                color: "#e6e8ee",
              }}
              formatter={(value, name) =>
                name === "Gasto" ? formatCurrency(Number(value)) : value
              }
            />
            <Legend />
            <Line
              yAxisId="custo"
              type="monotone"
              dataKey="custo"
              name="Gasto"
              stroke="#4f6ef7"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="conversoes"
              type="monotone"
              dataKey="conversoes"
              name="Conversões"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
