import './globals.css';

export const metadata = {
  title: 'Dynamic Online Form',
  description: 'Experiment form with randomized fields and popup',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}


