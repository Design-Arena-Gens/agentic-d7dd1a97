import './globals.css';

export const metadata = {
  title: 'Text-to-Speech Agents',
  description: 'Create multiple speaking agents with the Web Speech API',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
