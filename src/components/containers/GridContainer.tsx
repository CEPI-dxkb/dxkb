'use client';

import React, { useEffect, useState } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import '../../styles/gridContainer.css';

type WidgetData = {
  id: string;
  name: string;
  w?: number;
  h?: number;
  columns?: Record<string, string>; // e.g. { genome_name: "Genome", strain: "Strain" }
  data?: { fullData: { [key: string]: any }[] }[]; // e.g. [{ genome_name: "E. coli", strain: "K12" }]
  content?: React.ReactNode;
};

type GridContainerProps = {
  cols?: number;
  rowHeight?: number;
  width?: number;
  widgets: WidgetData[];
};

type SortState = {
  field: string;
  direction: "asc" | "desc";
};

export default function GridContainer({ widgets }: GridContainerProps) {
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [sortStates, setSortStates] = useState<{ [id: string]: SortState }>({});
  
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const rowHeight = 50;
  const totalRows = Math.floor(dimensions.height / rowHeight);
  const totalWidgets = widgets.length;

  // Divide height evenly among widgets
  const widgetHeight = Math.floor(totalRows / (totalWidgets || 1));

  const layout = widgets.map((widget, index) => ({
    i: widget.id,
    x: 0,
    y: index * widgetHeight,
    w: 12,
    h: widgetHeight,
  }));

  const handleHeaderClick = (widgetId: string, field: string) => {
    setSortStates((prev) => {
      const current = prev[widgetId];
      const direction =
        current?.field === field && current.direction === "asc" ? "desc" : "asc";
      return {
        ...prev,
        [widgetId]: { field, direction },
      };
    });
  };

  const getSortedData = (widget: Widget): { [key: string]: any }[] => {
    const rawData = widget.data?.[0]?.fullData || [];

    const sortState = sortStates[widget.id];
    if (!sortState) return rawData;

    const sorted = [...rawData].sort((a, b) => {
      const valA = a[sortState.field];
      const valB = b[sortState.field];
      if (valA === valB) return 0;
      if (valA === undefined) return 1;
      if (valB === undefined) return -1;
      return sortState.direction === "asc"
        ? valA > valB ? 1 : -1
        : valA < valB ? 1 : -1;
    });
    console.log('cols', widget.columns);
    console.log('sortState:', sortState);
    console.log('data:', sorted);

    return sorted;
  };
  
  return (
    <div className="h-screen w-90vw overflow-hidden pt-0">
      <GridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={rowHeight}
        width={dimensions.width}
        style={{ height: "100%" }}
        isDraggable={false}
        isResizable={false}
      >
        {widgets.map((widget) => {
          const sortedData = getSortedData(widget);
          const sortState = sortStates[widget.id];
          return (
          <div key={widget.id} className="bg-white px-4 pb-4 pt-0 overflow-auto">
            <table className="min-w-full text-sm outline">
              <thead className="sticky top-0 bg-gray-100 text-left z-10 pt-0">
              <tr>
                {Object.entries(widget.columns).map(([field, label]) => (
                  <th
                    key={field}
                    className="px-2 py-1 border border-gray-300 cursor-pointer select-none pt-0"
                    onClick={() => handleHeaderClick(widget.id, field)}
                  >
                    {label}
                    {sortState?.field === field && (
                      <span className="ml-1">
                        {sortState.direction === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
              </thead>
              <tbody>
              {sortedData.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {Object.keys(widget.columns).map((colKey, cellIdx) => (
                        <td key={cellIdx} className="px-2 py-1 border border-gray-300">
                          {row[colKey]}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        );
        })}
      </GridLayout>
    </div>
  );
}

