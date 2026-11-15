export default function Loading({ text = "正在加载…", id }) {
  return (
    <p className="feed-loading" id={id}>
      {text}
    </p>
  );
}
