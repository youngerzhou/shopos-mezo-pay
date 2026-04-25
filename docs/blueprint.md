# **App Name**: Shopos Mezo

## Core Features:

- Interactive POS Frontend: A responsive, touch-friendly user interface for product selection and payment initiation, designed for mobile devices.
- Wallet Address Scanner: Integrate with the device's camera to scan Mezo chain wallet addresses for payment collection.
- Mezo Payment Initiation: Generate and display payment requests (e.g., QR codes) for transactions, defaulting to 100 MUSD per order.
- Goldsky Webhook Processor: A server-side endpoint (e.g., a Next.js API route) to securely receive and process real-time payment notifications from Goldsky.
- Real-time Payment Status via SSE: Implement Server-Sent Events (SSE) through a backend API route to push live updates on transaction status (pending, paid, failed) to the client.
- Payment Success Feedback: Provide immediate, positive visual animations and play an audio cue upon successful Mezo chain payment confirmation.
- Order Persistence with PostgreSQL: Store and manage Mezo chain transaction data in a PostgreSQL database, including order_id (UUID), wallet_address, amount_musd (DECIMAL, default 100.00), status (VARCHAR, default 'pending'), transaction_hash, created_at, and updated_at timestamps.

## Style Guidelines:

- Primary color: Muted Indigo (#4D4D61) for a sophisticated and modern feel, providing strong contrast on a light background.
- Background color: A subtle, cool gray (#EFF0F2) to create a clean, minimalist canvas that lightly hints at the primary hue.
- Accent color: Vibrant Cyan Blue (#3299D1) used for interactive elements and highlights, ensuring clear calls to action and visual emphasis.
- Primary font: 'Inter' (sans-serif) for all text, chosen for its modern, clean, and objective aesthetic suitable for a transactional interface.
- Use a set of clear, concise line icons for common POS actions and blockchain-related elements like wallet scanning and payment status, maintaining a minimalist style.
- Design a clean and intuitive mobile-first layout with clearly defined sections, generous spacing, and large, touch-friendly buttons for ease of use in a retail environment.
- Implement smooth, subtle transitions between screens and elements, with particular attention to a celebratory, short animation upon successful payment completion.