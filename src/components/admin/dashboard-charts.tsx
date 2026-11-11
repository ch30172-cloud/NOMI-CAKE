"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { agorotToIls } from "@/lib/pricing/money";

interface Props {
  monthlySales: { month: string; ordered_agorot: number; orders: number }[];
  monthlyReceived: { month: string; received_agorot: number }[];
  pickup: number;
  delivery: number;
}

export function DashboardCharts({ monthlySales, monthlyReceived, pickup, delivery }: Props) {
  const months = Array.from(new Set([...monthlySales.map((m) => m.month), ...monthlyReceived.map((m) => m.month)])).sort();
  const data = months.map((month) => ({
    month,
    הזמנות: agorotToIls(monthlySales.find((m) => m.month === month)?.ordered_agorot ?? 0),
    התקבל: agorotToIls(monthlyReceived.find((m) => m.month === month)?.received_agorot ?? 0),
  }));
  const split = [
    { name: "איסוף עצמי", value: pickup },
    { name: "משלוח", value: delivery },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">מכירות חודשיות (₪) – סכום הזמנות מול תשלומים שהתקבלו</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין עדיין נתוני מכירות.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} width={60} />
                <Tooltip formatter={(v) => `₪${Number(v ?? 0).toLocaleString("he-IL")}`} />
                <Legend />
                <Bar dataKey="הזמנות" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="התקבל" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">איסוף עצמי מול משלוחים</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {pickup + delivery === 0 ? (
            <p className="text-sm text-muted-foreground">אין עדיין הזמנות.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={split} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  <Cell fill="var(--chart-1)" />
                  <Cell fill="var(--chart-2)" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
