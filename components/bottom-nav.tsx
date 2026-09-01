"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/ask", label: "Hỏi", icon: "?" },
  { href: "/knowledge", label: "Tri thức", icon: "*" },
  { href: "/sources", label: "Nguồn", icon: "=" },
  { href: "/add", label: "+", icon: "+" }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-mist/95 px-2 pt-2 backdrop-blur">
      <div className="mx-auto grid max-w-xl grid-cols-4 gap-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex h-14 flex-col items-center justify-center rounded-md text-xs font-semibold transition",
                active ? "bg-ink text-white" : "text-ink/70 hover:bg-moss"
              ].join(" ")}
              aria-current={active ? "page" : undefined}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="mt-1 max-w-full truncate px-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
