import { useState, useCallback } from "react";

export function AvatarWithShimmer({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  // Use a callback ref to check if the image is already complete (e.g. cached
  // by the browser or loaded during SSR) — onLoad won't fire in that case.
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) {
      setLoaded(true);
    }
  }, []);

  return (
    <div className="relative w-30 h-30">
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 animate-pulse shadow-lg shadow-accent-subtle" />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        fetchPriority="high"
        className={`w-30 h-30 object-cover shadow-lg shadow-accent-subtle transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
