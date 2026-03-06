import {
  Github,
  Globe,
  Instagram,
  Linkedin,
  Link,
  Package,
  Twitter,
} from "lucide-react";

interface ServiceIconProps {
  service: string;
  size?: number;
}

export function ServiceIcon({ service, size = 24 }: ServiceIconProps) {
  switch (service) {
    case "github":
      return <Github size={size} color="#e6edf3" aria-label="GitHub" />;

    case "twitter":
      return <Twitter size={size} color="#e7e9ea" aria-label="X (Twitter)" />;

    case "dns":
      return <Globe size={size} color="#e6edf3" aria-label="DNS" />;

    case "npm":
      return <Package size={size} color="#CB3837" aria-label="npm" />;

    case "linkedin":
      return <Linkedin size={size} color="#0A66C2" aria-label="LinkedIn" />;

    case "instagram":
      return <Instagram size={size} color="#E4405F" aria-label="Instagram" />;

    // No lucide equivalents — keep branded SVGs
    case "activitypub":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="#6364FF"
          aria-label="Mastodon"
        >
          <path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.547c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.668 1.977v6.218H4.823V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z" />
        </svg>
      );

    case "bsky":
      return (
        <svg
          viewBox="0 0 600 530"
          width={size}
          height={size}
          fill="#1185FE"
          aria-label="Bluesky"
        >
          <path d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0174-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z" />
        </svg>
      );

    case "tangled":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="#e6edf3"
          aria-label="Tangled"
        >
          <path d="M13.5 2C10.46 2 8 4.46 8 7.5c0 1.86.93 3.5 2.35 4.5H9c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5c0-1.86-.93-3.5-2.35-4.5H13c2.76 0 5-2.24 5-5s-2.24-5-5-5h.5z" />
        </svg>
      );

    default:
      return <Link size={size} color="#e6edf3" aria-label="Link" />;
  }
}
