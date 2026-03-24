import * as React from "react";

interface LinkedInIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
  title?: string;
}

const defaultColor = "#0A66C2";

const LinkedInIcon = React.forwardRef<SVGSVGElement, LinkedInIconProps>(
  function LinkedInIcon({ title = "LinkedIn", color = "currentColor", size = 24, ...props }, ref) {
    if (color === "default") {
      color = defaultColor;
    }
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        fill={color}
        viewBox="1 3 20 18"
        ref={ref}
        {...props}
      >
        <title>{title}</title>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z" />
      </svg>
    );
  }
);

export default LinkedInIcon;
