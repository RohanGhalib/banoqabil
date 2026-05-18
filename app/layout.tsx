import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bano Qabil — Enrollment & Timetable Management Suite',
  description: 'Connected backend portal to search, filter, and bulk upload students, configure campus lab classrooms, and dynamically allocate seat timetables.',
  icons: {
    icon: '/favicon.ico',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <header className="app-header">
          <div className="header-container">
            {/* Branding Logo & Info */}
            <div className="brand-section">
              <div className="brand-logo">BQ</div>
              <div>
                <h1 className="brand-name">Bano Qabil</h1>
                <p className="brand-sub">Batch 2 Administration Suite</p>
              </div>
            </div>

            {/* Central Navigation Tabs */}
            <nav className="header-nav">
              {/* Note: In Next.js App Router we can just use normal navigation or client-side links */}
              <Link href="/" className="nav-link">
                👤 Student Directory
              </Link>
              <Link href="/timetable" className="nav-link">
                ⏰ Class Timetable
              </Link>
            </nav>

            {/* Live Firestore Connection Badge */}
            <div className="header-actions">
              <div className="db-status-badge">
                <span className="db-status-dot"></span>
                <span>Firestore Live</span>
              </div>
            </div>
          </div>
        </header>

        <main className="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}
