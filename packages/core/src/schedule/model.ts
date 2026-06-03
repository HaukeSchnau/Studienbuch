export interface Holiday {
  id: string;
  name: string;
  start: Date;
  end: Date;
}

export interface TimetableEntry {
  id: string;
  courseId: string;
  start: Date;
  duration: number;
}
