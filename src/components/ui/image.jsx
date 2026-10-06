import * as React from "react"

// Simplified replacement for Base44's Image component (which had built-in
// support for its Wix Media CDN). Images here come from Supabase Storage
// public URLs, so a plain <img> is all that's needed.
const Image = React.forwardRef(({ src, fittingType, originWidth, originHeight, focalPointX, focalPointY, quality, ...props }, ref) => {
  return <img ref={ref} src={src} {...props} />;
});
Image.displayName = "Image";

export { Image };
