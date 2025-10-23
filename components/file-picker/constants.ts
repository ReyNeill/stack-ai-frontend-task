import type { LucideIcon } from 'lucide-react';
import { Folder, Globe, Layers, Text } from 'lucide-react';
import { ParsedResource, ResourcePreview } from '@/lib/file-picker/types';
import { StackConnectionResource } from '@/lib/stack/types';

export type IntegrationItem =
  | { id: string; label: string; count?: number; type: 'icon'; icon: LucideIcon }
  | { id: string; label: string; count?: number; type: 'image'; src: string };

export const INTEGRATIONS: IntegrationItem[] = [
  { id: 'files', label: 'Files', count: 3, type: 'icon', icon: Folder },
  { id: 'websites', label: 'Websites', type: 'icon', icon: Globe },
  { id: 'text', label: 'Text', type: 'icon', icon: Text },
  { id: 'confluence', label: 'Confluence', type: 'icon', icon: Layers },
  { id: 'notion', label: 'Notion', type: 'image', src: '/icons/Notion.svg' },
  { id: 'google-drive', label: 'Google Drive', type: 'image', src: '/icons/google-drive.svg' },
  { id: 'onedrive', label: 'OneDrive', type: 'image', src: '/icons/Microsoft OneDrive.svg' },
  { id: 'sharepoint', label: 'SharePoint', type: 'image', src: '/icons/Microsoft SharePoint.svg' },
  { id: 'slack', label: 'Slack', type: 'image', src: '/icons/Slack.svg' },
];

export const PREFETCH_TOAST_CACHE = new Set<string>();
export const PREFETCH_COMPLETED_CACHE = new Set<string>();

function createStubStackResource(params: {
  id: string;
  fullPath: string;
  type: 'file' | 'directory';
  modifiedAt: string;
  size?: number;
  preview?: ResourcePreview;
}): StackConnectionResource {
  const { id, fullPath, type, modifiedAt, size, preview } = params;

  return {
    knowledge_base_id: '',
    created_at: modifiedAt,
    modified_at: modifiedAt,
    indexed_at: null,
    inode_type: type,
    resource_id: id,
    inode_path: { path: fullPath },
    dataloader_metadata: {
      last_modified_at: modifiedAt,
    },
    user_metadata: preview
      ? {
          preview,
        }
      : {},
    inode_id: null,
    content_hash: undefined,
    content_mime: undefined,
    size,
    status: 'resource',
  };
}

export const SAMPLE_LOCAL_FILES: ParsedResource[] = [
  {
    id: 'local-1',
    name: 'Team Photo.jpg',
    type: 'file',
    fullPath: '/Team Photo.jpg',
    size: 2458640,
    modifiedAt: '2024-01-15T10:30:00Z',
    status: 'not_indexed',
    raw: createStubStackResource({
      id: 'local-1',
      fullPath: '/Team Photo.jpg',
      type: 'file',
      modifiedAt: '2024-01-15T10:30:00Z',
      size: 2458640,
      preview: {
        type: 'image',
        src: '/Team Photo.jpg',
      },
    }),
    preview: {
      type: 'image',
      src: '/Team Photo.jpg',
    },
  },
  {
    id: 'local-2',
    name: 'readme.txt',
    type: 'file',
    fullPath: '/readme.txt',
    size: 8192,
    modifiedAt: '2024-01-20T09:00:00Z',
    status: 'not_indexed',
    raw: createStubStackResource({
      id: 'local-2',
      fullPath: '/readme.txt',
      type: 'file',
      modifiedAt: '2024-01-20T09:00:00Z',
      size: 8192,
      preview: {
        type: 'text',
        src: '/readme.txt',
      },
    }),
    preview: {
      type: 'text',
      src: '/readme.txt',
    },
  },
  {
    id: 'local-3',
    name: 'task-stack-ai-demo.mov',
    type: 'file',
    fullPath: '/task-stack-ai-demo.mov',
    size: 15728640,
    modifiedAt: '2024-01-19T13:30:00Z',
    status: 'not_indexed',
    raw: createStubStackResource({
      id: 'local-3',
      fullPath: '/task-stack-ai-demo.mov',
      type: 'file',
      modifiedAt: '2024-01-19T13:30:00Z',
      size: 15728640,
      preview: {
        type: 'video',
        src: '/task-stack-ai-demo.mov',
      },
    }),
    preview: {
      type: 'video',
      src: '/task-stack-ai-demo.mov',
    },
  },
];
