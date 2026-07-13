"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="card operational-error" role="alert"><h2>This operational page could not be loaded</h2><p>{error.message}</p><button className="button" type="button" onClick={reset}>Try again</button></section>;
}
