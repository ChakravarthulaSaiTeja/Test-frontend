# Forecaster AI - Frontend

A modern, AI-powered trading platform frontend built with Next.js, React, and TypeScript.

## Features

- 🤖 AI-powered trading insights and predictions
- 📊 Real-time market data visualization
- 💼 Portfolio management dashboard
- 📈 Technical analysis tools
- 🔐 Secure authentication
- 📱 Responsive design
- 🌙 Dark/Light theme support

## Tech Stack

- **Framework**: Next.js 15.5.2
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Charts**: Chart.js, Recharts
- **Authentication**: NextAuth.js
- **Deployment**: Netlify

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/test-frontend.git
cd test-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.netlify .env.local
# Edit .env.local with your actual API keys
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# OpenRouter Configuration (Alternative to OpenAI)
NEXT_PUBLIC_OPENROUTER_API_KEY=your_openrouter_api_key_here

# Market Data APIs
NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here
NEXT_PUBLIC_NEWSAPI_KEY=your_newsapi_key_here

# Backend API
NEXT_PUBLIC_BACKEND_URL=https://your-backend-api.com

# App Configuration
NEXT_PUBLIC_APP_NAME=Forecaster AI
NEXT_PUBLIC_APP_URL=https://your-netlify-app.netlify.app

# NextAuth Configuration
NEXTAUTH_URL=https://your-netlify-app.netlify.app
NEXTAUTH_SECRET=your_nextauth_secret_here
```

## Deployment

This project is configured for deployment on Netlify:

1. Connect your GitHub repository to Netlify
2. Set the environment variables in Netlify dashboard
3. Deploy your backend API separately (Railway, Heroku, AWS)
4. Update `NEXT_PUBLIC_BACKEND_URL` with your deployed backend URL

## Project Structure

```
src/
├── app/                 # Next.js app router pages
├── components/          # Reusable React components
│   ├── ui/             # Base UI components
│   ├── charts/         # Chart components
│   └── trading/        # Trading-specific components
├── contexts/           # React contexts
├── lib/                # Utility functions and configurations
└── types/              # TypeScript type definitions
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.