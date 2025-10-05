// Shared types for authentication system

export interface DatabaseUser {
  id: number;
  email: string;
  username: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface ClientUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
}

export interface AuthResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
}

// Helper function to convert database user to client user
export function convertDbUserToClientUser(dbUser: DatabaseUser): ClientUser {
  return {
    id: dbUser.id.toString(),
    email: dbUser.email,
    username: dbUser.username,
    fullName: dbUser.full_name,
  };
}
