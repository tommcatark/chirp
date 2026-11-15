export default function EmptyState({ title, description, hidden = false, id }) {
  return (
    <div className={`empty-state${hidden ? " hidden" : ""}`} id={id}>
      <div className="empty-mark">
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
          <path d="M17 8a5 5 0 1 0-10 0c0 5.8-2.5 7-2.5 8.5h15C19.5 15 17 13.8 17 8Z" />
        </svg>
      </div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
