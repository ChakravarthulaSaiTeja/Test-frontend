# Neon Database Setup for Forecaster AI

This project now uses Neon database for user authentication and session management.

## 🚀 Quick Setup

### 1. Create Neon Database
1. Go to [Neon Console](https://console.neon.tech/)
2. Sign up/Login with your account
3. Create a new project
4. Copy your database connection string

### 2. Configure Environment Variables

#### For Local Development:
Create a `.env.local` file in the project root:
```bash
NETLIFY_DATABASE_URL=postgresql://username:password@hostname:port/database_name
```

#### For Netlify Deployment:
1. Go to your Netlify site dashboard
2. Navigate to Site settings > Environment variables
3. Add a new variable:
   - **Key**: `NETLIFY_DATABASE_URL`
   - **Value**: Your Neon database connection string

### 3. Initialize Database
Run the database initialization script:
```bash
npm run init-db
```

This will create the necessary tables:
- `users` - Stores user accounts
- `sessions` - Manages user sessions

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Sessions Table
```sql
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔐 Authentication Features

- **Secure Password Hashing**: Uses bcryptjs with salt rounds
- **Session Management**: Database-backed sessions with expiration
- **User Registration**: Full signup flow with validation
- **User Login**: Email/password authentication
- **Session Persistence**: Client-side localStorage + server-side validation

## 🛠️ Development

### Testing Authentication
1. Start the development server: `npm run dev`
2. Navigate to `/auth/signup` to create a new account
3. Use `/auth/signin` to login with existing credentials

### Database Operations
- **Create User**: `createUser(email, password, username, fullName)`
- **Authenticate**: `authenticateUser(email, password)`
- **Create Session**: `createSession(userId)`
- **Get User by Token**: `getUserByToken(token)`
- **Delete Session**: `deleteSession(token)`

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify your `NETLIFY_DATABASE_URL` is correct
   - Check if your Neon database is active
   - Ensure your IP is whitelisted (if required)

2. **Authentication Not Working**
   - Run `npm run init-db` to ensure tables exist
   - Check browser console for errors
   - Verify environment variables are set

3. **Build Errors**
   - Make sure all dependencies are installed: `npm install`
   - Check TypeScript errors: `npm run lint`

## 📝 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NETLIFY_DATABASE_URL` | Neon database connection string | Yes |
| `DATABASE_URL` | Alternative database URL variable | No |

## 🔗 Useful Links

- [Neon Documentation](https://neon.tech/docs)
- [Neon Console](https://console.neon.tech/)
- [Netlify Environment Variables](https://docs.netlify.com/environment-variables/overview/)
