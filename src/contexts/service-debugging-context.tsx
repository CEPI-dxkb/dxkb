"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface ServiceDebuggingContextType {
  isDebugMode: boolean;
  containerBuildId: string;
  setIsDebugMode: (value: boolean) => void;
  setContainerBuildId: (value: string) => void;
}

const ServiceDebuggingContext = createContext<ServiceDebuggingContextType | undefined>(undefined);

interface ServiceDebuggingProviderProps {
  children: ReactNode;
}

export function ServiceDebuggingProvider({ children }: ServiceDebuggingProviderProps) {
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [containerBuildId, setContainerBuildId] = useState("");

  return (
    <ServiceDebuggingContext.Provider
      value={{
        isDebugMode,
        containerBuildId,
        setIsDebugMode,
        setContainerBuildId,
      }}
    >
      {children}
    </ServiceDebuggingContext.Provider>
  );
}

export function useServiceDebugging() {
  const context = useContext(ServiceDebuggingContext);
  if (context === undefined) {
    throw new Error("useServiceDebugging must be used within a ServiceDebuggingProvider");
  }
  return context;
}

