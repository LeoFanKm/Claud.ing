import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createOrganization,
  getProfile,
  initOAuth,
  listOrganizations,
  logout,
  type OAuthProvider,
  type OrganizationWithRole,
  type ProfileResponse,
} from "../api";
import { isLoggedIn } from "../auth";
import { generateChallenge, generateVerifier, storeVerifier } from "../pkce";

export default function AccountPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>(
    []
  );
  const [error, setError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);

  // Create org form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoggedIn()) {
      setAuthenticated(true);
      loadData();
    } else {
      setLoading(false);
    }
  }, []);

  async function loadData() {
    try {
      const [profileData, orgsData] = await Promise.all([
        getProfile(),
        listOrganizations(),
      ]);
      setProfile(profileData);
      setOrganizations(orgsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setOauthLoading(true);
    try {
      const verifier = generateVerifier();
      const challenge = await generateChallenge(verifier);
      storeVerifier(verifier);

      const appBase =
        import.meta.env.VITE_APP_BASE_URL || window.location.origin;
      const returnTo = `${appBase}/account/complete`;

      const result = await initOAuth(provider, returnTo, challenge);
      window.location.assign(result.authorize_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "OAuth init failed");
      setOauthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setAuthenticated(false);
      setProfile(null);
      setOrganizations([]);
    } catch (e) {
      // Tokens already cleared in logout()
      setAuthenticated(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    try {
      const org = await createOrganization({
        name: newOrgName.trim(),
        slug: newOrgSlug.trim().toLowerCase(),
      });
      navigate(`/account/organizations/${org.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreateLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 63);
  };

  if (loading) {
    return <LoadingCard text="Loading..." />;
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow">
          <div>
            <h1 className="font-bold text-2xl text-gray-900">Sign In</h1>
            <p className="mt-1 text-gray-600">
              Sign in to manage your account and organizations
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-3 border-gray-200 border-t pt-4">
            <OAuthButton
              disabled={oauthLoading}
              label="Continue with GitHub"
              onClick={() => handleOAuthLogin("github")}
            />
            <OAuthButton
              disabled={oauthLoading}
              label="Continue with Google"
              onClick={() => handleOAuthLogin("google")}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Profile Card */}
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              {profile?.providers[0]?.avatar_url && (
                <img
                  alt="Avatar"
                  className="h-16 w-16 rounded-full"
                  src={profile.providers[0].avatar_url}
                />
              )}
              <div>
                <h1 className="font-bold text-gray-900 text-xl">
                  {profile?.providers[0]?.display_name ||
                    profile?.username ||
                    "User"}
                </h1>
                <p className="text-gray-600">{profile?.email}</p>
              </div>
            </div>
            <button
              className="text-gray-600 text-sm hover:text-gray-900"
              onClick={handleLogout}
            >
              Sign out
            </button>
          </div>

          {profile && profile.providers.length > 0 && (
            <div className="mt-4 border-gray-200 border-t pt-4">
              <p className="mb-2 text-gray-600 text-sm">Connected accounts:</p>
              <div className="flex flex-wrap gap-2">
                {profile.providers.map((p) => (
                  <span
                    className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 font-medium text-gray-800 text-xs"
                    key={p.provider}
                  >
                    {p.provider}
                    {p.username && ` (${p.username})`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Organizations Card */}
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-lg">
              Organizations
            </h2>
            <button
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-gray-800"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? "Cancel" : "New Organization"}
            </button>
          </div>

          {showCreateForm && (
            <form
              className="mb-4 space-y-3 rounded-lg bg-gray-50 p-4"
              onSubmit={handleCreateOrg}
            >
              <div>
                <label className="mb-1 block font-medium text-gray-700 text-sm">
                  Name
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    if (
                      !newOrgSlug ||
                      newOrgSlug === generateSlug(newOrgName)
                    ) {
                      setNewOrgSlug(generateSlug(e.target.value));
                    }
                  }}
                  placeholder="My Organization"
                  required
                  type="text"
                  value={newOrgName}
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-gray-700 text-sm">
                  Slug
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
                  maxLength={63}
                  minLength={3}
                  onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase())}
                  pattern="[a-z0-9\-_]+"
                  placeholder="my-organization"
                  required
                  type="text"
                  value={newOrgSlug}
                />
                <p className="mt-1 text-gray-500 text-xs">
                  Only lowercase letters, numbers, hyphens, and underscores
                </p>
              </div>
              {createError && (
                <p className="text-red-600 text-sm">{createError}</p>
              )}
              <button
                className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={createLoading}
                type="submit"
              >
                {createLoading ? "Creating..." : "Create Organization"}
              </button>
            </form>
          )}

          {organizations.length === 0 ? (
            <p className="text-gray-600 text-sm">
              You don't belong to any organizations yet.
            </p>
          ) : (
            <div className="divide-y divide-gray-200">
              {organizations.map((org) => (
                <Link
                  className="-mx-2 flex items-center justify-between rounded px-2 py-3 transition-colors hover:bg-gray-50"
                  key={org.id}
                  to={`/account/organizations/${org.id}`}
                >
                  <div>
                    <p className="font-medium text-gray-900">{org.name}</p>
                    <p className="text-gray-500 text-sm">@{org.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {org.is_personal && (
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-700 text-xs">
                        Personal
                      </span>
                    )}
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        org.user_role === "ADMIN"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {org.user_role}
                    </span>
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M9 5l7 7-7 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OAuthButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="w-full rounded-lg bg-gray-900 px-4 py-3 font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-gray-50">
      <div className="text-gray-600">{text}</div>
    </div>
  );
}
