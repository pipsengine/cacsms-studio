export default function Loading() {
  return <section aria-busy="true"><div className="operational-loading-header" /><div className="operational-loading-grid">{Array.from({ length: 6 }).map((_, index) => <div key={index} />)}</div><div className="operational-loading-body" /></section>;
}
