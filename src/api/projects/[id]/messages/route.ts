import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireProjectAccess } from '@/lib/access';
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

function getOrCreateProjectMessages(projectId: string): ProjectMessage[] {
  if (!projectMessagesStore.has(projectId)) {
    projectMessagesStore.set(projectId, []);
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
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
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
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
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

    const senderId = (session?.user as { id?: string })?.id;
    if (!senderId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in to send messages.' },
        { status: 401 }
      );
    }

    const senderName = session?.user?.name || 'User';
    const senderEmail = session?.user?.email || '';
    const senderAvatar =
      (session?.user as { avatar?: string })?.avatar ||
      (session?.user?.name ? session.user.name.slice(0, 2).toUpperCase() : 'U');
    const senderRole = (session?.user as { role?: string })?.role || 'Member';

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
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const session = await auth();
    const currentUid = (session?.user as { id?: string })?.id;

    if (!currentUid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { messageId, emoji } = body;

    if (!messageId || !emoji) {
      return NextResponse.json({ success: false, error: 'messageId and emoji are required' }, { status: 400 });
    }

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
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json({ success: false, error: 'messageId query parameter is required' }, { status: 400 });
    }

    const session = await auth();
    const currentUid = (session?.user as { id?: string })?.id;
    const currentRole = (session?.user as { role?: string })?.role;

    if (!currentUid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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
