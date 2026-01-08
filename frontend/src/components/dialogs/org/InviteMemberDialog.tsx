import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MemberRole } from "shared/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganizationMutations } from "@/hooks/useOrganizationMutations";
import { defineModal } from "@/lib/modals";

export type InviteMemberResult = {
  action: "invited" | "canceled";
};

export interface InviteMemberDialogProps {
  organizationId: string;
}

const InviteMemberDialogImpl = NiceModal.create<InviteMemberDialogProps>(
  (props) => {
    const modal = useModal();
    const { organizationId } = props;
    const { t } = useTranslation("organization");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<MemberRole>(MemberRole.MEMBER);
    const [error, setError] = useState<string | null>(null);

    const { createInvitation } = useOrganizationMutations({
      onInviteSuccess: () => {
        modal.resolve({ action: "invited" } as InviteMemberResult);
        modal.hide();
      },
      onInviteError: (err) => {
        setError(
          err instanceof Error ? err.message : "Failed to send invitation"
        );
      },
    });

    useEffect(() => {
      // Reset form when dialog opens
      if (modal.visible) {
        setEmail("");
        setRole(MemberRole.MEMBER);
        setError(null);
      }
    }, [modal.visible]);

    const validateEmail = (value: string): string | null => {
      const trimmedValue = value.trim();
      if (!trimmedValue) return "Email is required";

      // Basic email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedValue)) {
        return "Please enter a valid email address";
      }

      return null;
    };

    const handleInvite = () => {
      const emailError = validateEmail(email);
      if (emailError) {
        setError(emailError);
        return;
      }

      if (!organizationId) {
        setError("No organization selected");
        return;
      }

      setError(null);
      createInvitation.mutate({
        orgId: organizationId,
        data: {
          email: email.trim(),
          role,
        },
      });
    };

    const handleCancel = () => {
      modal.resolve({ action: "canceled" } as InviteMemberResult);
      modal.hide();
    };

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        handleCancel();
      }
    };

    return (
      <Dialog onOpenChange={handleOpenChange} open={modal.visible}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("inviteDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("inviteDialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">
                {t("inviteDialog.emailLabel")}
              </Label>
              <Input
                autoFocus
                disabled={createInvitation.isPending}
                id="invite-email"
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder={t("inviteDialog.emailPlaceholder")}
                type="email"
                value={email}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">{t("inviteDialog.roleLabel")}</Label>
              <Select
                disabled={createInvitation.isPending}
                onValueChange={(value) => setRole(value as MemberRole)}
                value={role}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue
                    placeholder={t("inviteDialog.rolePlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MemberRole.MEMBER}>
                    {t("roles.member")}
                  </SelectItem>
                  <SelectItem value={MemberRole.ADMIN}>
                    {t("roles.admin")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {t("inviteDialog.roleHelper")}
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              disabled={createInvitation.isPending}
              onClick={handleCancel}
              variant="outline"
            >
              {t("common:buttons.cancel")}
            </Button>
            <Button
              disabled={!email.trim() || createInvitation.isPending}
              onClick={handleInvite}
            >
              {createInvitation.isPending
                ? t("inviteDialog.sending")
                : t("inviteDialog.sendButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

export const InviteMemberDialog = defineModal<
  InviteMemberDialogProps,
  InviteMemberResult
>(InviteMemberDialogImpl);
