/**
 * @file index.ts
 * @description ProjectTasks module exports
 *
 * @position pages/ProjectTasks
 */

export type { KanbanSectionProps } from "./KanbanSection";

// Sub-components
export { KanbanSection } from "./KanbanSection";
// Main page component
export {
  ProjectTasksPage,
  ProjectTasksPage as ProjectTasks,
} from "./ProjectTasksPage";
export type { TaskDetailSectionProps } from "./TaskDetailSection";
export {
  TaskDetailContent,
  TaskDetailHeader,
  TaskDetailSection,
} from "./TaskDetailSection";
export type {
  KanbanColumnItem,
  ProjectTasksActions,
  ProjectTasksState,
  SharedTaskRecord,
  Task,
  TaskStatus,
} from "./useProjectTasksState";
// State management
export {
  normalizeStatus,
  TASK_STATUSES,
  useProjectTasksState,
} from "./useProjectTasksState";
