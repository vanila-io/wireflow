import { Globe, Group, ImageDown, Maximize, MessageSquare, Minus, Plus, Redo2, ShieldCheck, Undo2, Users } from "lucide-react";
import { graphicById } from "@/lib/graphics";
import { container, sectionTitle } from "./ui";

// The six features, word for word as the page has always listed them. The
// first two get a large card with a picture; the other four a row of icons.
const graphicsFeature = {
  title: "100+ graphics to use",
  text: "Over 100 custom built graphics/cards which cover most web elements, interactions and usage cases.",
};
const interfaceFeature = {
  title: "Easy to use interface",
  text: "Simple, minimal and easy to use interface brings a good experience while you design.",
};
const more = [
  {
    title: "Real-time collaboration",
    text: "Invite your co-worker and together, in real time, design the user flow for your next project.",
    Icon: Users,
  },
  {
    title: "Project permissions",
    text: "Decide who has access to the project you are working on and whether it is public or private.",
    Icon: ShieldCheck,
  },
  {
    title: "Live chat",
    text: "Built-in live chat so you can talk with your teammate while you collaborate in real time.",
    Icon: MessageSquare,
  },
  {
    title: "No Photoshop required",
    text: "No install and no previous experience in any complicated software needed. It runs in your browser.",
    Icon: Globe,
  },
];

const src = (id: string) => graphicById(id)?.src ?? "";

// Real templates from the catalog, fanned out.
function TemplateFan() {
  const cards = [
    { id: "article-article-1", className: "left-[6%] top-[22%] -rotate-6" },
    { id: "e-commerce-products-1", className: "left-[30%] top-[12%] z-10" },
    { id: "header-header-1", className: "left-[54%] top-[22%] rotate-6" },
  ];
  return (
    <div className="relative h-full w-full" aria-hidden>
      {cards.map((c) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={c.id}
          src={src(c.id)}
          alt=""
          width={220}
          height={173}
          loading="lazy"
          className={`absolute w-[40%] rounded-lg bg-white shadow-[0_18px_40px_-18px_rgba(27,26,31,0.45)] ring-1 ring-black/5 ${c.className}`}
        />
      ))}
    </div>
  );
}

// Two cards, a connection and the editor's toolbar icons.
function InterfaceSketch() {
  const tools = [Undo2, Redo2, Minus, Plus, Maximize, Group, ImageDown];
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6" aria-hidden>
      <div className="flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src("sign-in-sign-in-1")} alt="" width={220} height={173} loading="lazy" className="w-28 rounded-lg bg-white shadow-md ring-1 ring-black/5 sm:w-32" />
        <svg width="64" height="16" viewBox="0 0 64 16" className="mx-1 text-wire-blue">
          <path d="M2 8h56M52 3l6 5-6 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src("e-commerce-checkout")} alt="" width={220} height={173} loading="lazy" className="w-28 rounded-lg bg-white shadow-md ring-1 ring-black/5 sm:w-32" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl bg-white px-3 py-2 shadow-[0_12px_30px_-14px_rgba(27,26,31,0.35)] ring-1 ring-black/5">
        {tools.map((Icon, i) => (
          <span key={i} className="flex h-8 w-8 items-center justify-center text-ink/70">
            <Icon size={16} />
          </span>
        ))}
      </div>
    </div>
  );
}

function LargeCard({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-[20px] border border-wire-border bg-white">
      <div className="h-56 bg-wire-canvas/70 sm:h-64">{children}</div>
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
          <LargeCard {...graphicsFeature}>
            <TemplateFan />
          </LargeCard>
          <LargeCard {...interfaceFeature}>
            <InterfaceSketch />
          </LargeCard>
        </div>
        <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {more.map(({ title, text, Icon }) => (
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
