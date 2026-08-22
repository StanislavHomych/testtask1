export function PdfPreview({
  url,
  title,
}: {
  url: string
  title: string
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-[0_20px_50px_-36px_rgba(15,28,22,0.35)]">
      <iframe title={title} src={url} className="h-[75vh] w-full bg-white" />
    </div>
  )
}
