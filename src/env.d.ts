/** Minimal process.env declaration for SSR code paths in src/ */
declare const process: {
  env: {
    PORT: number;
  };
};
