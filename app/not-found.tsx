import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page-container" id="main">
      <div className="empty-state">
        <h1>Missed a step.</h1>
        <p>This page could not be found.</p>
        <Link className="button button-primary" href="/">
          Back to the dance floor
        </Link>
      </div>
    </main>
  );
}
