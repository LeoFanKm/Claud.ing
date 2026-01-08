import { useQuery } from "@tanstack/react-query";
import { type Invitation, InvitationStatus } from "shared/types";
import { organizationsApi } from "@/lib/api";

interface UseOrganizationInvitationsOptions {
  organizationId: string | null;
  isAdmin: boolean;
  isPersonal: boolean;
}

export function useOrganizationInvitations(
  options: UseOrganizationInvitationsOptions
) {
  const { organizationId, isAdmin, isPersonal } = options;

  return useQuery<Invitation[]>({
    queryKey: ["organization", "invitations", organizationId],
    queryFn: async () => {
      if (!organizationId) {
        throw new Error("No organization ID provided");
      }
      const invitations =
        await organizationsApi.listInvitations(organizationId);
      // Only return pending invitations
      return invitations.filter(
        (inv) => inv.status === InvitationStatus.PENDING
      );
    },
    enabled: !!organizationId && !!isAdmin && !isPersonal,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
