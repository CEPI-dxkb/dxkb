"use client";

import { createContext, useContext, useState } from "react";

type SelectionContextType = {
  selectedRows: any[];
  setSelectedRows: (rows: any[]) => void;
};

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedRows, setSelectedRows] = useState<any[]>([]);

  return (
    <SelectionContext.Provider value={{ selectedRows, setSelectedRows }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used within a SelectionProvider");
  }

  return context;
}
