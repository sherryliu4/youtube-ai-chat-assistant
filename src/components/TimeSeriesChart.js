import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const CHART_COLOR = '#818cf8'; // indigo-400

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div style={{
      background: 'rgba(15, 15, 35, 0.95)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 8,
      padding: '0.75rem',
      fontSize: '0.85rem',
      color: '#f1f5f9',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      maxWidth: '250px'
    }}>
      <p style={{ margin: '0 0 0.25rem', fontWeight: 600, color: '#fff' }}>
        {new Date(label).toLocaleDateString()}
      </p>
      <p style={{ margin: '0 0 0.5rem', color: CHART_COLOR, fontWeight: 700 }}>
        {payload[0].name}: {payload[0].value.toLocaleString()}
      </p>
      {point.title && (
        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.8, fontStyle: 'italic', lineHeight: '1.3' }}>
          "{point.title}"
        </p>
      )}
    </div>
  );
}

export default function TimeSeriesChart({ data, field }) {
  if (!data?.length) return null;

  const handleDownload = () => {
    // Simple CSV export
    const headers = ['date', field, 'title'];
    const csvContent = [
      headers.join(','),
      ...data.map(row => `"${row.date}",${row.value},"${(row.title || '').replace(/"/g, '""')}"`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${field}_vs_time.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="engagement-chart-wrap" style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <p className="engagement-chart-label" style={{ margin: 0 }}>
          {field} vs Time
        </p>
        <button 
          onClick={handleDownload}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: 4,
            color: '#cbd5e1',
            padding: '0.25rem 0.6rem',
            fontSize: '0.75rem',
            cursor: 'pointer'
          }}
        >
          Download CSV
        </button>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={50}
            tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="value"
            name={field}
            stroke={CHART_COLOR}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLOR, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
