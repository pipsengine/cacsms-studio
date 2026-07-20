import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";

export function ComingSoonPage({
  title,
  description,
  href
}: {
  title: string;
  description?: string;
  href?: string;
}) {
  return (
    <section className="page-header">
      <span className="eyebrow">Workspace</span>
      <h2>{title}</h2>
      <p>
        {description ??
          "This workspace is registered in the studio configuration but has not been implemented yet. Use the linked canonical modules that are already live."}
      </p>
      <div className="grid" style={{ marginTop: 16, maxWidth: 420 }}>
        <Link className="button" href="/production-workflow/discover">
          <Construction size={16} aria-hidden="true" />
          Open Production Life Cycle
          <ArrowLeft size={16} aria-hidden="true" style={{ transform: "rotate(180deg)" }} />
        </Link>
        {href ? (
          <Link className="button" href={href}>
            Return to previous page
          </Link>
        ) : null}
      </div>
    </section>
  );
}
