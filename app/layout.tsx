import type { Metadata } from 'next';
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
        <main className="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}
