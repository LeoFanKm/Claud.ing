import type { ReactNode } from "react";
import { UserAvatar } from "./UserAvatar";

interface HeaderAvatar {
  firstName?: string;
  lastName?: string;
  username?: string;
  imageUrl?: string;
}

interface TaskCardHeaderProps {
  title: ReactNode;
  avatar?: HeaderAvatar;
  right?: ReactNode;
  className?: string;
  titleClassName?: string;
}

export function TaskCardHeader({
  title,
  avatar,
  right,
  className,
  titleClassName,
}: TaskCardHeaderProps) {
  return (
    <div className={`flex min-w-0 items-start gap-3 ${className ?? ""}`}>
      <h4
        className={`line-clamp-2 min-w-0 flex-1 font-light text-sm ${titleClassName ?? ""}`}
      >
        {avatar ? (
          <UserAvatar
            className="mr-2 inline-flex h-5 w-5 align-middle"
            firstName={avatar.firstName}
            imageUrl={avatar.imageUrl}
            lastName={avatar.lastName}
            username={avatar.username}
          />
        ) : null}
        <span className="align-middle">{title}</span>
      </h4>
      {right ? (
        <div className="flex shrink-0 items-center gap-1">{right}</div>
      ) : null}
    </div>
  );
}
