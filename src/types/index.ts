export type TaskType = 'pre' | 'main';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'superseded';
export type MediaType = 'photo' | 'video' | 'video_note' | 'media_group' | null;
export type PointsReason = 'task_approved' | 'manual' | `promo:${string}`;


export interface User {
  id: number;
  username: string | null;
  first_name: string | null;
  joined_channel_at: string | null;
  total_points: number;
  last_points_at: string | null;
  onboarding_step: number;
  created_at: string;
}

export interface Admin {
  id: number;
  added_at: string;
}

export interface Task {
  id: number;
  type: TaskType;
  label: string;
  description: string;
  channel_post_link: string;
  channel_message_id: number;
  discussion_message_id: number | null;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
}

export interface Submission {
  id: number;
  task_id: number;
  user_id: number;
  comment_message_id: number;
  comment_text: string;
  status: SubmissionStatus;
  points_awarded: number | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  admin_feedback: string | null;
  submitted_at: string;
}

export interface PointsLedgerEntry {
  id: number;
  user_id: number;
  points: number;
  reason: string;
  related_submission_id: number | null;
  related_task_id: number | null;
  admin_id: number | null;
  created_at: string;
}

export interface OnboardingMessage {
  id: number;
  step_order: number;
  text: string;
  delay_seconds: number;
  media_type: MediaType;
  media_file_id: string | null;
  /** JSON-массив относительных путей, напр. ["assets/onboarding/msg1.png"] */
  local_media_paths: string | null;
  button_text: string | null;
  button_url: string | null;
  only_if_not_joined: boolean;
  created_at: string;
}

export interface AppSettings {
  id: boolean;
  marathon_start_at: string;
  channel_id: number;
  discussion_group_id: number;
  channel_invite_link: string | null;
}

export interface RankedUser {
  id: number;
  username: string | null;
  first_name: string | null;
  total_points: number;
  rank: number;
}
