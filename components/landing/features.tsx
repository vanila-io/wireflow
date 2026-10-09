const features = [
  {
    title: "100+ graphics to use",
    text: "Over 100 custom built graphics/cards which cover most web elements, interactions and usage cases.",
    gradient: "from-violet-500 to-fuchsia-500",
    icon: (
      <path d="M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
    ),
  },
  {
    title: "Real-time collaboration",
    text: "Invite your co-worker and together, in real time, design the user flow for your next project.",
    gradient: "from-sky-500 to-blue-600",
    icon: (
      <path d="M8 11a3 3 0 100-6 3 3 0 000 6zM2 20c0-3.3 2.7-5 6-5s6 1.7 6 5M16 11a2.5 2.5 0 100-5M17 15c2.5.4 4 2 4 4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    ),
  },
  {
    title: "Project permissions",
    text: "Decide who has access to the project you are working on and whether it is public or private.",
    gradient: "from-rose-500 to-red-500",
    icon: (
      <path d="M12 3l8 3.5V12c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6.5L12 3zM9.5 12l2 2 3.5-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: "Live chat",
    text: "Built-in live chat so you can talk with your teammate while you collaborate in real time.",
    gradient: "from-emerald-500 to-teal-500",
    icon: (
      <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H9l-5 4V6z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
    ),
  },
  {
    title: "Easy to use interface",
    text: "Simple, minimal and easy to use interface brings a good experience while you design.",
    gradient: "from-amber-500 to-orange-500",
    icon: (
      <path d="M5 19l3.5-1 9.8-9.8a1.8 1.8 0 00-2.5-2.5L6 15.5 5 19zM14 7l3 3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: "No Photoshop required",
    text: "No install and no previous experience in any complicated software needed. It runs in your browser.",
    gradient: "from-indigo-500 to-purple-600",
    icon: (
      <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    ),
  },
];

export default function Features() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20">
      <div className="rounded-2xl bg-ink px-8 py-12 sm:px-14">
        <h2 className="mb-10 text-2xl font-bold text-white">
          Everything you need to map a flow
        </h2>
        <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="flex gap-4">
              <span
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${f.gradient} text-white shadow-md`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                  {f.icon}
                </svg>
              </span>
              <div>
                <h3 className="font-semibold text-white">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-white/60">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
