import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col px-6 py-8">
      <Link href="/" className="mb-8 text-sm text-neutral-500">
        ← Consultant Marketing
      </Link>
      {children}
    </div>
  );
}
