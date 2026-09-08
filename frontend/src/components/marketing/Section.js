import { cn } from "@/lib/utils";

export function SectionHeading({ eyebrow, title, text, align = "left", className, as: Tag = "h2" }) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <Tag className="display mt-3 text-3xl sm:text-4xl">{title}</Tag>
      {text && <p className="mt-4 text-base leading-relaxed text-mute md:text-lg">{text}</p>}
    </div>
  );
}

export function Section({ children, className, tone = "canvas", id }) {
  return <section id={id} className={cn("py-16 sm:py-20 lg:py-24", tone === "white" && "bg-white", tone === "brand" && "bg-brand text-white", className)}>{children}</section>;
}
