export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(var(--bg))" }}>
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ background: "hsl(var(--accent))" }}
            >
              H
            </div>
            <span className="text-xl font-semibold" style={{ color: "hsl(var(--text))" }}>
              HostelHub
            </span>
          </div>
          <p className="mt-1 text-sm" style={{ color: "hsl(var(--text-muted))" }}>
            Smart hostel management
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
