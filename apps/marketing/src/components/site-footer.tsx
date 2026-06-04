import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-border-soft border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[15px] font-semibold text-foreground">
            {siteConfig.name}
          </span>
          <p className="text-text-4 mt-1 text-xs">
            A study workspace for notes, recordings, and transcripts.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <a
            href={`${siteConfig.appUrl}/login`}
            className="text-text-3 text-sm transition-colors hover:text-foreground"
          >
            Sign in
          </a>
          <a
            href={`${siteConfig.appUrl}/signup`}
            className="text-text-3 text-sm transition-colors hover:text-foreground"
          >
            Get started
          </a>
        </nav>
      </div>
      <div className="border-border-soft border-t">
        <p className="text-text-4 mx-auto w-full max-w-5xl px-6 py-5 text-xs">
          © {new Date().getFullYear()} {siteConfig.name}. A study workspace for
          notes, recordings, and transcripts.
        </p>
      </div>
    </footer>
  );
}
