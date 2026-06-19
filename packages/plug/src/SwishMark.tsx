import React from "react";

/**
 * The Swish "swish" mark, stroked with currentColor so it inherits the
 * button's text color. Inlined (not fetched) so the SDK has no asset/network
 * dependency for its own branding.
 */
export function SwishMark({ size = 16 }: { size?: number }) {
  // viewBox 289x148 ~ 1.95:1
  const width = Math.round(size * (289 / 148));
  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 289 148"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M24.0052 24.0052L60.2824 96.5595C62.1139 100.223 66.9958 101.015 69.8916 98.1189L98.6645 69.346C101.395 66.6152 105.957 67.138 107.999 70.4157L139.349 120.73C141.713 124.524 147.247 124.493 149.569 120.673L180.038 70.5344C182.057 67.2105 186.657 66.6574 189.408 69.4077L218.119 98.1189C221.015 101.015 225.897 100.223 227.728 96.5595L264.005 24.0052"
        stroke="currentColor"
        strokeWidth={48}
        strokeMiterlimit="3.99393"
        strokeLinecap="round"
      />
    </svg>
  );
}
