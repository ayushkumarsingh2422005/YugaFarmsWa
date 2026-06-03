export function AdminPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="wa-card-header rounded-t-2xl">
      <h2 className="wa-page-title">{title}</h2>
      {description ? <p className="wa-subtitle mt-1">{description}</p> : null}
    </div>
  );
}
