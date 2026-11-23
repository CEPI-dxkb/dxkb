import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Shown in place of the Graph canvas when the browser cannot create a WebGL 2 context. It imports
 * nothing from Sigma, so it renders where Sigma's own modules cannot even load. `onReady` is never
 * called for it, which keeps the PNG export disabled.
 */
export function WebGl2Notice() {
  // Centered in the canvas box, clear of the truncation and layout column along its top; the
  // inner box sits above the "Laying out…" veil, which the layout query still shows meanwhile.
  return (
    <div className="flex size-full items-center justify-center p-6">
      <div className="relative z-20 w-full max-w-md">
        <Alert variant="destructive">
          <AlertTitle>The graph needs WebGL 2</AlertTitle>
          <AlertDescription>
            This browser or device does not support WebGL 2, which the Graph
            view requires. Use the Table view, or open this page in a current
            version of Chrome, Firefox, Safari or Edge.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
