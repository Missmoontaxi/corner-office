import Image from "next/image";

// Phones see the whole wide room with the line below it; larger screens get it full-bleed.
export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col justify-center overflow-hidden bg-black text-white">
      <div className="relative aspect-[7/3] w-full sm:absolute sm:inset-0 sm:aspect-auto">
        <Image
          src="/art/placeholder-office.webp"
          alt="A corner office with a desk and monitor, framed by floor-to-ceiling windows onto an autumn forest"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_60%]"
        />
      </div>
      <div className="px-4 pt-6 sm:absolute sm:inset-x-0 sm:bottom-0 sm:bg-gradient-to-t sm:from-black/75 sm:via-black/30 sm:to-transparent sm:px-10 sm:pt-24 sm:pb-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Corner Office</h1>
        <p className="mt-2 text-base text-white/85 sm:text-lg">The desk is being built. Back soon.</p>
      </div>
    </main>
  );
}
