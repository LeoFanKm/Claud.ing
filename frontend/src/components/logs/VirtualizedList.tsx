import {
  type DataWithScrollModifier,
  type ScrollModifier,
  VirtuosoMessageList,
  VirtuosoMessageListLicense,
  type VirtuosoMessageListMethods,
  type VirtuosoMessageListProps,
} from "@virtuoso.dev/message-list";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TaskWithAttemptStatus } from "shared/types";
import { ApprovalFormProvider } from "@/contexts/ApprovalFormContext";
import { useEntries } from "@/contexts/EntriesContext";
import {
  type AddEntryType,
  type PatchTypeWithKey,
  useConversationHistory,
} from "@/hooks/useConversationHistory";
import type { WorkspaceWithSession } from "@/types/attempt";
import DisplayConversationEntry from "../NormalizedConversation/DisplayConversationEntry";

interface VirtualizedListProps {
  attempt: WorkspaceWithSession;
  task?: TaskWithAttemptStatus;
}

interface MessageListContext {
  attempt: WorkspaceWithSession;
  task?: TaskWithAttemptStatus;
}

const INITIAL_TOP_ITEM = { index: "LAST" as const, align: "end" as const };

const InitialDataScrollModifier: ScrollModifier = {
  type: "item-location",
  location: INITIAL_TOP_ITEM,
  purgeItemSizes: true,
};

const AutoScrollToBottom: ScrollModifier = {
  type: "auto-scroll-to-bottom",
  autoScroll: "smooth",
};

const ItemContent: VirtuosoMessageListProps<
  PatchTypeWithKey,
  MessageListContext
>["ItemContent"] = ({ data, context }) => {
  const attempt = context?.attempt;
  const task = context?.task;

  if (data.type === "STDOUT") {
    return <p>{data.content}</p>;
  }
  if (data.type === "STDERR") {
    return <p>{data.content}</p>;
  }
  if (data.type === "NORMALIZED_ENTRY" && attempt) {
    return (
      <DisplayConversationEntry
        entry={data.content}
        executionProcessId={data.executionProcessId}
        expansionKey={data.patchKey}
        task={task}
        taskAttempt={attempt}
      />
    );
  }

  return null;
};

const computeItemKey: VirtuosoMessageListProps<
  PatchTypeWithKey,
  MessageListContext
>["computeItemKey"] = ({ data }) => `l-${data.patchKey}`;

const VirtualizedList = ({ attempt, task }: VirtualizedListProps) => {
  const [channelData, setChannelData] =
    useState<DataWithScrollModifier<PatchTypeWithKey> | null>(null);
  const [loading, setLoading] = useState(true);
  const { setEntries, reset } = useEntries();

  useEffect(() => {
    setLoading(true);
    setChannelData(null);
    reset();
  }, [attempt.id, reset]);

  const onEntriesUpdated = (
    newEntries: PatchTypeWithKey[],
    addType: AddEntryType,
    newLoading: boolean
  ) => {
    let scrollModifier: ScrollModifier = InitialDataScrollModifier;

    if (addType === "running" && !loading) {
      scrollModifier = AutoScrollToBottom;
    }

    setChannelData({ data: newEntries, scrollModifier });
    setEntries(newEntries);

    if (loading) {
      setLoading(newLoading);
    }
  };

  useConversationHistory({ attempt, onEntriesUpdated });

  const messageListRef = useRef<VirtuosoMessageListMethods | null>(null);
  const messageListContext = useMemo(
    () => ({ attempt, task }),
    [attempt, task]
  );

  return (
    <ApprovalFormProvider>
      <VirtuosoMessageListLicense
        licenseKey={import.meta.env.VITE_PUBLIC_REACT_VIRTUOSO_LICENSE_KEY}
      >
        <VirtuosoMessageList<PatchTypeWithKey, MessageListContext>
          className="flex-1"
          computeItemKey={computeItemKey}
          context={messageListContext}
          data={channelData}
          Footer={() => <div className="h-2" />}
          Header={() => <div className="h-2" />}
          ItemContent={ItemContent}
          initialLocation={INITIAL_TOP_ITEM}
          ref={messageListRef}
        />
      </VirtuosoMessageListLicense>
      {loading && (
        <div className="top-0 left-0 float-left flex h-full w-full flex-col items-center justify-center gap-2 bg-primary">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Loading History</p>
        </div>
      )}
    </ApprovalFormProvider>
  );
};

export default VirtualizedList;
