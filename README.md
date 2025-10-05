# Forecaster AI - Frontend

AI-powered trading intelligence platform with real-time market data, ML predictions, and sentiment analysis.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Neon database account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ChakravarthulaSaiTeja/Test-frontend.git
   cd Test-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   **For Local Development:**
   Create a `.env.local` file in the root directory:
   ```bash
   NETLIFY_DATABASE_URL=postgresql://neondb_owner:npg_t36WmiQESfgH@ep-rough-haze-ae5v3f08-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
   
   **For Netlify Deployment:**
   Add the environment variable in your Netlify site settings:
   - Key: `NETLIFY_DATABASE_URL`
   - Value: Your Neon database connection string

4. **Initialize database**
   ```bash
   npm run init-db
   ```

5. **Test database connection**
   ```bash
   npm run test-db
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run init-db` - Initialize database tables
- `npm run test-db` - Test database connection

## 🗄️ Database Setup

This project uses Neon database for authentication and user management.

### Database Schema
- **users**: Stores user accounts with secure password hashing
- **sessions**: Manages user sessions with expiration

### Environment Variables
- `NETLIFY_DATABASE_URL`: Neon database connection string
- `DATABASE_URL`: Alternative database URL variable

## 🚀 Deployment

### Netlify Deployment
1. Connect your GitHub repository to Netlify
2. Add environment variable `NETLIFY_DATABASE_URL`
3. Deploy automatically on push to main branch

### Environment Variables for Production
Make sure to set these in your Netlify site settings:
- `NETLIFY_DATABASE_URL`: Your Neon database connection string

## 🔐 Authentication

The application uses a secure authentication system with:
- Password hashing with bcryptjs
- Session management with expiration
- Database-backed user storage
- Client-side localStorage for persistence

## 📁 Project Structure

```
src/
├── app/                 # Next.js app router pages
├── components/          # React components
├── contexts/           # React contexts (Auth)
├── lib/                # Utility functions and services
│   ├── auth.ts         # Client-side authentication
│   ├── auth-service.ts # Database authentication service
│   ├── database.ts     # Database initialization
│   └── types.ts        # Shared TypeScript types
└── styles/             # CSS styles
```

## 🛠️ Troubleshooting

### Database Connection Issues
1. Verify your `NETLIFY_DATABASE_URL` is correct
2. Check if your Neon database is active
3. Ensure your IP is whitelisted (if required)
4. Run `npm run test-db` to test connection

### Build Issues
1. Make sure all dependencies are installed: `npm install`
2. Check TypeScript errors: `npm run lint`
3. Verify environment variables are set

### Authentication Issues
1. Ensure database tables are created: `npm run init-db`
2. Check browser console for errors
3. Verify environment variables are configured

## 📝 License

This project is licensed under the MIT License.