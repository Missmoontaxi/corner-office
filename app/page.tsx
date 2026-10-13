import Image from "next/image";

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-black">
      <Image
        src="/art/placeholder-office.webp"
        alt="A corner office with a desk and monitor, framed by floor-to-ceiling windows onto an autumn forest"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[50%_60%]"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pt-24 pb-10 text-white sm:px-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Corner Office</h1>
        <p className="mt-2 text-base text-white/85 sm:text-lg">The desk is being built. Back soon.</p>
      </div>
    </main>
  );
}
