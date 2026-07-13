"use client";
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="panel"><h2>Content Intelligence could not be loaded</h2><p className="muted">Please retry the request.</p><button className="primary" onClick={reset}>Try again</button></div>}
