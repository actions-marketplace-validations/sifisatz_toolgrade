export function SectionHeading({
  eyebrow,
  title,
  text,
  center = true,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  center?: boolean;
}) {
  return (
    <div
      className={`reveal ${center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}`}
    >
      <div className="text-xs font-semibold tracking-widest text-chart-1 uppercase">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {text && <p className="mt-3 text-pretty text-muted-foreground">{text}</p>}
    </div>
  );
}
