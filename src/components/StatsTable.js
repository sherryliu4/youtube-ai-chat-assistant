import React from 'react';

export default function StatsTable({ data }) {
  if (!data) return null;

  return (
    <div className="stats-table-container">
      <table className="stats-table">
        <thead>
          <tr>
            <th colSpan="2">Statistics for: {data.field}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Count</td>
            <td>{data.count}</td>
          </tr>
          <tr>
            <td>Mean</td>
            <td>{data.mean}</td>
          </tr>
          <tr>
            <td>Median</td>
            <td>{data.median}</td>
          </tr>
          <tr>
            <td>Std Dev</td>
            <td>{data.std}</td>
          </tr>
          <tr>
            <td>Min</td>
            <td>{data.min}</td>
          </tr>
          <tr>
            <td>Max</td>
            <td>{data.max}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
