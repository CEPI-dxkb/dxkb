"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface CitationChartProps {
  data: {
    year: number;
    count: number;
  }[];
}

export function CitationChart({ data }: CitationChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="year" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="var(--primary)" />
      </BarChart>
    </ResponsiveContainer>
  );
} 