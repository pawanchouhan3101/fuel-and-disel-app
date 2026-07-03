import React from 'react';
import { FuelEntry, Vehicle } from '../types';

interface SVGChartsProps {
  entries: FuelEntry[];
  vehicles: Vehicle[];
}

export default function SVGCharts({ entries, vehicles }: SVGChartsProps) {
  // 1. Group by Month (last 6 months or all months)
  const monthlyData: { [key: string]: { litres: number; amount: number; km: number; count: number } } = {};
  
  // Sort entries chronologically to compute trends
  const chronoEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  chronoEntries.forEach(e => {
    const month = e.date.substring(0, 7); // YYYY-MM
    if (!monthlyData[month]) {
      monthlyData[month] = { litres: 0, amount: 0, km: 0, count: 0 };
    }
    monthlyData[month].litres += e.dieselLitres;
    monthlyData[month].amount += e.dieselAmount;
    monthlyData[month].km += e.totalKm;
    monthlyData[month].count += 1;
  });

  const months = Object.keys(monthlyData).sort().slice(-6); // Last 6 months
  const maxLitres = Math.max(...months.map(m => monthlyData[m].litres), 100);
  const maxKms = Math.max(...months.map(m => monthlyData[m].km), 500);

  // 2. Group by Vehicle
  const vehicleData: { [key: string]: { litres: number; amount: number; name: string } } = {};
  entries.forEach(e => {
    const v = vehicles.find(veh => veh.id === e.vehicleId);
    const label = v ? v.vehicleNumber : 'Deleted';
    if (!vehicleData[label]) {
      vehicleData[label] = { litres: 0, amount: 0, name: v ? v.vehicleName : '' };
    }
    vehicleData[label].litres += e.dieselLitres;
    vehicleData[label].amount += e.dieselAmount;
  });

  const topVehicles = Object.keys(vehicleData)
    .map(key => ({ number: key, ...vehicleData[key] }))
    .sort((a, b) => b.litres - a.litres)
    .slice(0, 5); // Top 5 vehicles

  const maxVehicleLitres = Math.max(...topVehicles.map(v => v.litres), 10);

  // 3. Render Empty State if no entries
  if (entries.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-8 text-center text-zinc-500 dark:text-zinc-400">
        <p className="text-base font-medium">No analytical data available</p>
        <p className="text-xs mt-1">Submit fuel entries to view performance charts.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Monthly Trends Chart (SVG Line & Area) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Monthly Consumption Trend</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Total Diesel Litres filled per month</p>
        </div>

        <div className="relative h-64 mt-6 w-full">
          {months.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
              No monthly logs
            </div>
          ) : (
            <div className="w-full h-full flex flex-col justify-between">
              {/* Grid with SVG graph */}
              <div className="relative flex-1">
                {/* SVG Graph */}
                <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0" y1="50" x2="500" y2="50" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="4" className="dark:stroke-zinc-800" />
                  <line x1="0" y1="100" x2="500" y2="100" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="4" className="dark:stroke-zinc-800" />
                  <line x1="0" y1="150" x2="500" y2="150" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="4" className="dark:stroke-zinc-800" />
                  <line x1="0" y1="200" x2="500" y2="200" stroke="#e4e4e7" strokeWidth="1" className="dark:stroke-zinc-800" />

                  {/* Polyline Path */}
                  {(() => {
                    const points = months.map((m, idx) => {
                      const x = (idx / (months.length - 1)) * 480 + 10;
                      const y = 200 - (monthlyData[m].litres / maxLitres) * 160 - 20;
                      return { x, y, val: monthlyData[m].litres, m };
                    });

                    const pathString = points.map(p => `${p.x},${p.y}`).join(' L ');
                    const areaString = `${points[0].x},200 L ${pathString} L ${points[points.length - 1].x},200 Z`;

                    return (
                      <>
                        {/* Area Fill */}
                        <path
                          d={`M ${areaString}`}
                          fill="url(#indigoGrad)"
                          opacity="0.15"
                        />
                        {/* Line Path */}
                        <path
                          d={`M ${pathString}`}
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Data circles & hover highlights */}
                        {points.map((p, i) => (
                          <g key={i} className="group cursor-pointer">
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="5"
                              fill="#6366f1"
                              stroke="#ffffff"
                              strokeWidth="2"
                              className="transition-all duration-200 group-hover:r-7"
                            />
                            {/* Value text above */}
                            <text
                              x={p.x}
                              y={p.y - 10}
                              textAnchor="middle"
                              className="text-[10px] font-mono font-medium fill-indigo-600 dark:fill-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            >
                              {p.val.toFixed(0)}L
                            </text>
                          </g>
                        ))}
                        {/* Gradients */}
                        <defs>
                          <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* Month Labels */}
              <div className="flex justify-between px-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                {months.map((m, idx) => {
                  const dateObj = new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1);
                  const shortName = dateObj.toLocaleString('en-US', { month: 'short' });
                  return (
                    <div key={idx} className="text-center">
                      <p className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">{shortName}</p>
                      <p className="text-[9px] font-mono text-zinc-400">{m.split('-')[0]}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Top Vehicles Chart (Horizontal Bar Chart) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Top Fuel Consuming Vehicles</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Top vehicles ranked by total litres filled</p>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-4 mt-6">
          {topVehicles.length === 0 ? (
            <div className="text-center text-sm text-zinc-400 py-12">No data recorded</div>
          ) : (
            topVehicles.map((v, index) => {
              const pct = (v.litres / maxVehicleLitres) * 100;
              return (
                <div key={v.number} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800 font-semibold text-[10px] text-zinc-500">
                        #{index + 1}
                      </span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{v.number}</span>
                      <span className="text-zinc-400 text-[10px] truncate max-w-[120px]">{v.name}</span>
                    </div>
                    <div className="font-mono text-right">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{v.litres.toLocaleString()} L</span>
                      <span className="text-[10px] text-zinc-400 ml-2">(₹{v.amount.toLocaleString()})</span>
                    </div>
                  </div>

                  {/* Horizontal visual bar */}
                  <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-1000"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
