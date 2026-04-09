"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { getLogoPath, type LogoVariant } from "@/styles/logo-utils";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMounted } from "@/hooks/use-is-mounted";

interface LogoProps {
  variant?: LogoVariant;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
}

export function Logo({
  variant = "logo-white",
  width = 100,
  height = 40,
  className,
  priority = false,
  alt = "Logo",
}: LogoProps) {
  const mounted = useIsMounted();
  const { theme } = useTheme();

  // During SSR and initial render, always use the default theme
  // This prevents hydration mismatch
  const currentTheme = mounted ? theme : "dxkb-light";
  const logoPath = getLogoPath(currentTheme || "dxkb-light", variant);

  if (!mounted) {
    return (
      <Skeleton className="h-10 w-36" aria-label="Logo loading" />
    );
  }

  return (
    <Image
      src={logoPath}
      alt={alt}
      width={width}
      height={height}
      className={cn(
        "shrink-0 grow-0 object-contain h-auto w-auto",
        className
      )}
      priority={priority}
    />
  );
}

export default Logo;