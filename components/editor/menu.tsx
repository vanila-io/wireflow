"use client";

// A small menu in production's style (Radix DropdownMenu, Tailwind tokens):
// Export image in the toolbar, and the More menu that keeps the header's
// buttons reachable on phones.
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

export type MenuItem = { label: string; onSelect: () => void; icon?: ReactNode; disabled?: boolean };

export default function Menu({
  trigger,
  items,
  side = "top",
  align = "center",
}: {
  /** The trigger button; it gets the menu's aria attributes and handlers. */
  trigger: ReactNode;
  items: MenuItem[];
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
}) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={8}
          className="z-50 min-w-40 rounded-lg bg-white p-1 shadow-[0_8px_30px_rgba(29,28,40,0.15)] ring-1 ring-wire-border"
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-ink outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-wire-canvas data-[highlighted]:text-wire-blue"
            >
              {item.icon}
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
