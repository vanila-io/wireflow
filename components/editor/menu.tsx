"use client";

// A small menu in production's style (Radix DropdownMenu, Tailwind tokens):
// Export image and More in the toolbar, and the More menu that keeps the
// header's buttons reachable on phones.
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

export type MenuItem = {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  /** A mode that is on or off (a checkbox item). */
  checked?: boolean;
  /** A line above this item. */
  separated?: boolean;
};

const itemClass =
  "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-ink outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-wire-canvas data-[highlighted]:text-wire-blue";

export default function Menu({
  trigger,
  items,
  label,
  side = "top",
  align = "center",
}: {
  /** The trigger button; it gets the menu's aria attributes and handlers. */
  trigger: ReactNode;
  items: MenuItem[];
  /** The menu's accessible name. */
  label?: string;
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
          aria-label={label}
          className="z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-44 overflow-y-auto rounded-lg bg-white p-1 shadow-[0_8px_30px_rgba(29,28,40,0.15)] ring-1 ring-wire-border"
        >
          {items.map((item) => (
            <div key={item.label}>
              {item.separated && <DropdownMenu.Separator className="my-1 h-px bg-wire-border" />}
              {item.checked === undefined ? (
                <DropdownMenu.Item disabled={item.disabled} onSelect={item.onSelect} className={itemClass}>
                  {item.icon}
                  {item.label}
                </DropdownMenu.Item>
              ) : (
                <DropdownMenu.CheckboxItem
                  checked={item.checked}
                  disabled={item.disabled}
                  onSelect={item.onSelect}
                  className={itemClass}
                >
                  {item.icon}
                  {item.label}
                  <span className="ml-auto text-[10px] uppercase text-ink-soft">{item.checked ? "On" : "Off"}</span>
                </DropdownMenu.CheckboxItem>
              )}
            </div>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
