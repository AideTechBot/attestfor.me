/** Minimal process.env declaration for SSR code paths in src/ */
declare const process: {
  env: {
    PORT: number;
  };
};

interface Window {
  __HAS_SESSION__?: boolean;
}
