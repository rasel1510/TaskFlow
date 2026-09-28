import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { users as mockUsers } from '@/data/mockData';
import { getAllStoredUsers } from '@/data/userStore';
import redisCache from '@/lib/redis';

export async function GET() {
  try {
    const mergedList = await redisCache.wrap('users:all', 120, async () => {
      let dbUsers: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        avatar: string;
        expertise?: string[];
      }> = [];

      try {
        dbUsers = await prisma.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
            expertise: true,
          },
          orderBy: { name: 'asc' },
        });
      } catch (dbErr) {
        console.warn('[GET /api/users] DB user fetch failed, fallback to store:', dbErr);
      }

      const storedUsers = getAllStoredUsers();

      // Merge users uniquely by email or id
      const userMap = new Map<string, { id: string; name: string; email: string; role: string; avatar: string; expertise?: string[] }>();

      // 1. Add mock users as base
      for (const u of mockUsers) {
        userMap.set(u.email.toLowerCase(), {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          avatar: u.avatar,
          expertise: (u as { expertise?: string[] }).expertise || [],
        });
      }

      // 2. Add local stored users
      for (const u of storedUsers) {
        const existing = userMap.get(u.email.toLowerCase());
        const userExpertise = ((u as { expertise?: string[] }).expertise?.length)
          ? (u as { expertise?: string[] }).expertise
          : existing?.expertise || [];
        userMap.set(u.email.toLowerCase(), {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          avatar: u.avatar,
          expertise: userExpertise,
        });
      }

      // 3. Add DB users (highest priority)
      for (const u of dbUsers) {
        const existing = userMap.get(u.email.toLowerCase());
        const userExpertise = (u.expertise && u.expertise.length > 0)
          ? u.expertise
          : existing?.expertise || [];
        userMap.set(u.email.toLowerCase(), {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          avatar: u.avatar,
          expertise: userExpertise,
        });
      }

      return Array.from(userMap.values());
    });

    return NextResponse.json(mergedList, {
      status: 200,
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=180' },
    });
  } catch (error) {
    console.error('[GET /api/users] Error:', error);
    return NextResponse.json(mockUsers, { status: 200 });
  }
}





