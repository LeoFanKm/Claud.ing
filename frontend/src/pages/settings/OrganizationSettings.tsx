import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MemberRole } from "shared/types";
import { MemberRole as MemberRoleEnum } from "shared/types";
import { useUserSystem } from "@/components/ConfigProvider";
import type {
  CreateOrganizationResult,
  InviteMemberResult,
} from "@/components/dialogs";
import { CreateOrganizationDialog } from "@/components/dialogs/org/CreateOrganizationDialog";
import { InviteMemberDialog } from "@/components/dialogs/org/InviteMemberDialog";
import { LoginRequiredPrompt } from "@/components/dialogs/shared/LoginRequiredPrompt";
import { MemberListItem } from "@/components/org/MemberListItem";
import { PendingInvitationItem } from "@/components/org/PendingInvitationItem";
import { RemoteProjectItem } from "@/components/org/RemoteProjectItem";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/auth/useAuth";
import { useOrganizationInvitations } from "@/hooks/useOrganizationInvitations";
import { useOrganizationMembers } from "@/hooks/useOrganizationMembers";
import { useOrganizationMutations } from "@/hooks/useOrganizationMutations";
import { useOrganizationProjects } from "@/hooks/useOrganizationProjects";
import { useOrganizationSelection } from "@/hooks/useOrganizationSelection";
import { useProjectMutations } from "@/hooks/useProjectMutations";
import { useProjects } from "@/hooks/useProjects";
import { useUserOrganizations } from "@/hooks/useUserOrganizations";

export function OrganizationSettings() {
  const { t } = useTranslation("organization");
  const { loginStatus } = useUserSystem();
  const { isSignedIn, isLoaded } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch all organizations
  const {
    data: orgsResponse,
    isLoading: orgsLoading,
    error: orgsError,
    refetch: refetchOrgs,
  } = useUserOrganizations();

  // Organization selection with URL sync
  const { selectedOrgId, selectedOrg, handleOrgSelect } =
    useOrganizationSelection({
      organizations: orgsResponse,
      onSelectionChange: () => {
        setSuccess(null);
        setError(null);
      },
    });

  // Get current user's role and ID
  const currentUserRole = selectedOrg?.user_role;
  const isAdmin = currentUserRole === MemberRoleEnum.ADMIN;
  const isPersonalOrg = selectedOrg?.is_personal ?? false;
  const currentUserId =
    loginStatus?.status === "loggedin" ? loginStatus.profile.user_id : null;

  // Fetch members using query hook
  const { data: members = [], isLoading: loadingMembers } =
    useOrganizationMembers(selectedOrgId);

  // Fetch invitations using query hook (admin only)
  const { data: invitations = [], isLoading: loadingInvitations } =
    useOrganizationInvitations({
      organizationId: selectedOrgId || null,
      isAdmin,
      isPersonal: isPersonalOrg,
    });

  // Organization mutations
  const {
    removeMember,
    updateMemberRole,
    revokeInvitation,
    deleteOrganization,
  } = useOrganizationMutations({
    onRevokeSuccess: () => {
      setSuccess("Invitation revoked successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
    onRevokeError: (err) => {
      setError(
        err instanceof Error ? err.message : "Failed to revoke invitation"
      );
    },
    onRemoveSuccess: () => {
      setSuccess("Member removed successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
    onRemoveError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    },
    onRoleChangeSuccess: () => {
      setSuccess("Member role updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
    onRoleChangeError: (err) => {
      setError(
        err instanceof Error ? err.message : "Failed to update member role"
      );
    },
    onDeleteSuccess: async () => {
      setSuccess(t("settings.deleteSuccess"));
      setTimeout(() => setSuccess(null), 3000);
      // Refetch organizations and switch to personal org
      await refetchOrgs();
      if (orgsResponse?.organizations) {
        const personalOrg = orgsResponse.organizations.find(
          (org) => org.is_personal
        );
        if (personalOrg) {
          handleOrgSelect(personalOrg.id);
        }
      }
    },
    onDeleteError: (err) => {
      setError(err instanceof Error ? err.message : t("settings.deleteError"));
    },
  });

  // Fetch all local projects
  const { projects: allProjects = [], isLoading: loadingProjects } =
    useProjects();

  // Fetch remote projects for the selected organization
  const { data: remoteProjects = [], isLoading: loadingRemoteProjects } =
    useOrganizationProjects(selectedOrgId);

  // Calculate available local projects (not linked to any remote project)
  const availableLocalProjects = allProjects.filter(
    (project) => !project.remote_project_id
  );

  // Project mutations
  const { linkToExisting, unlinkProject } = useProjectMutations({
    onLinkSuccess: () => {
      setSuccess("Project linked successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
    onLinkError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to link project");
    },
    onUnlinkSuccess: () => {
      setSuccess("Project unlinked successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
    onUnlinkError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to unlink project");
    },
  });

  const handleCreateOrganization = async () => {
    try {
      const result: CreateOrganizationResult =
        await CreateOrganizationDialog.show();

      if (result.action === "created" && result.organizationId) {
        // No need to refetch - the mutation hook handles cache invalidation
        handleOrgSelect(result.organizationId ?? "");
        setSuccess("Organization created successfully");
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      // Dialog error
    }
  };

  const handleInviteMember = async () => {
    if (!selectedOrgId) return;

    try {
      const result: InviteMemberResult = await InviteMemberDialog.show({
        organizationId: selectedOrgId,
      });

      if (result.action === "invited") {
        // No need to refetch - the mutation hook handles cache invalidation
        setSuccess("Member invited successfully");
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      // Dialog error
    }
  };

  const handleRevokeInvitation = (invitationId: string) => {
    if (!selectedOrgId) return;

    setError(null);
    revokeInvitation.mutate({ orgId: selectedOrgId, invitationId });
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedOrgId) return;

    const confirmed = window.confirm(t("confirmRemoveMember"));
    if (!confirmed) return;

    setError(null);
    removeMember.mutate({ orgId: selectedOrgId, userId });
  };

  const handleRoleChange = async (userId: string, newRole: MemberRole) => {
    if (!selectedOrgId) return;

    setError(null);
    updateMemberRole.mutate({ orgId: selectedOrgId, userId, role: newRole });
  };

  const handleDeleteOrganization = async () => {
    if (!(selectedOrgId && selectedOrg)) return;

    const confirmed = window.confirm(
      t("settings.confirmDelete", { orgName: selectedOrg.name })
    );
    if (!confirmed) return;

    setError(null);
    deleteOrganization.mutate(selectedOrgId);
  };

  const handleLinkProject = (
    remoteProjectId: string,
    localProjectId: string
  ) => {
    setError(null);
    linkToExisting.mutate({
      localProjectId,
      data: { remote_project_id: remoteProjectId },
    });
  };

  const handleUnlinkProject = (projectId: string) => {
    setError(null);
    unlinkProject.mutate(projectId);
  };

  if (!isLoaded || orgsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t("settings.loadingOrganizations")}</span>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="py-8">
        <LoginRequiredPrompt
          actionLabel={t("loginRequired.action")}
          description={t("loginRequired.description")}
          title={t("loginRequired.title")}
        />
      </div>
    );
  }

  if (orgsError) {
    return (
      <div className="py-8">
        <Alert variant="destructive">
          <AlertDescription>
            {orgsError instanceof Error
              ? orgsError.message
              : t("settings.loadError")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const organizations = orgsResponse?.organizations ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          <AlertDescription className="font-medium">{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("settings.title")}</CardTitle>
              <CardDescription>{t("settings.description")}</CardDescription>
            </div>
            <Button onClick={handleCreateOrganization} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t("createDialog.createButton")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-selector">{t("settings.selectLabel")}</Label>
            <Select onValueChange={handleOrgSelect} value={selectedOrgId}>
              <SelectTrigger id="org-selector">
                <SelectValue placeholder={t("settings.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {organizations.length > 0 ? (
                  organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem disabled value="no-orgs">
                    {t("settings.noOrganizations")}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-sm">
              {t("settings.selectHelper")}
            </p>
          </div>
        </CardContent>
      </Card>

      {selectedOrg && isAdmin && !isPersonalOrg && (
        <Card>
          <CardHeader>
            <CardTitle>{t("invitationList.title")}</CardTitle>
            <CardDescription>
              {t("invitationList.description", {
                orgName: selectedOrg.name,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingInvitations ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">{t("invitationList.loading")}</span>
              </div>
            ) : invitations.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {t("invitationList.none")}
              </div>
            ) : (
              <div className="space-y-3">
                {invitations.map((invitation) => (
                  <PendingInvitationItem
                    invitation={invitation}
                    isRevoking={revokeInvitation.isPending}
                    key={invitation.id}
                    onRevoke={handleRevokeInvitation}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedOrg && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("memberList.title")}</CardTitle>
                <CardDescription>
                  {t("memberList.description", {
                    orgName: selectedOrg.name,
                  })}
                </CardDescription>
              </div>
              {isAdmin && !isPersonalOrg && (
                <Button onClick={handleInviteMember} size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t("memberList.inviteButton")}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">{t("memberList.loading")}</span>
              </div>
            ) : members.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {t("memberList.none")}
              </div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <MemberListItem
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    isRemoving={removeMember.isPending}
                    isRoleChanging={updateMemberRole.isPending}
                    key={member.user_id}
                    member={member}
                    onRemove={handleRemoveMember}
                    onRoleChange={handleRoleChange}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedOrg && (
        <Card>
          <CardHeader>
            <CardTitle>{t("sharedProjects.title")}</CardTitle>
            <CardDescription>
              {t("sharedProjects.description", { orgName: selectedOrg.name })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingProjects || loadingRemoteProjects ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">{t("sharedProjects.loading")}</span>
              </div>
            ) : remoteProjects.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {t("sharedProjects.noProjects")}
              </div>
            ) : (
              <div className="space-y-3">
                {remoteProjects.map((remoteProject) => {
                  // Find the local project linked to this remote project
                  const linkedLocalProject = allProjects.find(
                    (p) => p.remote_project_id === remoteProject.id
                  );

                  return (
                    <RemoteProjectItem
                      availableLocalProjects={availableLocalProjects}
                      isLinking={linkToExisting.isPending}
                      isUnlinking={unlinkProject.isPending}
                      key={remoteProject.id}
                      linkedLocalProject={linkedLocalProject}
                      onLink={handleLinkProject}
                      onUnlink={handleUnlinkProject}
                      remoteProject={remoteProject}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedOrg && isAdmin && !isPersonalOrg && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">
              {t("settings.dangerZone")}
            </CardTitle>
            <CardDescription>
              {t("settings.dangerZoneDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {t("settings.deleteOrganization")}
                </p>
                <p className="text-muted-foreground text-sm">
                  {t("settings.deleteOrganizationDescription")}
                </p>
              </div>
              <Button
                disabled={deleteOrganization.isPending}
                onClick={handleDeleteOrganization}
                variant="destructive"
              >
                {deleteOrganization.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {t("common:buttons.delete")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
