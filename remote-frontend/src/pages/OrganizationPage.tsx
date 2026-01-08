import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  bulkUpdateRepositoryReviewEnabled,
  createInvitation,
  deleteOrganization,
  disconnectGitHubApp,
  fetchGitHubAppRepositories,
  type GitHubAppRepository,
  type GitHubAppStatus,
  getGitHubAppInstallUrl,
  getGitHubAppStatus,
  getOrganization,
  getProfile,
  listInvitations,
  listMembers,
  type MemberRole,
  type Organization,
  type OrganizationInvitation,
  type OrganizationMemberWithProfile,
  removeMember,
  revokeInvitation,
  updateMemberRole,
  updateOrganization,
  updateRepositoryReviewEnabled,
} from "../api";
import { isLoggedIn } from "../auth";

export default function OrganizationPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [members, setMembers] = useState<OrganizationMemberWithProfile[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // GitHub App state
  const [githubAppStatus, setGithubAppStatus] =
    useState<GitHubAppStatus | null>(null);
  const [githubAppLoading, setGithubAppLoading] = useState(false);
  const [githubAppError, setGithubAppError] = useState<string | null>(null);
  const [showGithubDisconnectConfirm, setShowGithubDisconnectConfirm] =
    useState(false);
  const [githubAppSuccess, setGithubAppSuccess] = useState<string | null>(null);
  const [repoToggleLoading, setRepoToggleLoading] = useState<string | null>(
    null
  );
  const [repositories, setRepositories] = useState<GitHubAppRepository[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [repoFilter, setRepoFilter] = useState<"all" | "enabled" | "disabled">(
    "all"
  );
  const [bulkLoading, setBulkLoading] = useState(false);

  // Edit name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [editNameLoading, setEditNameLoading] = useState(false);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Invite state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("MEMBER");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isAdmin = userRole === "ADMIN";

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/account", { replace: true });
      return;
    }

    if (!orgId) return;
    loadData();

    // Check for GitHub App callback params
    const githubAppResult = searchParams.get("github_app");
    const githubAppErrorParam = searchParams.get("github_app_error");

    if (githubAppResult === "installed") {
      setGithubAppSuccess("GitHub App installed successfully!");
      // Clear the query param
      searchParams.delete("github_app");
      setSearchParams(searchParams, { replace: true });
    }

    if (githubAppErrorParam) {
      setGithubAppError(githubAppErrorParam);
      searchParams.delete("github_app_error");
      setSearchParams(searchParams, { replace: true });
    }
  }, [orgId, navigate, searchParams, setSearchParams]);

  async function loadData() {
    if (!orgId) return;

    try {
      const [orgData, membersData, profile] = await Promise.all([
        getOrganization(orgId),
        listMembers(orgId),
        getProfile(),
      ]);

      setOrganization(orgData.organization);
      setUserRole(orgData.user_role);
      setMembers(membersData);
      setCurrentUserId(profile.user_id);
      setEditedName(orgData.organization.name);

      // Load invitations if admin
      if (orgData.user_role === "ADMIN") {
        const invitationsData = await listInvitations(orgId);
        setInvitations(invitationsData.filter((i) => i.status === "PENDING"));
      }

      // Load GitHub App status for non-personal orgs
      if (!orgData.organization.is_personal) {
        try {
          const ghStatus = await getGitHubAppStatus(orgId);
          setGithubAppStatus(ghStatus);
          // If installed, load repos asynchronously
          if (ghStatus.installed) {
            loadRepositories(orgId);
          }
        } catch {
          // GitHub App may not be configured on the server
          setGithubAppStatus(null);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load organization");
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(orgId && editedName.trim())) return;

    setEditNameLoading(true);
    setEditNameError(null);

    try {
      const updated = await updateOrganization(orgId, editedName.trim());
      setOrganization(updated);
      setIsEditingName(false);
    } catch (e) {
      setEditNameError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setEditNameLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!orgId) return;

    setDeleteLoading(true);

    try {
      await deleteOrganization(orgId);
      navigate("/account", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      setShowDeleteConfirm(false);
      setDeleteLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!orgId) return;

    setActionLoading(userId);

    try {
      await removeMember(orgId, userId);
      setMembers(members.filter((m) => m.user_id !== userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove member");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: MemberRole) => {
    if (!orgId) return;

    setActionLoading(userId);

    try {
      await updateMemberRole(orgId, userId, newRole);
      setMembers(
        members.map((m) => (m.user_id === userId ? { ...m, role: newRole } : m))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setActionLoading(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(orgId && inviteEmail.trim())) return;

    setInviteLoading(true);
    setInviteError(null);

    try {
      const invitation = await createInvitation(
        orgId,
        inviteEmail.trim(),
        inviteRole
      );
      setInvitations([...invitations, invitation]);
      setInviteEmail("");
      setShowInviteForm(false);
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Failed to send invite");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!orgId) return;

    setActionLoading(invitationId);

    try {
      await revokeInvitation(orgId, invitationId);
      setInvitations(invitations.filter((i) => i.id !== invitationId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke invitation");
    } finally {
      setActionLoading(null);
    }
  };

  const handleInstallGitHubApp = async () => {
    if (!orgId) return;

    setGithubAppLoading(true);
    setGithubAppError(null);

    try {
      const { install_url } = await getGitHubAppInstallUrl(orgId);
      // Redirect to GitHub to install the app
      window.location.href = install_url;
    } catch (e) {
      setGithubAppError(
        e instanceof Error ? e.message : "Failed to start installation"
      );
      setGithubAppLoading(false);
    }
  };

  const handleDisconnectGitHubApp = async () => {
    if (!orgId) return;

    setGithubAppLoading(true);
    setGithubAppError(null);

    try {
      await disconnectGitHubApp(orgId);
      setGithubAppStatus({
        installed: false,
        installation: null,
        repositories: [],
      });
      setShowGithubDisconnectConfirm(false);
      setGithubAppSuccess("GitHub App disconnected");
    } catch (e) {
      setGithubAppError(
        e instanceof Error ? e.message : "Failed to disconnect"
      );
    } finally {
      setGithubAppLoading(false);
    }
  };

  const loadRepositories = async (organizationId: string) => {
    setReposLoading(true);
    try {
      const repos = await fetchGitHubAppRepositories(organizationId);
      setRepositories(repos);
    } catch (e) {
      setGithubAppError(
        e instanceof Error ? e.message : "Failed to load repositories"
      );
    } finally {
      setReposLoading(false);
    }
  };

  const handleToggleRepoReview = async (repoId: string, enabled: boolean) => {
    if (!orgId) return;

    setRepoToggleLoading(repoId);

    try {
      const updatedRepo = await updateRepositoryReviewEnabled(
        orgId,
        repoId,
        enabled
      );
      setRepositories((prev) =>
        prev.map((r) =>
          r.id === repoId
            ? { ...r, review_enabled: updatedRepo.review_enabled }
            : r
        )
      );
    } catch (e) {
      setGithubAppError(
        e instanceof Error ? e.message : "Failed to update repository"
      );
    } finally {
      setRepoToggleLoading(null);
    }
  };

  const handleBulkToggle = async (enabled: boolean) => {
    if (!orgId) return;

    setBulkLoading(true);
    try {
      await bulkUpdateRepositoryReviewEnabled(orgId, enabled);
      setRepositories((prev) =>
        prev.map((r) => ({ ...r, review_enabled: enabled }))
      );
    } catch (e) {
      setGithubAppError(
        e instanceof Error ? e.message : "Failed to update repositories"
      );
    } finally {
      setBulkLoading(false);
    }
  };

  const filteredRepositories = repositories
    .filter((repo) =>
      repo.repo_full_name.toLowerCase().includes(repoSearch.toLowerCase())
    )
    .filter((repo) => {
      if (repoFilter === "enabled") return repo.review_enabled;
      if (repoFilter === "disabled") return !repo.review_enabled;
      return true;
    })
    .sort((a, b) => a.repo_full_name.localeCompare(b.repo_full_name));

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error && !organization) {
    return (
      <div className="grid min-h-screen place-items-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow">
          <h2 className="font-semibold text-lg text-red-600">Error</h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <Link
            className="mt-4 inline-block text-gray-600 text-sm hover:text-gray-900"
            to="/account"
          >
            &larr; Back to account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Back link */}
        <Link
          className="inline-flex items-center text-gray-600 text-sm hover:text-gray-900"
          to="/account"
        >
          <svg
            className="mr-1 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M15 19l-7-7 7-7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
          Back to account
        </Link>

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              className="mt-1 text-red-500 text-xs hover:text-red-700"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Organization Details Card */}
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditingName ? (
                <form className="space-y-2" onSubmit={handleUpdateName}>
                  <input
                    autoFocus
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold text-lg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
                    onChange={(e) => setEditedName(e.target.value)}
                    type="text"
                    value={editedName}
                  />
                  {editNameError && (
                    <p className="text-red-600 text-sm">{editNameError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                      disabled={editNameLoading}
                      type="submit"
                    >
                      {editNameLoading ? "Saving..." : "Save"}
                    </button>
                    <button
                      className="px-3 py-1.5 text-gray-600 text-sm hover:text-gray-900"
                      onClick={() => {
                        setIsEditingName(false);
                        setEditedName(organization?.name || "");
                        setEditNameError(null);
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-gray-900 text-xl">
                    {organization?.name}
                  </h1>
                  {isAdmin && !organization?.is_personal && (
                    <button
                      className="text-gray-400 hover:text-gray-600"
                      onClick={() => setIsEditingName(true)}
                      title="Edit name"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                    </button>
                  )}
                </div>
              )}
              <p className="mt-1 text-gray-600">@{organization?.slug}</p>
            </div>
            <div className="flex items-center gap-2">
              {organization?.is_personal && (
                <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-700 text-xs">
                  Personal
                </span>
              )}
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  userRole === "ADMIN"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {userRole}
              </span>
            </div>
          </div>

          {/* Delete button (admin only, non-personal) */}
          {isAdmin && !organization?.is_personal && (
            <div className="mt-6 border-gray-200 border-t pt-4">
              {showDeleteConfirm ? (
                <div className="rounded-lg bg-red-50 p-4">
                  <p className="mb-3 text-red-700 text-sm">
                    Are you sure you want to delete this organization? This
                    action cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                      disabled={deleteLoading}
                      onClick={handleDelete}
                    >
                      {deleteLoading ? "Deleting..." : "Yes, delete"}
                    </button>
                    <button
                      className="px-3 py-1.5 text-gray-600 text-sm hover:text-gray-900"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="text-red-600 text-sm hover:text-red-700"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete organization
                </button>
              )}
            </div>
          )}
        </div>

        {/* Members Card */}
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-lg">Members</h2>
            {isAdmin && !organization?.is_personal && (
              <button
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-gray-800"
                onClick={() => setShowInviteForm(!showInviteForm)}
              >
                {showInviteForm ? "Cancel" : "Invite Member"}
              </button>
            )}
          </div>

          {/* Invite form */}
          {showInviteForm && (
            <form
              className="mb-4 space-y-3 rounded-lg bg-gray-50 p-4"
              onSubmit={handleInvite}
            >
              <div>
                <label className="mb-1 block font-medium text-gray-700 text-sm">
                  Email address
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  type="email"
                  value={inviteEmail}
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-gray-700 text-sm">
                  Role
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
                  onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                  value={inviteRole}
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              {inviteError && (
                <p className="text-red-600 text-sm">{inviteError}</p>
              )}
              <button
                className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={inviteLoading}
                type="submit"
              >
                {inviteLoading ? "Sending..." : "Send Invitation"}
              </button>
            </form>
          )}

          {/* Members list */}
          <div className="divide-y divide-gray-200">
            {members.map((member) => (
              <div
                className="flex items-center justify-between py-3"
                key={member.user_id}
              >
                <div className="flex items-center gap-3">
                  {member.avatar_url ? (
                    <img
                      alt=""
                      className="h-8 w-8 rounded-full"
                      src={member.avatar_url}
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200">
                      <span className="text-gray-500 text-xs">
                        {(
                          member.first_name?.[0] ||
                          member.email?.[0] ||
                          "?"
                        ).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">
                      {member.first_name || member.username || member.email}
                      {member.user_id === currentUserId && (
                        <span className="font-normal text-gray-500">
                          {" "}
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-gray-500 text-sm">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && !organization?.is_personal ? (
                    <>
                      <select
                        className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
                        disabled={
                          actionLoading === member.user_id ||
                          member.user_id === currentUserId
                        }
                        onChange={(e) =>
                          handleUpdateRole(
                            member.user_id,
                            e.target.value as MemberRole
                          )
                        }
                        value={member.role}
                      >
                        <option value="MEMBER">Member</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      {member.user_id !== currentUserId && (
                        <button
                          className="text-red-600 text-sm hover:text-red-700 disabled:opacity-50"
                          disabled={actionLoading === member.user_id}
                          onClick={() => handleRemoveMember(member.user_id)}
                        >
                          Remove
                        </button>
                      )}
                    </>
                  ) : (
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        member.role === "ADMIN"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {member.role}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Invitations Card (admin only) */}
        {isAdmin && invitations.length > 0 && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 font-semibold text-gray-900 text-lg">
              Pending Invitations
            </h2>
            <div className="divide-y divide-gray-200">
              {invitations.map((invitation) => (
                <div
                  className="flex items-center justify-between py-3"
                  key={invitation.id}
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {invitation.email}
                    </p>
                    <p className="text-gray-500 text-sm">
                      Role: {invitation.role} &middot; Expires{" "}
                      {new Date(invitation.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    className="text-red-600 text-sm hover:text-red-700 disabled:opacity-50"
                    disabled={actionLoading === invitation.id}
                    onClick={() => handleRevokeInvitation(invitation.id)}
                  >
                    {actionLoading === invitation.id ? "..." : "Revoke"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GitHub Integration Card (admin only, non-personal orgs) */}
        {isAdmin && !organization?.is_personal && githubAppStatus !== null && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-2 font-semibold text-gray-900 text-lg">
              GitHub Integration
            </h2>
            <p className="mb-4 text-gray-600 text-sm">
              Connect a GitHub App to automatically track pull requests from
              your repositories.
            </p>

            {/* Success message */}
            {githubAppSuccess && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-green-700 text-sm">{githubAppSuccess}</p>
                <button
                  className="mt-1 text-green-600 text-xs hover:text-green-800"
                  onClick={() => setGithubAppSuccess(null)}
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Error message */}
            {githubAppError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-red-700 text-sm">{githubAppError}</p>
                <button
                  className="mt-1 text-red-600 text-xs hover:text-red-800"
                  onClick={() => setGithubAppError(null)}
                >
                  Dismiss
                </button>
              </div>
            )}

            {githubAppStatus.installed && githubAppStatus.installation ? (
              // Installed state
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-gray-800"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    <span className="font-medium text-gray-900">
                      @{githubAppStatus.installation.github_account_login}
                    </span>
                    {githubAppStatus.installation.suspended_at && (
                      <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                        Suspended
                      </span>
                    )}
                  </div>
                  <span className="rounded bg-green-100 px-2 py-0.5 text-green-700 text-xs">
                    Connected
                  </span>
                </div>

                {/* Repository section */}
                <div className="mb-4">
                  {reposLoading ? (
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          fill="none"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          fill="currentColor"
                        />
                      </svg>
                      Loading repositories...
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 text-gray-600 text-sm">
                        <p>
                          {repositories.filter((r) => r.review_enabled).length}{" "}
                          of {repositories.length}{" "}
                          {repositories.length === 1
                            ? "repository"
                            : "repositories"}{" "}
                          have reviews enabled.
                        </p>
                      </div>

                      {repositories.length > 0 && (
                        <>
                          {/* Search, filter, and bulk actions */}
                          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                            <input
                              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-300"
                              onChange={(e) => setRepoSearch(e.target.value)}
                              placeholder="Search repositories..."
                              type="text"
                              value={repoSearch}
                            />
                            <select
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                              onChange={(e) =>
                                setRepoFilter(
                                  e.target.value as
                                    | "all"
                                    | "enabled"
                                    | "disabled"
                                )
                              }
                              value={repoFilter}
                            >
                              <option value="all">All</option>
                              <option value="enabled">Enabled</option>
                              <option value="disabled">Disabled</option>
                            </select>
                            <div className="flex gap-2">
                              <button
                                className="rounded-lg bg-green-100 px-3 py-1.5 text-green-700 text-xs hover:bg-green-200 disabled:opacity-50"
                                disabled={bulkLoading}
                                onClick={() => handleBulkToggle(true)}
                              >
                                Enable All
                              </button>
                              <button
                                className="rounded-lg bg-gray-100 px-3 py-1.5 text-gray-700 text-xs hover:bg-gray-200 disabled:opacity-50"
                                disabled={bulkLoading}
                                onClick={() => handleBulkToggle(false)}
                              >
                                Disable All
                              </button>
                            </div>
                          </div>

                          {/* Repository list */}
                          <div className="max-h-64 space-y-2 overflow-y-auto">
                            {filteredRepositories.length === 0 ? (
                              <p className="py-2 text-gray-500 text-sm">
                                No repositories match "{repoSearch}"
                              </p>
                            ) : (
                              filteredRepositories.map((repo) => (
                                <div
                                  className="flex items-center justify-between rounded-lg bg-gray-50 p-2"
                                  key={repo.id}
                                >
                                  <span className="mr-3 flex-1 truncate text-gray-700 text-sm">
                                    {repo.repo_full_name}
                                  </span>
                                  <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                      checked={repo.review_enabled}
                                      className="peer sr-only"
                                      disabled={
                                        repoToggleLoading === repo.id ||
                                        bulkLoading
                                      }
                                      onChange={(e) =>
                                        handleToggleRepoReview(
                                          repo.id,
                                          e.target.checked
                                        )
                                      }
                                      type="checkbox"
                                    />
                                    <div
                                      className={`peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-gray-300 ${repoToggleLoading === repo.id || bulkLoading ? "opacity-50" : ""}`}
                                    />
                                    <span className="ml-2 whitespace-nowrap text-gray-500 text-xs">
                                      {repo.review_enabled ? "On" : "Off"}
                                    </span>
                                  </label>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* !reviewfast tip */}
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="mb-1 font-medium text-blue-800 text-sm">
                    Tip: Trigger reviews on-demand
                  </p>
                  <p className="text-blue-700 text-sm">
                    Comment{" "}
                    <code className="rounded bg-blue-100 px-1 py-0.5 font-mono text-xs">
                      !reviewfast
                    </code>{" "}
                    on any pull request to trigger an AI code review instantly.
                  </p>
                </div>

                {/* Disconnect section */}
                {showGithubDisconnectConfirm ? (
                  <div className="rounded-lg bg-red-50 p-4">
                    <p className="mb-3 text-red-700 text-sm">
                      Are you sure you want to disconnect the GitHub App? You
                      will need to reinstall it from GitHub to reconnect.
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                        disabled={githubAppLoading}
                        onClick={handleDisconnectGitHubApp}
                      >
                        {githubAppLoading
                          ? "Disconnecting..."
                          : "Yes, disconnect"}
                      </button>
                      <button
                        className="px-3 py-1.5 text-gray-600 text-sm hover:text-gray-900"
                        onClick={() => setShowGithubDisconnectConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="text-red-600 text-sm hover:text-red-700"
                    onClick={() => setShowGithubDisconnectConfirm(true)}
                  >
                    Disconnect GitHub App
                  </button>
                )}
              </div>
            ) : (
              // Not installed state
              <div>
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                  disabled={githubAppLoading}
                  onClick={handleInstallGitHubApp}
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  {githubAppLoading ? "Loading..." : "Connect GitHub App"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
