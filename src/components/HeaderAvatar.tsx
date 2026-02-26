import { useState, useCallback } from "react";

export function HeaderAvatar({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) {
      setLoaded(true);
    }
  }, []);

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 animate-pulse" />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        fetchPriority="high"
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}
