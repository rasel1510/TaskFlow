import type { Metadata } from 'next';
import ApiDocsView from '@/views/ApiDocsView';

export const metadata: Metadata = {
  title: 'FlowSync Developer Platform — REST API & MCP Server Documentation',
  description:
    'Comprehensive REST API reference, JSON-RPC 2.0 endpoints, authentication guide, and interactive playground for FlowSync.',
};

export default function DocsPage() {
  return <ApiDocsView />;
}

