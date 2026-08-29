import type { Message } from 'grammy/types';

export interface SubmissionMedia {
  media_type: 'photo' | 'video' | 'document';
  media_file_id: string;
}

/** Берём file_id из фото / видео / документа в комментарии участника */
export function extractSubmissionMedia(message: Message): SubmissionMedia | null {
  if (message.photo?.length) {
    const photo = message.photo[message.photo.length - 1];
    return { media_type: 'photo', media_file_id: photo.file_id };
  }
  if (message.video) {
    return { media_type: 'video', media_file_id: message.video.file_id };
  }
  if (message.document) {
    return { media_type: 'document', media_file_id: message.document.file_id };
  }
  return null;
}
