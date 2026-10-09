// Landing page "/". Mechanically converted from the production RSC payload (server component tree),
// so markup, classes and copy are exact. Client references: Link (next/link), Image (next/image),
// GraphicsGallery (components/GraphicsGallery.tsx, production module 63180).
import Link from 'next/link';
import Image from 'next/image';
import GraphicsGallery from '@/components/GraphicsGallery';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="w-full border-b border-wire-border/60 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 ">
            <Image src="/wireflow-logo.png" alt="Wireflow logo" width={34} height={34} priority />
            <span className="leading-tight">
              <span className="block text-[17px] font-bold text-ink">Wireflow</span>
              <span className="block text-[11px] font-medium tracking-wide text-ink-soft">user flow designer tool</span>
            </span>
          </Link>
          <nav className="flex items-center gap-7 text-sm font-semibold text-ink">
            <a href="https://wireflow.co/blog/" className="hidden items-center gap-1.5 hover:text-wire-blue sm:flex">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Blog
            </a>
            <a href="https://github.com/vanila-io/wireflow" className="hidden items-center gap-1.5 hover:text-wire-blue sm:flex">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 3.01 1.25 3.74.96.11-.75.43-1.26.78-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 015.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.44.38.83 1.11.83 2.25 0 1.63-.01 2.94-.01 3.34 0 .31.21.68.8.56A10.52 10.52 0 0023.5 12C23.5 5.65 18.35.5 12 .5z" />
              </svg>
              Open Source
            </a>
            <a href="https://automatio.ai/" className="hidden items-center gap-1.5 text-ink-soft hover:text-wire-blue md:flex">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              Crafted by Automatio team
            </a>
            <Link href="/app" className="rounded-md bg-wire-blue px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-wire-blue-dark">Start designing</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-ink">
              Free Wire /
              <br />
              User Flow Tool
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-ink-soft">
              {"Wireflow is a "}
              <strong className="font-semibold text-ink">free, online and open source tool</strong>
              {" "}
              for creating beautiful user flow prototypes.
              {" "}
              <strong className="font-semibold text-ink">No Photoshop</strong>
              {" skills required!"}
            </p>
            <div className="mt-8">
              <Link href="/app" className="inline-block rounded-md bg-wire-blue px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-wire-blue/25 transition hover:bg-wire-blue-dark">Start designing</Link>
            </div>
            <p className="mt-4 text-sm text-ink-soft">Free forever. No sign up needed.</p>
          </div>
          <div className="relative rounded-xl bg-white shadow-[0_30px_80px_-20px_rgba(45,43,51,0.35)] ring-1 ring-wire-border">
            <div className="flex items-center gap-1.5 rounded-t-xl bg-ink px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-3 h-2 w-24 rounded-full bg-white/20" />
            </div>
            <div className="grid w-[560px] max-w-full grid-cols-2 gap-10 bg-wire-canvas/60 px-8 py-8 max-lg:w-[480px]">
              <div className="flex flex-col items-center">
                <img src="/graphics/header/header-1.svg" alt="Header wireframe card" width={220} className="w-[200px] rounded-lg shadow-md" />
                <svg className="my-1" width="24" height="40" viewBox="0 0 24 40" fill="none" aria-hidden>
                  <path d="M12 2v30M12 32l-5.5-6.5M12 32l5.5-6.5" stroke="#A3A8C3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <img src="/graphics/sign-in/sign-in-1.svg" alt="Sign in wireframe card" width={220} className="w-[220px] rounded-lg shadow-md" />
              </div>
              <div className="flex flex-col items-center pt-14">
                <img src="/graphics/article/article-1.svg" alt="Article wireframe card" width={220} className="w-[220px] rounded-lg shadow-md" />
                <svg className="my-1" width="24" height="40" viewBox="0 0 24 40" fill="none" aria-hidden>
                  <path d="M12 2v30M12 32l-5.5-6.5M12 32l5.5-6.5" stroke="#A3A8C3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <img src="/graphics/e-commerce/checkout.svg" alt="Checkout wireframe card" width={220} className="w-[220px] rounded-lg shadow-md" />
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="rounded-2xl bg-ink px-8 py-12 sm:px-14">
            <h2 className="mb-10 text-2xl font-bold text-white">Everything you need to map a flow</h2>
            <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              <div key="100+ graphics to use" className="flex gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md">
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                    <path d="M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h3 className="font-semibold text-white">100+ graphics to use</h3>
                  <p className="mt-1.5 text-sm leading-6 text-white/60">
                    Over 100 custom built graphics/cards which cover most web elements, interactions and usage cases.
                  </p>
                </div>
              </div>
              <div key="Real-time collaboration" className="flex gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md">
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                    <path d="M8 11a3 3 0 100-6 3 3 0 000 6zM2 20c0-3.3 2.7-5 6-5s6 1.7 6 5M16 11a2.5 2.5 0 100-5M17 15c2.5.4 4 2 4 4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
                <div>
                  <h3 className="font-semibold text-white">Real-time collaboration</h3>
                  <p className="mt-1.5 text-sm leading-6 text-white/60">
                    Invite your co-worker and together, in real time, design the user flow for your next project.
                  </p>
                </div>
              </div>
              <div key="Project permissions" className="flex gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-md">
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 3l8 3.5V12c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6.5L12 3zM9.5 12l2 2 3.5-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h3 className="font-semibold text-white">Project permissions</h3>
                  <p className="mt-1.5 text-sm leading-6 text-white/60">
                    Decide who has access to the project you are working on and whether it is public or private.
                  </p>
                </div>
              </div>
              <div key="Live chat" className="flex gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md">
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                    <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H9l-5 4V6z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h3 className="font-semibold text-white">Live chat</h3>
                  <p className="mt-1.5 text-sm leading-6 text-white/60">
                    Built-in live chat so you can talk with your teammate while you collaborate in real time.
                  </p>
                </div>
              </div>
              <div key="Easy to use interface" className="flex gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md">
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                    <path d="M5 19l3.5-1 9.8-9.8a1.8 1.8 0 00-2.5-2.5L6 15.5 5 19zM14 7l3 3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h3 className="font-semibold text-white">Easy to use interface</h3>
                  <p className="mt-1.5 text-sm leading-6 text-white/60">
                    Simple, minimal and easy to use interface brings a good experience while you design.
                  </p>
                </div>
              </div>
              <div key="No Photoshop required" className="flex gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
                <div>
                  <h3 className="font-semibold text-white">No Photoshop required</h3>
                  <p className="mt-1.5 text-sm leading-6 text-white/60">
                    No install and no previous experience in any complicated software needed. It runs in your browser.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full bg-wire-lavender py-20">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
            <div>
              <img src="/wireflow-logo.png" alt="Wireflow logo" className="h-14 w-14" />
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">Fully Open Source</h2>
              <p className="mt-4 max-w-md leading-7 text-ink-soft">
                Wireflow is MIT licensed and developed in the open. Fork it, self host it, or contribute. The whole project lives on GitHub.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="https://github.com/vanila-io/wireflow" className="inline-block rounded-md border border-ink/80 bg-white px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink transition hover:bg-ink hover:text-white">Check on GitHub</a>
                <a href="https://opencollective.com/wireflow/contribute" target="_blank" rel="noopener" className="inline-block rounded-md bg-wire-blue px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-wire-blue-dark">Support us</a>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div key="Node.js" className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-wire-border">
                <div className="flex items-center justify-center py-3 text-2xl font-extrabold tracking-tight text-ink">Node.js</div>
                <p className="text-xs leading-5 text-ink-soft">
                  {"Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine, using an event-driven, non-blocking I/O model."}
                </p>
                <Link href="https://github.com/vanila-io/wireflow" className="mt-4 block rounded-md bg-ink py-2 text-center text-[11px] font-bold uppercase tracking-wider text-white transition hover:bg-wire-blue">Check on GitHub</Link>
              </div>
              <div key="Next.js" className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-wire-border">
                <div className="flex items-center justify-center py-3 text-2xl font-extrabold tracking-tight text-ink">Next.js</div>
                <p className="text-xs leading-5 text-ink-soft">
                  Next.js is a React framework that gives you building blocks to create fast, full-stack web applications.
                </p>
                <Link href="https://github.com/vanila-io/wireflow" className="mt-4 block rounded-md bg-ink py-2 text-center text-[11px] font-bold uppercase tracking-wider text-white transition hover:bg-wire-blue">Check on GitHub</Link>
              </div>
              <div key="React.js" className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-wire-border">
                <div className="flex items-center justify-center py-3 text-2xl font-extrabold tracking-tight text-ink">React.js</div>
                <p className="text-xs leading-5 text-ink-soft">
                  React is a declarative, efficient and flexible JavaScript library for building user interfaces.
                </p>
                <Link href="https://github.com/vanila-io/wireflow" className="mt-4 block rounded-md bg-ink py-2 text-center text-[11px] font-bold uppercase tracking-wider text-white transition hover:bg-wire-blue">Check on GitHub</Link>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full bg-white py-20">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-ink">Sponsors & Backers</h2>
                <p className="mt-3 max-w-xl leading-7 text-ink-soft">Wireflow is free and open source thanks to our sponsors.</p>
              </div>
              <a href="https://opencollective.com/wireflow/contribute" target="_blank" rel="noopener" className="inline-block rounded-md bg-wire-blue px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-wire-blue-dark">Become a sponsor</a>
            </div>
            <div className="mt-10 space-y-8">
              <div key="gold">
                <div className="flex items-baseline gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
                    Gold
                    {" sponsors"}
                  </h3>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  <a key="Netrouting" href="https://netrouting.com/" target="_blank" rel="noopener" className="flex items-center gap-3 rounded-xl bg-white shadow-sm ring-1 ring-wire-border transition hover:shadow-md hover:ring-wire-blue/50 p-4">
                    <img src="https://opencollective-production.s3.us-west-1.amazonaws.com/account-avatar/405145cb-6e1e-4e76-bd40-28cba4b0a032/netrouting-logo.png" alt="Netrouting" className="h-11 w-11 rounded-lg object-contain" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-ink">Netrouting</div>
                    </div>
                  </a>
                  <a key="BuyVPS" href="https://www.buyvps.com/" target="_blank" rel="noopener" className="flex items-center gap-3 rounded-xl bg-white shadow-sm ring-1 ring-wire-border transition hover:shadow-md hover:ring-wire-blue/50 p-4">
                    <img src="https://opencollective-production.s3.us-west-1.amazonaws.com/account-avatar/0d5e5bd1-191a-48fd-9bed-b690ea796b26/logoicon-buyvps.png" alt="BuyVPS" className="h-11 w-11 rounded-lg object-contain" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-ink">BuyVPS</div>
                    </div>
                  </a>
                </div>
              </div>
              <div key="silver">
                <div className="flex items-baseline gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
                    Silver
                    {" sponsors"}
                  </h3>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  <a key="UnAIMyText" href="https://unaimytext.com/" target="_blank" rel="sponsored noopener" className="flex items-center gap-3 rounded-xl bg-white shadow-sm ring-1 ring-wire-border transition hover:shadow-md hover:ring-wire-blue/50 p-4">
                    <img src="https://opencollective-production.s3.us-west-1.amazonaws.com/account-avatar/fa5b36d5-69e6-44a4-bbdf-b5d264399365/icon_resized.png" alt="UnAIMyText" className="h-10 w-10 rounded-lg object-contain" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-ink">UnAIMyText</div>
                    </div>
                  </a>
                  <a key="INDownloader" href="https://indownloader.app/" target="_blank" rel="sponsored noopener" className="flex items-center gap-3 rounded-xl bg-white shadow-sm ring-1 ring-wire-border transition hover:shadow-md hover:ring-wire-blue/50 p-4">
                    <img src="https://opencollective-production.s3.us-west-1.amazonaws.com/account-avatar/75cc0ae1-3b3d-4332-9cb6-4cca1ea4b43b/1dfb2dc5-92b5-446c-8603-19c499ee16e1.png" alt="INDownloader" className="h-10 w-10 rounded-lg object-contain" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-ink">INDownloader</div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
        <GraphicsGallery />
      </main>
      <footer className="w-full border-t border-wire-border bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 md:grid-cols-3">
          <div>
            <Link href="/" className="flex items-center gap-2.5 ">
              <Image src="/wireflow-logo.png" alt="Wireflow logo" width={34} height={34} priority />
              <span className="leading-tight">
                <span className="block text-[17px] font-bold text-ink">Wireflow</span>
                <span className="block text-[11px] font-medium tracking-wide text-ink-soft">user flow designer tool</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-ink-soft">
              Free, online and open source tool for creating beautiful user flow prototypes. No Photoshop skills required.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink">Product</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-soft">
              <li>
                <Link href="/app" className="hover:text-wire-blue">Flow editor</Link>
              </li>
              <li>
                <a href="https://wireflow.co/blog/" className="hover:text-wire-blue">Blog</a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink">Project</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-soft">
              <li>
                <a href="https://github.com/vanila-io/wireflow" className="hover:text-wire-blue">GitHub repository</a>
              </li>
              <li>
                <a href="https://opencollective.com/wireflow/contribute" className="hover:text-wire-blue">Support on Open Collective</a>
              </li>
              <li>
                <a href="https://automatio.ai/" className="hover:text-wire-blue">Crafted by Automatio team</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-wire-border py-6 text-center text-xs text-ink-soft">
          Wireflow - user flow chart tool. MIT licensed, built by the Vanila team.
        </div>
      </footer>
    </div>
  );
}
