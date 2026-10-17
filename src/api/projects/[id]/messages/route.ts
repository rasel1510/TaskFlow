import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { currentUser, users as mockUsers } from '@/data/mockData';
import { projectStreamBroker } from '@/lib/projectStreamBroker';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export interface ProjectMessage {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar: string;
  userRole?: string;
  content: string;
  imageUrl?: string | null;
  imageName?: string | null;
  imageSize?: number | null;
  createdAt: string;
  reactions?: Record<string, string[]>; // emoji -> array of userIds
}

// In-memory messages store keyed by projectId
const projectMessagesStore = new Map<string, ProjectMessage[]>();

// Seed initial realistic conversations for demo projects
function getOrCreateProjectMessages(projectId: string): ProjectMessage[] {
  if (!projectMessagesStore.has(projectId)) {
    const now = Date.now();
    const seed: ProjectMessage[] = [
      {
        id: `seed-msg-1-${projectId}`,
        projectId,
        userId: 'u2',
        userName: 'Sarah Chen',
        userEmail: 'sarah@flowsync.io',
        userAvatar: 'SC',
        userRole: 'Frontend Engineer',
        content: 'Hey team! Welcome to the project channel. All sprint discussions, deliverables, and assets can be shared directly here.',
        imageUrl: null,
        createdAt: new Date(now - 3600 * 1000 * 24 * 2).toISOString(),
        reactions: { '👋': ['u1', 'u3'], '🚀': ['u1'] },
      },
      {
        id: `seed-msg-2-${projectId}`,
        projectId,
        userId: 'u3',
        userName: 'Ahmed Malik',
        userEmail: 'ahmed@flowsync.io',
        userAvatar: 'AM',
        userRole: 'Backend Engineer',
        content: 'Database indexes and schema migrations for the core modules are finished and verified. Everything is ready for frontend integration.',
        imageUrl: null,
        createdAt: new Date(now - 3600 * 1000 * 18).toISOString(),
        reactions: { '🔥': ['u2'], '👍': ['u1'] },
      },
      {
        id: `seed-msg-3-${projectId}`,
        projectId,
        userId: 'u5',
        userName: 'Maria Lopez',
        userEmail: 'maria@flowsync.io',
        userAvatar: 'ML',
        userRole: 'UI Designer',
        content: 'Sharing the latest UI preview for the project workflow dashboard. Let me know if the component hierarchy looks solid!',
        imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
        imageName: 'analytics_dashboard_preview.png',
        imageSize: 421000,
        createdAt: new Date(now - 3600 * 1000 * 2).toISOString(),
        reactions: { '❤️': ['u1', 'u2', 'u3'], '🙌': ['u2'] },
      },
      {
        id: `seed-msg-4-${projectId}`,
        projectId,
        userId: 'u1',
        userName: 'Rasel Ahmed',
        userEmail: 'rasel@flowsync.io',
        userAvatar: 'RA',
        userRole: 'Project Manager',
        content: 'Looks awesome Maria! Great contrast and clean data density. Let\'s proceed with this design for the upcoming release.',
        imageUrl: null,
        createdAt: new Date(now - 1800 * 1000).toISOString(),
        reactions: { '🚀': ['u5'] },
      },
    ];
    projectMessagesStore.set(projectId, seed);
  }
  return projectMessagesStore.get(projectId)!;
}

/**
 * GET /api/projects/:id/messages
 * Retrieves all team messages for the given project.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    if (!projectId) {
      return NextResponse.json({ success: false, error: 'Project ID is required' }, { status: 400 });
    }

    const messages = getOrCreateProjectMessages(projectId);
    return NextResponse.json({
      success: true,
      data: messages,
      meta: { total: messages.length },
    });
  } catch (error) {
    console.error('[GET /api/projects/:id/messages] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to retrieve messages' }, { status: 500 });
  }
}

/**
 * POST /api/projects/:id/messages
 * Sends a new text message and/or image to the project channel.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    if (!projectId) {
      return NextResponse.json({ success: false, error: 'Project ID is required' }, { status: 400 });
    }

    const session = await auth();
    const body = await request.json();
    const { content, imageUrl, imageName, imageSize } = body;

    const trimmedContent = (content || '').trim();
    if (!trimmedContent && !imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Message must include text content or an image attachment.' },
        { status: 400 }
      );
    }

    // Determine sender identity from session or fallback
    const senderId = (session?.user as { id?: string })?.id || currentUser.id;
    const senderName = session?.user?.name || currentUser.name;
    const senderEmail = session?.user?.email || currentUser.email;
    const senderAvatar =
      (session?.user as { avatar?: string })?.avatar ||
      (senderName ? senderName.slice(0, 2).toUpperCase() : currentUser.avatar);
    const senderRole = (session?.user as { role?: string })?.role || currentUser.role;

    const newMessage: ProjectMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      projectId,
      userId: senderId,
      userName: senderName,
      userEmail: senderEmail,
      userAvatar: senderAvatar,
      userRole: senderRole,
      content: trimmedContent,
      imageUrl: imageUrl || null,
      imageName: imageName || (imageUrl ? 'image_attachment.png' : null),
      imageSize: imageSize || null,
      createdAt: new Date().toISOString(),
      reactions: {},
    };

    const messages = getOrCreateProjectMessages(projectId);
    messages.push(newMessage);

    // Broadcast in real-time to all connected project subscribers via SSE
    projectStreamBroker.publish(projectId, 'message:created', newMessage);

    return NextResponse.json({ success: true, data: newMessage }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/projects/:id/messages] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/:id/messages
 * Toggles an emoji reaction on an existing message.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const session = await auth();
    const body = await request.json();
    const { messageId, emoji } = body;

    if (!messageId || !emoji) {
      return NextResponse.json({ success: false, error: 'messageId and emoji are required' }, { status: 400 });
    }

    const currentUid = (session?.user as { id?: string })?.id || currentUser.id;
    const messages = getOrCreateProjectMessages(projectId);
    const target = messages.find(m => m.id === messageId);

    if (!target) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
    }

    if (!target.reactions) {
      target.reactions = {};
    }

    const userList = target.reactions[emoji] || [];
    if (userList.includes(currentUid)) {
      // Remove reaction
      target.reactions[emoji] = userList.filter(id => id !== currentUid);
      if (target.reactions[emoji].length === 0) {
        delete target.reactions[emoji];
      }
    } else {
      // Add reaction
      target.reactions[emoji] = [...userList, currentUid];
    }

    // Broadcast reaction change in real-time via SSE
    projectStreamBroker.publish(projectId, 'message:updated', target);

    return NextResponse.json({ success: true, data: target });
  } catch (error) {
    console.error('[PATCH /api/projects/:id/messages] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update reaction' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/:id/messages?messageId=...
 * Deletes a message if the caller is the author or a project manager.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json({ success: false, error: 'messageId query parameter is required' }, { status: 400 });
    }

    const session = await auth();
    const currentUid = (session?.user as { id?: string })?.id || currentUser.id;
    const currentRole = (session?.user as { role?: string })?.role || currentUser.role;

    const messages = getOrCreateProjectMessages(projectId);
    const index = messages.findIndex(m => m.id === messageId);

    if (index === -1) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
    }

    const targetMsg = messages[index];
    const isAuthor = targetMsg.userId === currentUid;
    const isManager = currentRole === 'Project Manager' || currentRole === 'Admin';

    if (!isAuthor && !isManager) {
      return NextResponse.json({ success: false, error: 'Forbidden: You can only delete your own messages.' }, { status: 403 });
    }

    messages.splice(index, 1);

    // Broadcast deletion in real-time via SSE
    projectStreamBroker.publish(projectId, 'message:deleted', { id: messageId });

    return NextResponse.json({ success: true, data: { id: messageId } });
  } catch (error) {
    console.error('[DELETE /api/projects/:id/messages] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete message' }, { status: 500 });
  }
}
