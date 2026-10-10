import { Bot, FolderDown, Globe, Group } from "lucide-react";
import { categoryLabels, graphics } from "@/lib/graphics";
import GraphicsCycle from "./anim/graphics-cycle";
import PlayWhenVisible from "./anim/play-when-visible";
import UndoRedo from "./anim/undo-redo";
import { container, sectionTitle } from "./ui";

// Only what the editor does today, each claim backed by shipped code: the
// templates and their search (lib/graphics.json, #118, #128); connection
// labels, colours and styles, undo/redo, Open file, image export, groups and
// the AI assistant (#118, #127); notes, estimates and your own image (#119),
// the estimate's CSV export (#126); offline (#110) and touch. The counts come
// from the template list, so they can't go stale. The first two features get
// a large card with an animation, the other four a row of icons.
export const templatesFeature = {
  title: `${graphics.length} screen templates`,
  text: `Ready-made wireframe screens in ${categoryLabels.length} categories, from sign-in and checkout to mobile apps and decision steps. Search them, or drop in your own image.`,
};
const interfaceFeature = {
  title: "Easy to use interface",
  text: "Drag screens onto the canvas, connect them, then label, colour and style the arrows. Undo, redo, copy and paste work as you'd expect.",
};
export const moreFeatures = [
  {
    title: "AI assistant",
    text: "Describe a flow or a change and Claude builds it on the canvas, with your own Anthropic API key.",
    Icon: Bot,
  },
  {
    title: "Save, open and export",
    text: "Your flow autosaves in the browser. Save it as a file, open it anywhere, or export a PNG or JPG image.",
    Icon: FolderDown,
  },
  {
    title: "Groups, notes and estimates",
    text: "Group related screens, add notes, and estimate hours and costs, with a CSV export.",
    Icon: Group,
  },
  {
    title: "No Photoshop required",
    text: "No install and no previous experience needed. It runs in your browser, works offline once loaded, and on touch screens.",
    Icon: Globe,
  },
];

function LargeCard({
  title,
  text,
  testId,
  children,
}: {
  title: string;
  text: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-[20px] border border-wire-border bg-white">
      {/* The card's text says what the animation shows, so the animation is hidden from screen readers. */}
      <PlayWhenVisible testId={testId} className="h-56 bg-wire-canvas/70 sm:h-64">
        {children}
      </PlayWhenVisible>
      <div className="p-6 sm:p-7">
        <h3 className="text-[17px] font-medium tracking-[-0.01em] text-ink">{title}</h3>
        <p className="mt-2 text-[15px] leading-6 text-ink-soft">{text}</p>
      </div>
    </article>
  );
}

export default function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="py-16 sm:py-24">
      <div className={container}>
        <h2 id="features-title" className={`${sectionTitle} max-w-[16ch]`}>
          Everything you need to map a flow
        </h2>
        <div className="mt-10 grid gap-4 sm:mt-12 md:grid-cols-2">
          <LargeCard {...templatesFeature} testId="templates-animation">
            <GraphicsCycle />
          </LargeCard>
          <LargeCard {...interfaceFeature} testId="interface-animation">
            <UndoRedo />
          </LargeCard>
        </div>
        <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {moreFeatures.map(({ title, text, Icon }) => (
            <li key={title}>
              <h3 className="flex items-center gap-2.5 text-[15px] font-medium text-ink">
                <Icon size={18} strokeWidth={1.9} className="text-wire-blue" aria-hidden />
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
