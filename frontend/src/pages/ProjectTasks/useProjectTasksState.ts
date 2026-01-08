import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { TaskStatus, TaskWithAttemptStatus } from "shared/types";
import type { KanbanColumnItem } from "@/components/tasks/TaskKanbanBoard";
import type { DragEndEvent } from "@/components/ui/shadcn-io/kanban";
import { useProject } from "@/contexts/ProjectContext";
import { useSearch } from "@/contexts/SearchContext";
import { useAuth } from "@/hooks";
import {
  type SharedTaskRecord,
  useProjectTasks,
} from "@/hooks/useProjectTasks";
import { tasksApi } from "@/lib/api";
import { paths } from "@/lib/paths";
import type { ConnectionState } from "@/types/connection";

type Task = TaskWithAttemptStatus;

const TASK_STATUSES = [
  "todo",
  "inprogress",
  "inreview",
  "done",
  "cancelled",
] as const;

const normalizeStatus = (status: string): TaskStatus =>
  status.toLowerCase() as TaskStatus;

export interface ProjectTasksState {
  // Core data
  tasks: Task[];
  tasksById: Record<string, Task>;
  sharedTasksById: Record<string, SharedTaskRecord>;
  sharedOnlyByStatus: Record<TaskStatus, SharedTaskRecord[]>;
  isLoading: boolean;
  streamError: string | null;

  // Connection state
  connection: ConnectionState;
  reconnectCountdown: number | null;
  reconnect: () => void;

  // Selection state
  selectedTask: Task | null;
  selectedSharedTask: SharedTaskRecord | null;
  selectedSharedTaskId: string | null;
  setSelectedSharedTaskId: (id: string | null) => void;

  // Derived panel state
  isTaskPanelOpen: boolean;
  isSharedPanelOpen: boolean;
  isPanelOpen: boolean;

  // Filtered/computed data
  kanbanColumns: Record<TaskStatus, KanbanColumnItem[]>;
  visibleTasksByStatus: Record<TaskStatus, Task[]>;
  hasVisibleLocalTasks: boolean;
  hasVisibleSharedTasks: boolean;
  hasSharedTasks: boolean;

  // Filter state
  showSharedTasks: boolean;
  hasSearch: boolean;

  // Context
  projectId: string | undefined;
  taskId: string | undefined;
  userId: string | null;
}

export interface ProjectTasksActions {
  handleViewTaskDetails: (task: Task, attemptIdToShow?: string) => void;
  handleViewSharedTask: (sharedTask: SharedTaskRecord) => void;
  handleClosePanel: () => void;
  handleCreateTask: () => void;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;

  // Navigation
  selectNextTask: () => void;
  selectPreviousTask: () => void;
  selectNextColumn: () => void;
  selectPreviousColumn: () => void;
  navigateWithSearch: (
    pathname: string,
    options?: { replace?: boolean }
  ) => void;

  // Utilities
  getSharedTask: (
    task: Task | null | undefined
  ) => SharedTaskRecord | undefined;
}

export function useProjectTasksState(): {
  state: ProjectTasksState;
  actions: ProjectTasksActions;
} {
  const { taskId } = useParams<{
    projectId: string;
    taskId?: string;
    attemptId?: string;
  }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userId } = useAuth();
  const { query: searchQuery } = useSearch();

  const { projectId } = useProject();

  const [selectedSharedTaskId, setSelectedSharedTaskId] = useState<
    string | null
  >(null);

  const projectTasksResult = useProjectTasks(projectId || "");
  const {
    tasks,
    tasksById,
    sharedTasksById,
    sharedOnlyByStatus,
    isLoading,
    error: streamError,
    connection,
    reconnectCountdown,
    reconnect,
  } = projectTasksResult;

  // Clear shared task selection when local task is selected
  useEffect(() => {
    if (taskId) {
      setSelectedSharedTaskId(null);
    }
  }, [taskId]);

  const selectedTask = useMemo(
    () => (taskId ? (tasksById[taskId] ?? null) : null),
    [taskId, tasksById]
  );

  const selectedSharedTask = useMemo(() => {
    if (!selectedSharedTaskId) return null;
    return sharedTasksById[selectedSharedTaskId] ?? null;
  }, [selectedSharedTaskId, sharedTasksById]);

  const isTaskPanelOpen = Boolean(taskId && selectedTask);
  const isSharedPanelOpen = Boolean(selectedSharedTask);
  const isPanelOpen = isTaskPanelOpen || isSharedPanelOpen;

  const hasSearch = Boolean(searchQuery.trim());
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const showSharedTasks = searchParams.get("shared") !== "off";

  // Hide shared task when filter is off (unless assigned to current user)
  useEffect(() => {
    if (showSharedTasks) return;
    if (!selectedSharedTaskId) return;
    const sharedTask = sharedTasksById[selectedSharedTaskId];
    if (sharedTask && sharedTask.assignee_user_id === userId) {
      return;
    }
    setSelectedSharedTaskId(null);
  }, [selectedSharedTaskId, sharedTasksById, showSharedTasks, userId]);

  const kanbanColumns = useMemo(() => {
    const columns: Record<TaskStatus, KanbanColumnItem[]> = {
      todo: [],
      inprogress: [],
      inreview: [],
      done: [],
      cancelled: [],
    };

    const matchesSearch = (
      title: string,
      description?: string | null
    ): boolean => {
      if (!hasSearch) return true;
      const lowerTitle = title.toLowerCase();
      const lowerDescription = description?.toLowerCase() ?? "";
      return (
        lowerTitle.includes(normalizedSearch) ||
        lowerDescription.includes(normalizedSearch)
      );
    };

    tasks.forEach((task) => {
      const statusKey = normalizeStatus(task.status);
      const sharedTask = task.shared_task_id
        ? sharedTasksById[task.shared_task_id]
        : sharedTasksById[task.id];

      if (!matchesSearch(task.title, task.description)) {
        return;
      }

      const isSharedAssignedElsewhere =
        !showSharedTasks &&
        !!sharedTask &&
        !!sharedTask.assignee_user_id &&
        sharedTask.assignee_user_id !== userId;

      if (isSharedAssignedElsewhere) {
        return;
      }

      columns[statusKey].push({
        type: "task",
        task,
        sharedTask,
      });
    });

    (
      Object.entries(sharedOnlyByStatus) as [TaskStatus, SharedTaskRecord[]][]
    ).forEach(([status, items]) => {
      if (!columns[status]) {
        columns[status] = [];
      }
      items.forEach((sharedTask) => {
        if (!matchesSearch(sharedTask.title, sharedTask.description)) {
          return;
        }
        const shouldIncludeShared =
          showSharedTasks || sharedTask.assignee_user_id === userId;
        if (!shouldIncludeShared) {
          return;
        }
        columns[status].push({
          type: "shared",
          task: sharedTask,
        });
      });
    });

    const getTimestamp = (item: KanbanColumnItem) => {
      const createdAt =
        item.type === "task" ? item.task.created_at : item.task.created_at;
      return new Date(createdAt).getTime();
    };

    TASK_STATUSES.forEach((status) => {
      columns[status].sort((a, b) => getTimestamp(b) - getTimestamp(a));
    });

    return columns;
  }, [
    hasSearch,
    normalizedSearch,
    tasks,
    sharedOnlyByStatus,
    sharedTasksById,
    showSharedTasks,
    userId,
  ]);

  const visibleTasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      todo: [],
      inprogress: [],
      inreview: [],
      done: [],
      cancelled: [],
    };

    TASK_STATUSES.forEach((status) => {
      map[status] = kanbanColumns[status]
        .filter((item) => item.type === "task")
        .map((item) => item.task);
    });

    return map;
  }, [kanbanColumns]);

  const hasVisibleLocalTasks = useMemo(
    () =>
      Object.values(visibleTasksByStatus).some(
        (items) => items && items.length > 0
      ),
    [visibleTasksByStatus]
  );

  const hasVisibleSharedTasks = useMemo(
    () =>
      Object.values(kanbanColumns).some((items) =>
        items.some((item) => item.type === "shared")
      ),
    [kanbanColumns]
  );

  const hasSharedTasks = useMemo(() => {
    return Object.values(kanbanColumns).some((items) =>
      items.some((item) => {
        if (item.type === "shared") return true;
        return Boolean(item.sharedTask);
      })
    );
  }, [kanbanColumns]);

  // ==================== Actions ====================

  const navigateWithSearch = useCallback(
    (pathname: string, options?: { replace?: boolean }) => {
      const search = searchParams.toString();
      navigate({ pathname, search: search ? `?${search}` : "" }, options);
    },
    [navigate, searchParams]
  );

  const handleClosePanel = useCallback(() => {
    if (projectId) {
      navigate(`/projects/${projectId}/tasks`, { replace: true });
    }
  }, [projectId, navigate]);

  const handleViewTaskDetails = useCallback(
    (task: Task, attemptIdToShow?: string) => {
      if (!projectId) return;
      setSelectedSharedTaskId(null);

      if (attemptIdToShow) {
        navigateWithSearch(paths.attempt(projectId, task.id, attemptIdToShow));
      } else {
        navigateWithSearch(`${paths.task(projectId, task.id)}/attempts/latest`);
      }
    },
    [projectId, navigateWithSearch]
  );

  const handleViewSharedTask = useCallback(
    (sharedTask: SharedTaskRecord) => {
      setSelectedSharedTaskId(sharedTask.id);
      if (projectId) {
        navigateWithSearch(paths.projectTasks(projectId), { replace: true });
      }
    },
    [navigateWithSearch, projectId]
  );

  const handleCreateTask = useCallback(() => {
    // Note: This is a placeholder - actual implementation uses openTaskForm
    // which needs to be called from the component level
  }, []);

  const selectNextTask = useCallback(() => {
    if (selectedTask) {
      const statusKey = normalizeStatus(selectedTask.status);
      const tasksInStatus = visibleTasksByStatus[statusKey] || [];
      const currentIndex = tasksInStatus.findIndex(
        (task) => task.id === selectedTask.id
      );
      if (currentIndex >= 0 && currentIndex < tasksInStatus.length - 1) {
        handleViewTaskDetails(tasksInStatus[currentIndex + 1]);
      }
    } else {
      for (const status of TASK_STATUSES) {
        const tasks = visibleTasksByStatus[status];
        if (tasks && tasks.length > 0) {
          handleViewTaskDetails(tasks[0]);
          break;
        }
      }
    }
  }, [selectedTask, visibleTasksByStatus, handleViewTaskDetails]);

  const selectPreviousTask = useCallback(() => {
    if (selectedTask) {
      const statusKey = normalizeStatus(selectedTask.status);
      const tasksInStatus = visibleTasksByStatus[statusKey] || [];
      const currentIndex = tasksInStatus.findIndex(
        (task) => task.id === selectedTask.id
      );
      if (currentIndex > 0) {
        handleViewTaskDetails(tasksInStatus[currentIndex - 1]);
      }
    } else {
      for (const status of TASK_STATUSES) {
        const tasks = visibleTasksByStatus[status];
        if (tasks && tasks.length > 0) {
          handleViewTaskDetails(tasks[0]);
          break;
        }
      }
    }
  }, [selectedTask, visibleTasksByStatus, handleViewTaskDetails]);

  const selectNextColumn = useCallback(() => {
    if (selectedTask) {
      const currentStatus = normalizeStatus(selectedTask.status);
      const currentIndex = TASK_STATUSES.findIndex(
        (status) => status === currentStatus
      );
      for (let i = currentIndex + 1; i < TASK_STATUSES.length; i++) {
        const tasks = visibleTasksByStatus[TASK_STATUSES[i]];
        if (tasks && tasks.length > 0) {
          handleViewTaskDetails(tasks[0]);
          return;
        }
      }
    } else {
      for (const status of TASK_STATUSES) {
        const tasks = visibleTasksByStatus[status];
        if (tasks && tasks.length > 0) {
          handleViewTaskDetails(tasks[0]);
          break;
        }
      }
    }
  }, [selectedTask, visibleTasksByStatus, handleViewTaskDetails]);

  const selectPreviousColumn = useCallback(() => {
    if (selectedTask) {
      const currentStatus = normalizeStatus(selectedTask.status);
      const currentIndex = TASK_STATUSES.findIndex(
        (status) => status === currentStatus
      );
      for (let i = currentIndex - 1; i >= 0; i--) {
        const tasks = visibleTasksByStatus[TASK_STATUSES[i]];
        if (tasks && tasks.length > 0) {
          handleViewTaskDetails(tasks[0]);
          return;
        }
      }
    } else {
      for (const status of TASK_STATUSES) {
        const tasks = visibleTasksByStatus[status];
        if (tasks && tasks.length > 0) {
          handleViewTaskDetails(tasks[0]);
          break;
        }
      }
    }
  }, [selectedTask, visibleTasksByStatus, handleViewTaskDetails]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!(over && active.data.current)) return;

      const draggedTaskId = active.id as string;
      const newStatus = over.id as Task["status"];
      const task = tasksById[draggedTaskId];
      if (!task || task.status === newStatus) return;

      try {
        await tasksApi.update(draggedTaskId, {
          title: task.title,
          description: task.description,
          status: newStatus,
          parent_workspace_id: task.parent_workspace_id,
          image_ids: null,
        });
      } catch (err) {
        console.error("Failed to update task status:", err);
      }
    },
    [tasksById]
  );

  const getSharedTask = useCallback(
    (task: Task | null | undefined) => {
      if (!task) return undefined;
      if (task.shared_task_id) {
        return sharedTasksById[task.shared_task_id];
      }
      return sharedTasksById[task.id];
    },
    [sharedTasksById]
  );

  return {
    state: {
      tasks,
      tasksById,
      sharedTasksById,
      sharedOnlyByStatus,
      isLoading,
      streamError: streamError ?? null,
      connection,
      reconnectCountdown,
      reconnect,
      selectedTask,
      selectedSharedTask,
      selectedSharedTaskId,
      setSelectedSharedTaskId,
      isTaskPanelOpen,
      isSharedPanelOpen,
      isPanelOpen,
      kanbanColumns,
      visibleTasksByStatus,
      hasVisibleLocalTasks,
      hasVisibleSharedTasks,
      hasSharedTasks,
      showSharedTasks,
      hasSearch,
      projectId,
      taskId,
      userId,
    },
    actions: {
      handleViewTaskDetails,
      handleViewSharedTask,
      handleClosePanel,
      handleCreateTask,
      handleDragEnd,
      selectNextTask,
      selectPreviousTask,
      selectNextColumn,
      selectPreviousColumn,
      navigateWithSearch,
      getSharedTask,
    },
  };
}

// Re-export types for convenience
export type { Task, SharedTaskRecord, TaskStatus, KanbanColumnItem };
export { TASK_STATUSES, normalizeStatus };
