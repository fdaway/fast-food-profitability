"use client";

import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = ["#ef4444", "#f5a623", "#3b82f6", "#a855f7", "#22c55e"];
const BORDER = "#131417";

export default function CostDonut({ data, foodColor }) {
  const colors = foodColor ? [foodColor, ...COLORS.slice(1)] : COLORS;
  const chartData = {
    labels: ["Food", "Labor", "Rent", "Ops", "Profit"],
    datasets: [
      {
        data: data || [0, 0, 0, 0, 0],
        backgroundColor: colors,
        borderColor: BORDER,
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };

  return (
    <Doughnut
      data={chartData}
      options={{
        cutout: "66%",
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              color: "#5a5e70",
              font: { family: "'DM Mono', monospace", size: 9 },
              boxWidth: 9,
              padding: 6,
            },
          },
          tooltip: {
            callbacks: {
              label: (c) => ` ${c.label}: ${c.parsed.toFixed(1)}%`,
            },
          },
        },
        animation: { duration: 250 },
      }}
    />
  );
}
