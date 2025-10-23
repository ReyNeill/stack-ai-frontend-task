import { ListKnowledgeBasesResponse, StackKnowledgeBaseSummary } from '@/lib/stack/types';

export interface KnowledgeBaseOption {
  id: string;
  name: string;
}

export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

export function isImageFile(fileName: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  return imageExtensions.includes(getFileExtension(fileName));
}

export function isVideoFile(fileName: string): boolean {
  const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
  return videoExtensions.includes(getFileExtension(fileName));
}

export function flattenKnowledgeBases(data?: ListKnowledgeBasesResponse): KnowledgeBaseOption[] {
  if (!data) return [];
  const segments: Array<keyof ListKnowledgeBasesResponse> = ['admin', 'editor', 'viewer'];
  const knowledgeBaseMap = new Map<string, KnowledgeBaseOption>();
  
  for (const key of segments) {
    const values = data[key];
    if (Array.isArray(values)) {
      for (const item of values) {
        // deduplicate by ID - a knowledge base may appear in multiple segments
        if (!knowledgeBaseMap.has(item.knowledge_base_id)) {
          knowledgeBaseMap.set(item.knowledge_base_id, {
            id: item.knowledge_base_id,
            name: item.name,
          });
        }
      }
    }
  }
  
  return Array.from(knowledgeBaseMap.values());
}

export function findKnowledgeBaseSummary(
  data: ListKnowledgeBasesResponse | undefined,
  knowledgeBaseId: string | undefined
): StackKnowledgeBaseSummary | undefined {
  if (!data || !knowledgeBaseId) return undefined;
  const segments: Array<keyof ListKnowledgeBasesResponse> = ['admin', 'editor', 'viewer'];

  for (const key of segments) {
    const values = data[key];
    if (!Array.isArray(values)) continue;
    const match = values.find((item) => item.knowledge_base_id === knowledgeBaseId);
    if (match) {
      return match;
    }
  }

  return undefined;
}

