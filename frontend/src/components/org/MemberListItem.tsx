import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MemberRole, OrganizationMemberWithProfile } from "shared/types";
import { MemberRole as MemberRoleEnum } from "shared/types";
import { UserAvatar } from "@/components/tasks/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MemberListItemProps {
  member: OrganizationMemberWithProfile;
  currentUserId: string | null;
  isAdmin: boolean;
  onRemove: (userId: string) => void;
  onRoleChange: (userId: string, role: MemberRole) => void;
  isRemoving: boolean;
  isRoleChanging: boolean;
}

export function MemberListItem({
  member,
  currentUserId,
  isAdmin,
  onRemove,
  onRoleChange,
  isRemoving,
  isRoleChanging,
}: MemberListItemProps) {
  const { t } = useTranslation("organization");
  const isSelf = member.user_id === currentUserId;
  const canRemove = isAdmin && !isSelf;
  const canChangeRole = isAdmin && !isSelf;

  const displayName = member.username || member.user_id;
  const fullName = [member.first_name, member.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <UserAvatar
          className="h-8 w-8"
          firstName={member.first_name}
          imageUrl={member.avatar_url}
          lastName={member.last_name}
          username={member.username}
        />
        <div>
          <div className="font-medium text-sm">{fullName || displayName}</div>
          {fullName && member.username && (
            <div className="text-muted-foreground text-xs">
              @{member.username}
            </div>
          )}
          {isSelf && (
            <div className="text-muted-foreground text-xs">
              {t("memberList.you")}
            </div>
          )}
        </div>
        <Badge
          variant={
            member.role === MemberRoleEnum.ADMIN ? "default" : "secondary"
          }
        >
          {t("roles." + member.role.toLowerCase())}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        {canChangeRole && (
          <Select
            disabled={isRoleChanging}
            onValueChange={(value) =>
              onRoleChange(member.user_id, value as MemberRole)
            }
            value={member.role}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MemberRoleEnum.ADMIN}>
                {t("roles.admin")}
              </SelectItem>
              <SelectItem value={MemberRoleEnum.MEMBER}>
                {t("roles.member")}
              </SelectItem>
            </SelectContent>
          </Select>
        )}
        {canRemove && (
          <Button
            disabled={isRemoving}
            onClick={() => onRemove(member.user_id)}
            size="sm"
            variant="ghost"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}
