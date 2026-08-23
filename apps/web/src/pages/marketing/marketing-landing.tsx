import { useId, useState } from 'react'
import { SignInButton, SignUpButton } from '@clerk/react'
import { SiteHeader } from '@/components/layout/site-header'
import { Button } from '@/components/ui/button'

const FAQ_ITEMS = [
  {
    question: 'What is Vault?',
    answer:
      'Vault is a virtual data room for teams that need to organize sensitive PDFs, control who can view them, and keep diligence moving without email attachments.',
  },
  {
    question: 'Who is Vault designed for?',
    answer:
      'Founders, operators, legal teams, and investors who run fundraising or M&A diligence. It scales from a single owner-operator to larger shared workspaces.',
  },
  {
    question: 'How are files stored?',
    answer:
      'Documents are stored in private cloud storage. Vault keeps only metadata and access rules, and opens files through short-lived secure links.',
  },
  {
    question: 'Can I revoke access later?',
    answer:
      'Yes. Owners can revoke user invites and public links at any time. Shared viewers lose access as soon as a share is revoked or expires.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Authentication is handled by Clerk. Authorization, ownership, and sharing rules live in PostgreSQL and are checked on every API request. Uploads go to a private S3 bucket.',
  },
]

function FaqItem({
  question,
  answer,
}: {
  question: string
  answer: string
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className="border-b border-border/80 py-5">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 text-left"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="font-display text-lg font-semibold text-ink sm:text-xl">
          {question}
        </span>
        <span className="mt-1 text-sm font-semibold text-muted-foreground">
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? (
        <p
          id={panelId}
          className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base"
        >
          {answer}
        </p>
      ) : null}
    </div>
  )
}

function ProductChrome() {
  return (
    <div className="liquid-glass rounded-[1.5rem] p-3 sm:p-4">
      <div className="rounded-[1.1rem] bg-[#f7faf7]/95 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-base font-semibold text-ink sm:text-lg">
              Series A diligence
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Legal · Finance · People · 64 PDFs
            </p>
          </div>
          <span className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
            Live
          </span>
        </div>
        <div className="grid gap-2">
          {[
            ['DIR', 'Corporate docs'],
            ['DIR', 'Financial model'],
            ['PDF', 'SAFE summary.pdf'],
            ['PDF', 'Board minutes.pdf'],
          ].map(([kind, label]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-xl bg-white/90 px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-semibold ${
                    kind === 'PDF'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-accent text-accent-foreground'
                  }`}
                >
                  {kind}
                </span>
                <span className="text-sm font-medium text-ink">{label}</span>
              </div>
              <span className="text-xs text-muted-foreground">Open</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MarketingLanding() {
  return (
    <div className="app-grain min-h-screen">
      <section className="relative min-h-screen overflow-hidden">
        <img
          src="/marketing/landing-hero.jpg"
          alt="Bright modern atrium with glass, greenery, and soft morning light"
          className="hero-kenburns absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f1c16]/20 via-transparent to-[#0f1c16]/35" />
        <div className="liquid-orb -left-16 top-24 h-56 w-56 opacity-70 sm:h-72 sm:w-72" />
        <div
          className="liquid-orb right-[-4rem] bottom-24 h-64 w-64 opacity-50"
          style={{ animationDelay: '1.4s' }}
        />

        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 pb-14 pt-4 sm:px-8">
          <div className="liquid-glass animate-fade rounded-2xl px-4 py-3 sm:px-5">
            <SiteHeader />
          </div>

          <div className="flex flex-1 flex-col justify-end py-12 sm:py-16 lg:justify-center lg:py-20">
            <div className="liquid-glass liquid-glass-hero animate-rise max-w-2xl rounded-[1.85rem] p-7 sm:p-10 lg:p-11">
              <div className="mb-6 h-1 w-14 rounded-full bg-[color:var(--leaf)]" />
              <p className="font-display text-5xl font-bold tracking-tight text-ink sm:text-6xl lg:text-7xl">
                Vault
              </p>
              <h1 className="animate-rise-delay mt-4 font-display text-3xl font-semibold leading-[1.12] tracking-tight text-ink sm:text-4xl lg:text-[2.65rem]">
                A modern approach to secure data rooms
              </h1>
              <p className="animate-rise-delay-2 mt-5 max-w-lg text-base leading-relaxed text-[#3f5649] sm:text-lg">
                Organize nested folders, upload PDFs privately, and share
                read-only access with investors — without shipping files through
                email.
              </p>
              <div className="animate-rise-delay-2 mt-8 flex flex-wrap items-center gap-3">
                <SignUpButton mode="modal">
                  <Button type="button" size="lg">
                    Get started
                  </Button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <Button type="button" size="lg" variant="outline">
                    Log in
                  </Button>
                </SignInButton>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        {/* Trust strip */}
        <section className="border-b border-border/70 py-10" aria-label="Built for">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Built for modern diligence teams
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 font-display text-sm font-semibold text-ink/55 sm:text-base">
            {[
              'Founders',
              'Legal counsel',
              'Finance leads',
              'Investors',
              'Operators',
            ].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </section>

        {/* Story */}
        <section className="grid items-center gap-10 py-20 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
              Diligence is built on trust.
              <br />
              Your tools should feel that way too.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Vault connects ownership, nested folders, private PDF storage, and
              sharing in one calm workspace. Capture work in fewer clicks, keep
              everyone on the same page, and stay confident about who can see
              what.
            </p>
            <SignUpButton mode="modal">
              <Button type="button" className="mt-8" size="lg" variant="soft">
                See how we can help
              </Button>
            </SignUpButton>
          </div>
          <div className="overflow-hidden rounded-[1.75rem]">
            <img
              src="/marketing/landing-organize.jpg"
              alt="Organized document folders on a desk ready for diligence review"
              className="h-full min-h-[280px] w-full object-cover"
              loading="lazy"
            />
          </div>
        </section>

        {/* Product platform */}
        <section className="border-t border-border/70 py-20">
          <h2 className="max-w-3xl font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            All-in-one platform for secure document exchange
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            From the first folder to the final revoke — Vault streamlines the
            entire data room workflow.
          </p>

          <div className="mt-12 grid gap-10 md:grid-cols-2">
            {[
              {
                title: 'Data rooms',
                body: 'Create owned workspaces with a root folder, rename anytime, and soft-delete when a process ends.',
              },
              {
                title: 'Folders',
                body: 'Unlimited nesting with breadcrumbs and cursor pagination. Never load an entire tree into memory.',
              },
              {
                title: 'PDF files',
                body: 'Upload directly to private object storage, preview in-app, rename, move, and delete with confidence.',
              },
              {
                title: 'Sharing',
                body: 'Invite signed-in viewers by email or mint a public link. Roles are VIEWER today, EDITOR-ready tomorrow.',
              },
            ].map((item) => (
              <article key={item.title} className="border-t border-border/80 pt-6">
                <h3 className="font-display text-xl font-semibold text-ink">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Product presentation with chrome */}
        <section className="relative overflow-hidden rounded-[2rem] py-16 sm:py-20">
          <img
            src="/marketing/landing-trust.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-[#0f1c16]/78" />
          <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-6 lg:grid-cols-2 lg:gap-14 sm:px-10">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Meet the room
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/75 sm:text-lg">
                Browse folders, open PDFs, and manage shares from a workspace
                that stays quiet under pressure — even as diligence heats up.
              </p>
            </div>
            <ProductChrome />
          </div>
        </section>

        {/* How it works */}
        <section className="py-20">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Stay organized, stay informed, stay ahead
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground sm:text-lg">
            Automate the busywork of document exchange so your team can focus on
            closing.
          </p>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Create a room',
                body: 'Name the workspace. Vault creates a root folder and maps your Clerk identity to local ownership.',
              },
              {
                step: '02',
                title: 'Upload & structure',
                body: 'Add nested folders and PDFs. Duplicate names resolve with a stable suffix before anything is saved.',
              },
              {
                step: '03',
                title: 'Share & revoke',
                body: 'Invite viewers or create a public link. When diligence ends, revoke access in one click.',
              },
            ].map((item) => (
              <li key={item.step} className="border-t border-border/80 pt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-leaf">
                  {item.step}
                </p>
                <h3 className="mt-3 font-display text-xl font-semibold text-ink">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Feature deep dive with image */}
        <section className="grid items-center gap-10 border-t border-border/70 py-20 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 overflow-hidden rounded-[1.75rem] lg:order-1">
            <img
              src="/marketing/landing-share.jpg"
              alt="Secure document sharing concept with sealed materials and devices"
              className="min-h-[280px] w-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Sharing without the chaos
            </h2>
            <ul className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <li>
                <span className="font-semibold text-ink">User invites — </span>
                share with people who already signed in once; access inherits
                through parent folders.
              </li>
              <li>
                <span className="font-semibold text-ink">Public links — </span>
                mint a read-only token stored as a SHA-256 hash, never as
                plaintext.
              </li>
              <li>
                <span className="font-semibold text-ink">Revocation — </span>
                cut off access immediately when a process ends or a link leaks.
              </li>
            </ul>
          </div>
        </section>

        {/* Outcomes */}
        <section className="surface-panel px-6 py-12 sm:px-10">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Your inbox isn’t a data room
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              {
                value: 'Fewer clicks',
                label: 'Create, upload, and share from one calm workspace.',
              },
              {
                value: 'Clear ownership',
                label: 'Server-side authz decides access — never the client.',
              },
              {
                value: 'Less risk',
                label: 'Short-lived view URLs and revocable shares by default.',
              },
            ].map((item) => (
              <div key={item.value}>
                <p className="font-display text-2xl font-semibold text-ink">
                  {item.value}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            What teams want from a data room
          </h2>
          <div className="mt-10 grid gap-8 lg:grid-cols-3">
            {[
              {
                quote:
                  'We stopped mailing zip files around. Everyone looks at the same folder tree, and we can revoke the link when the round closes.',
                role: 'Founder, early-stage SaaS',
              },
              {
                quote:
                  'Nested folders with breadcrumbs matter more than flashy dashboards. Vault keeps the hierarchy honest.',
                role: 'Outside counsel',
              },
              {
                quote:
                  'PDF preview in place means partners stop asking for “the latest version” in Slack.',
                role: 'Finance lead',
              },
            ].map((item) => (
              <blockquote
                key={item.role}
                className="border-t border-border/80 pt-6"
              >
                <p className="text-base leading-relaxed text-ink">
                  “{item.quote}”
                </p>
                <footer className="mt-4 text-sm text-muted-foreground">
                  {item.role}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        {/* FAQ — SEO */}
        <section className="border-t border-border/70 py-20" id="faq">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Frequently asked questions
          </h2>
          <div className="mt-8">
            {FAQ_ITEMS.map((item) => (
              <FaqItem
                key={item.question}
                question={item.question}
                answer={item.answer}
              />
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="surface-panel px-6 py-12 sm:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">
                Grow your process with modern tools
              </h2>
              <p className="mt-3 text-muted-foreground">
                Create a room, upload your first PDF, and share a link in
                minutes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <SignUpButton mode="modal">
                <Button type="button" size="lg">
                  Get started
                </Button>
              </SignUpButton>
              <SignInButton mode="modal">
                <Button type="button" size="lg" variant="outline">
                  Log in
                </Button>
              </SignInButton>
            </div>
          </div>
        </section>

        <footer className="mt-16 grid gap-8 border-t border-border/70 pt-10 text-sm text-muted-foreground md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <p className="font-display text-lg font-semibold text-ink">Vault</p>
            <p className="mt-2 max-w-sm leading-relaxed">
              A modern virtual data room for secure document sharing and
              diligence workflows.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Product</p>
            <ul className="mt-3 space-y-2">
              <li>Data rooms</li>
              <li>Folders & PDFs</li>
              <li>Sharing & revoke</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-ink">Resources</p>
            <ul className="mt-3 space-y-2">
              <li>
                <a href="#faq" className="hover:text-ink">
                  FAQ
                </a>
              </li>
              <li>Security overview</li>
              <li>Privacy</li>
            </ul>
          </div>
          <p className="md:col-span-3 pt-2 text-xs">
            © {new Date().getFullYear()} Vault. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  )
}
