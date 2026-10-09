import Link from "next/link";
import { Logo } from "./header";

export default function Footer() {
  return (
    <footer className="w-full border-t border-wire-border bg-white">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-6 text-ink-soft">
            Free, online and open source tool for creating beautiful user flow
            prototypes. No Photoshop skills required.
          </p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
            Product
          </h4>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-soft">
            <li>
              <Link href="/app" className="hover:text-wire-blue">
                Flow editor
              </Link>
            </li>
            <li>
              <a
                href="https://wireflow.co/blog/"
                className="hover:text-wire-blue"
              >
                Blog
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
            Project
          </h4>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-soft">
            <li>
              <a
                href="https://github.com/vanila-io/wireflow"
                className="hover:text-wire-blue"
              >
                GitHub repository
              </a>
            </li>
            <li>
              <a
                href="https://opencollective.com/wireflow/contribute"
                className="hover:text-wire-blue"
              >
                Support on Open Collective
              </a>
            </li>
            <li>
              <a href="https://automatio.ai/" className="hover:text-wire-blue">
                Crafted by Automatio team
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-wire-border py-6 text-center text-xs text-ink-soft">
        Wireflow - user flow chart tool. MIT licensed, built by the Vanila team.
      </div>
    </footer>
  );
}
