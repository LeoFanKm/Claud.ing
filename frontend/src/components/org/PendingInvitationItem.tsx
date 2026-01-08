import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Invitation } from "shared/types";
import { MemberRole } from "shared/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PendingInvitationItemProps {
  invitation: Invitation;
  onRevoke?: (invitationId: string) => void;
  isRevoking?: boolean;
}

export function PendingInvitationItem({
  invitation,
  onRevoke,
  isRevoking,
}: PendingInvitationItemProps) {
  const { t } = useTranslation("organization");

  const handleRevoke = () => {
    const confirmed = window.confirm(
      `Are you sure you want to revoke the invitation for ${invitation.email}? This action cannot be undone.`
    );
    if (confirmed) {
      onRevoke?.(invitation.id);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <div>
          <div className="font-medium text-sm">{invitation.email}</div>
          <div className="text-muted-foreground text-xs">
            {t("invitationList.invited", {
              date: new Date(invitation.created_at).toLocaleDateString(),
            })}
          </div>
        </div>
        <Badge
          variant={
            invitation.role === MemberRole.ADMIN ? "default" : "secondary"
          }
        >
          {t("roles." + invitation.role.toLowerCase())}
        </Badge>
        <Badge variant="outline">{t("invitationList.pending")}</Badge>
      </div>
      <Button
        disabled={isRevoking}
        onClick={handleRevoke}
        size="icon"
        title="Revoke invitation"
        variant="ghost"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
