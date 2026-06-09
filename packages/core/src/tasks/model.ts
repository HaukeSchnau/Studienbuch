export interface TaskAttachment {
  id: string;
  label: string;
  color: string;
  uri?: string;
}

export interface Task {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: Date;
  done: boolean;
  attachments: TaskAttachment[];
}
