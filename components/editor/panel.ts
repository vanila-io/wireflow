// The look and place of the panels for a selected card, note, group or
// connection: production's shortcuts-panel card, top right of the canvas. On a
// phone the canvas beside the templates panel is too narrow for it, so it is a
// sheet across the screen just above the toolbar instead, at most 45% of the
// screen tall (it scrolls if needed), which leaves the top of the canvas free
// to see the selection and to tap away from it.
export const PANEL_CLASS =
  "absolute right-4 top-4 z-10 max-h-[calc(100%-2rem)] w-60 max-w-[calc(100%-2rem)] overflow-y-auto rounded-xl bg-white p-4 shadow-lg ring-1 ring-wire-border max-sm:fixed max-sm:inset-x-2 max-sm:top-auto max-sm:bottom-[72px] max-sm:max-h-[45dvh] max-sm:w-auto max-sm:max-w-none";
