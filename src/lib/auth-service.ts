import { neon } from '@netlify/neon';
import bcrypt from 'bcryptjs';
import { DatabaseUser, AuthResult } from './types';

// Initialize Neon database connection only when needed
const getSql = () => {
  const databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Database URL not provided. Please set NETLIFY_DATABASE_URL or DATABASE_URL environment variable.');
  }
  return neon(databaseUrl);
};

// Hash password
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Verify password
const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

// Generate session token
const generateToken = (): string => {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Create user in database
export async function createUser(email: string, password: string, username: string, fullName: string): Promise<AuthResult<DatabaseUser>> {
  try {
    const sql = getSql();
    
    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${email} OR username = ${username}
    `;

    if (existingUser.length > 0) {
      return {
        success: false,
        error: {
          message: 'User already exists with this email or username',
          code: 'USER_EXISTS',
        },
      };
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert new user
    const newUser = await sql`
      INSERT INTO users (email, password_hash, username, full_name)
      VALUES (${email}, ${passwordHash}, ${username}, ${fullName})
      RETURNING id, email, username, full_name, created_at, updated_at
    `;

    return {
      success: true,
      data: newUser[0] as DatabaseUser,
    };
  } catch (error) {
    console.error('Create user error:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Database error',
        code: 'DATABASE_ERROR',
      },
    };
  }
}

// Authenticate user
export async function authenticateUser(email: string, password: string): Promise<AuthResult<DatabaseUser>> {
  try {
    const sql = getSql();
    
    // Find user by email
    const users = await sql`
      SELECT id, email, password_hash, username, full_name, created_at, updated_at
      FROM users WHERE email = ${email}
    `;

    if (users.length === 0) {
      return {
        success: false,
        error: {
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
        },
      };
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return {
        success: false,
        error: {
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
        },
      };
    }

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;

    return {
      success: true,
      data: userWithoutPassword as DatabaseUser,
    };
  } catch (error) {
    console.error('Authenticate user error:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Database error',
        code: 'DATABASE_ERROR',
      },
    };
  }
}

// Create session
export async function createSession(userId: number): Promise<AuthResult<string>> {
  try {
    const sql = getSql();
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await sql`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (${userId}, ${token}, ${expiresAt.toISOString()})
    `;

    return {
      success: true,
      data: token,
    };
  } catch (error) {
    console.error('Create session error:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Database error',
        code: 'DATABASE_ERROR',
      },
    };
  }
}

// Get user by session token
export async function getUserByToken(token: string): Promise<AuthResult<DatabaseUser>> {
  try {
    const sql = getSql();
    const sessions = await sql`
      SELECT u.id, u.email, u.username, u.full_name, u.created_at, u.updated_at
      FROM users u
      JOIN sessions s ON u.id = s.user_id
      WHERE s.token = ${token} AND s.expires_at > NOW()
    `;

    if (sessions.length === 0) {
      return {
        success: false,
        error: {
          message: 'Invalid or expired session',
          code: 'INVALID_SESSION',
        },
      };
    }

    return {
      success: true,
      data: sessions[0] as DatabaseUser,
    };
  } catch (error) {
    console.error('Get user by token error:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Database error',
        code: 'DATABASE_ERROR',
      },
    };
  }
}

// Delete session
export async function deleteSession(token: string): Promise<AuthResult<void>> {
  try {
    const sql = getSql();
    await sql`
      DELETE FROM sessions WHERE token = ${token}
    `;

    return {
      success: true,
    };
  } catch (error) {
    console.error('Delete session error:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Database error',
        code: 'DATABASE_ERROR',
      },
    };
  }
}

// Clean expired sessions
export async function cleanExpiredSessions(): Promise<void> {
  try {
    const sql = getSql();
    await sql`
      DELETE FROM sessions WHERE expires_at < NOW()
    `;
  } catch (error) {
    console.error('Clean expired sessions error:', error);
  }
}
