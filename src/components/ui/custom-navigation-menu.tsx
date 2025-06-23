"use client";

import React from "react";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from "@/components/ui/navigation-menu";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

interface CustomNavMenuProps {
  items: NavItem[];
  isCollapsed: boolean;
}

export function CustomNavMenu({ items, isCollapsed }: CustomNavMenuProps) {
  return (
    <NavigationMenu>
      <NavigationMenuList className="flex flex-col w-full space-y-1">
        {items.map((item, index) => (
          <NavigationMenuItem key={index} className="w-full">
            <NavigationMenuLink
              onClick={item.onClick}
              className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer ${
                item.isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              }`}
            >
              {item.icon}
              {!isCollapsed && <span>{item.label}</span>}
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}