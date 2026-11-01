import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BeforeAfter } from "@/components/landing/before-after";
import { Planner } from "@/components/planner";
import { example } from "@/assets/example/example";
import after from "@/assets/landing/after.jpg";
import appMeasure from "@/assets/landing/app-measure.jpg";
import before from "@/assets/example/room.jpg";
import clean from "@/assets/example/clean.jpg";
import botanical from "@/assets/landing/botanical.jpg";
import coastal from "@/assets/landing/coastal.jpg";
import poster from "@/assets/landing/poster.jpg";
import textile from "@/assets/landing/textile.jpg";
import watercolour from "@/assets/landing/watercolour.jpg";

// Priced per wall, since most people plan one wall at a time. Prices are placeholders until payments are in place.
const plans = [
  {
    name: "One wall",
    price: "$3",
    featured: false,
    items: [
      "Photos of as much art as you like",
      "Unlimited layouts",
      "Sizes in centimetres",
      "Save and compare layouts",
      "Where to hang every frame, in centimetres",
    ],
  },
  {
    name: "Whole home",
    price: "$10",
    tag: "Moving in?",
    featured: true,
    items: ["Everything in One wall", "Up to 10 walls, whenever you like", "Move art between walls"],
  },
];

function Cta({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    <Link
      href="/plan"
      className={`inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-medium shadow-lg transition ${
        light ? "bg-white text-stone-900 hover:bg-stone-100" : "bg-stone-900 text-white shadow-stone-900/20 hover:bg-stone-700"
      } ${className}`}
    >
      Plan your wall
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 10h12M11 5l5 5-5 5" />
      </svg>
    </Link>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-stone-900">
      <span className="grid grid-cols-2 gap-0.5">
        <span className="h-3 w-2 rounded-[2px] bg-stone-900" />
        <span className="h-2 w-3 self-end rounded-[2px] bg-[#c2683f]" />
        <span className="h-2 w-3 rounded-[2px] bg-[#c2683f]" />
        <span className="h-3 w-2 rounded-[2px] bg-stone-900" />
      </span>
      <span className="font-serif text-2xl leading-none">Gallery Wall</span>
    </Link>
  );
}

const steps = [
  {
    title: "Snap your wall",
    body: "Leaning on a sideboard or the floor is fine. Add photos of art from anywhere else in the house.",
    image: before,
    alt: "A dining room with framed art leaning on the sideboard",
  },
  {
    title: "We clear the wall",
    body: "Every frame is found, cut out and straightened. The wall comes back empty.",
    image: clean,
    alt: "The same wall with the art removed",
  },
  {
    title: "Shuffle until it clicks",
    body: "A new layout with every tap. Save the ones you like and flip between them.",
    image: after,
    alt: "The art arranged on the wall above the sideboard",
  },
];

const features = [
  { title: "Every frame in centimetres", body: "Sizes are estimated from your photos and shown on every piece." },
  { title: "One measurement fixes the scale", body: "Type the width of your sofa or wall and everything rescales." },
  { title: "Any wall", body: "Above a sofa, sideboard, bed or radiator — or a bare wall." },
  { title: "Know where to hang each frame", body: "Tap a frame to see how high and how far from centre it goes." },
  { title: "Compare favourites", body: "Save layouts as you go and switch back with one tap." },
];

const faqs = [
  {
    q: "What counts as a wall?",
    a: "The wall you plan on. Add as many photos of art as you like and try as many layouts as you want on it.",
  },
  {
    q: "Is it a subscription?",
    a: "No. You pay once per wall.",
  },
  {
    q: "Do my frames need to be on the wall first?",
    a: "No. Lean them against the wall, stand them on the sofa or lay them on the floor. We cut them out wherever they are.",
  },
  {
    q: "What if my art is in another room?",
    a: "Add a photo of it. Art from every photo you add ends up in one tray, ready to place on any wall.",
  },
  {
    q: "How accurate are the sizes?",
    a: "They're estimated from your photos. Type one real measurement, like the width of your sofa, and everything rescales to match.",
  },
  {
    q: "What happens to my photos?",
    a: "They're processed to find your art and clear your wall. We don't keep them.",
  },
];

export default function Landing() {
  return (
    <div className="bg-[#f6f3ee] text-stone-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-8 text-sm text-stone-600">
          <a href="#try" className="hidden hover:text-stone-900 sm:block">
            Try it
          </a>
          <a href="#how" className="hidden hover:text-stone-900 sm:block">
            How it works
          </a>
          <a href="#pricing" className="hidden hover:text-stone-900 sm:block">
            Pricing
          </a>
          <Link href="/plan" className="rounded-full border border-stone-300 px-4 py-2 font-medium text-stone-900 hover:bg-white">
            Start planning
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[5fr_7fr] lg:pt-16">
          <div>
            <h1 className="font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              See your gallery wall <em className="text-[#c2683f]">before</em> you drill a single hole.
            </h1>
            <p className="mt-6 max-w-md text-lg text-stone-600">
              Upload a photo of your wall and your art. Get layouts at real size in seconds.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Cta />
              <span className="text-sm text-stone-500">From {plans[0].price} per wall · No subscription</span>
            </div>
          </div>
          <BeforeAfter before={before} after={after} />
        </section>

        <section id="try" className="mx-auto max-w-6xl scroll-mt-6 px-6 pb-24">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <h2 className="font-serif text-4xl tracking-tight sm:text-5xl">Try it on our wall</h2>
            <p className="text-stone-500">Press Random, drag the frames or turn on Measure.</p>
          </div>
          <div className="mt-8 h-[min(80vh,720px)] overflow-hidden rounded-2xl shadow-[0_30px_80px_-30px_rgba(41,37,36,0.5)] ring-1 ring-stone-900/10">
            <Planner example={example} className="h-full" />
          </div>
        </section>

        <section id="how" className="border-y border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="font-serif text-4xl tracking-tight sm:text-5xl">From one photo to a finished wall</h2>
            <div className="mt-14 grid gap-10 md:grid-cols-3">
              {steps.map((step, i) => (
                <div key={step.title}>
                  <div className="relative overflow-hidden rounded-xl ring-1 ring-stone-900/10">
                    <Image src={step.image} alt={step.alt} sizes="(min-width: 768px) 33vw, 100vw" className="aspect-[4/3] object-cover" />
                    {i === 1 && (
                      // The art found in the photo, collected in a tray like the planner's.
                      <div className="absolute inset-x-3 bottom-3 flex h-14 items-center justify-center gap-2 overflow-hidden rounded-lg bg-white/90 px-3 shadow-lg backdrop-blur">
                        {[botanical, coastal, poster, watercolour, textile].map((piece) => (
                          <Image key={piece.src} src={piece} alt="" className="h-9 w-auto rounded-[2px] shadow ring-1 ring-black/5 sm:h-10" />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-6 flex items-baseline gap-3">
                    <span className="font-serif text-3xl text-[#c2683f]">{i + 1}</span>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                  </div>
                  <p className="mt-2 text-stone-600">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-24 lg:grid-cols-[4fr_7fr]">
          <div>
            <h2 className="font-serif text-4xl tracking-tight sm:text-5xl">Real sizes, not guesses</h2>
            <dl className="mt-10 space-y-7">
              {features.map((feature) => (
                <div key={feature.title} className="border-l-2 border-[#c2683f] pl-5">
                  <dt className="font-semibold">{feature.title}</dt>
                  <dd className="mt-1 text-stone-600">{feature.body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="overflow-hidden rounded-2xl shadow-[0_30px_80px_-30px_rgba(41,37,36,0.5)]">
            <Image src={appMeasure} alt="The planner showing a layout with every frame's size in centimetres" sizes="(min-width: 1024px) 60vw, 100vw" />
          </div>
        </section>

        <section id="pricing" className="border-y border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="text-center">
              <h2 className="font-serif text-4xl tracking-tight sm:text-5xl">Pay once. Hang it right.</h2>
              <p className="mt-4 text-lg text-stone-600">No subscription. Nothing to cancel.</p>
            </div>
            <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl p-8 ${
                    plan.featured ? "bg-stone-900 text-white" : "border border-stone-200"
                  }`}
                >
                  {plan.tag && (
                    <span className="absolute right-6 top-6 rounded-full bg-[#c2683f]/10 px-3 py-1 text-xs font-medium text-[#c2683f]">
                      {plan.tag}
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-2 font-serif text-5xl">
                    {plan.price}
                    <span className={`ml-2 font-sans text-base ${plan.featured ? "text-stone-400" : "text-stone-500"}`}>
                      one-time
                    </span>
                  </p>
                  <ul className={`mt-8 mb-10 space-y-3 ${plan.featured ? "text-stone-200" : "text-stone-700"}`}>
                    {plan.items.map((item) => (
                      <PlanItem key={item}>{item}</PlanItem>
                    ))}
                  </ul>
                  <Link
                    href="/plan"
                    className={`mt-auto block rounded-full py-3 text-center font-medium ${
                      plan.featured
                        ? "bg-white text-stone-900 hover:bg-stone-100"
                        : "border border-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    Plan your wall
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-24">
          <h2 className="font-serif text-4xl tracking-tight sm:text-5xl">Questions</h2>
          <div className="mt-10 divide-y divide-stone-200 border-y border-stone-200">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium">
                  {faq.q}
                  <span className="text-2xl leading-none text-stone-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-stone-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-stone-900 px-8 py-20 text-center text-white">
            <Image src={after} alt="" fill sizes="100vw" className="object-cover opacity-25" />
            <div className="relative">
              <h2 className="font-serif text-4xl tracking-tight sm:text-6xl">Your wall, planned in a minute.</h2>
              <Cta light className="mt-10" />
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl items-center justify-between px-6 pb-10 text-sm text-stone-500">
        <Logo />
        <span>© Gallery Wall</span>
      </footer>
    </div>
  );
}

function PlanItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-[#c2683f]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 10.5l4 4 8-9" />
      </svg>
      {children}
    </li>
  );
}
