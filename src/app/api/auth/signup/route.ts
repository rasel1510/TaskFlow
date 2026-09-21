import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { users as mockUsers } from '@/data/mockData';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function POST(req: Request) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: 'Invalid JSON request payload' },
        { status: 400 }
      );
    }
    const { name, email, password, role } = body || {};

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const userRole = role?.trim() || 'User';
    const avatar = getInitials(name);
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      // Check existing user in Prisma
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        return NextResponse.json(
          { message: 'An account with this email already exists' },
          { status: 409 }
        );
      }

      // Create user in database
      const newUser = await prisma.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role: userRole,
          avatar,
        },
      });

      return NextResponse.json(
        {
          message: 'Account created successfully',
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            avatar: newUser.avatar,
          },
        },
        { status: 201 }
      );
    } catch (dbError) {
      console.warn('Prisma database unavailable for signup, using simulated response:', dbError);

      // Check if email conflicts with seeded mock users
      const existingMock = mockUsers.find(
        u => u.email.toLowerCase() === normalizedEmail
      );
      if (existingMock) {
        return NextResponse.json(
          { message: 'An account with this email already exists' },
          { status: 409 }
        );
      }

      // Simulated created user for offline demo
      const simulatedUser = {
        id: `user-${Date.now()}`,
        name: name.trim(),
        email: normalizedEmail,
        role: userRole,
        avatar,
      };

      return NextResponse.json(
        {
          message: 'Account created successfully (demo mode)',
          user: simulatedUser,
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { message: 'Internal server error while processing signup' },
      { status: 500 }
    );
  }
}
