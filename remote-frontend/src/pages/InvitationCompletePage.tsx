import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { acceptInvitation, redeemOAuth } from "../api";
import {
  clearInvitationToken,
  clearVerifier,
  retrieveInvitationToken,
  retrieveVerifier,
} from "../pkce";

export default function InvitationCompletePage() {
  const { token: urlToken } = useParams();
  const { search } = useLocation();
  const qp = useMemo(() => new URLSearchParams(search), [search]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);

  const handoffId = qp.get("handoff_id");
  const appCode = qp.get("app_code");
  const oauthError = qp.get("error");

  useEffect(() => {
    const completeInvitation = async () => {
      if (oauthError) {
        setError(`OAuth error: ${oauthError}`);
        return;
      }

      if (!(handoffId && appCode)) {
        return;
      }

      try {
        const verifier = retrieveVerifier();
        if (!verifier) {
          setError("OAuth session lost. Please try again.");
          return;
        }

        const token = retrieveInvitationToken() || urlToken;
        if (!token) {
          setError("Invitation token lost. Please try again.");
          return;
        }

        const { access_token } = await redeemOAuth(
          handoffId,
          appCode,
          verifier
        );

        const result = await acceptInvitation(token, access_token);

        clearVerifier();
        clearInvitationToken();

        setSuccess(true);
        setOrgSlug(result.organization_slug);

        const timer = setTimeout(() => {
          const appBase =
            import.meta.env.VITE_APP_BASE_URL || window.location.origin;
          window.location.assign(`${appBase}`);
        }, 2000);
        return () => clearTimeout(timer);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to complete invitation"
        );
        clearVerifier();
        clearInvitationToken();
      }
    };

    completeInvitation();
  }, [handoffId, appCode, oauthError, urlToken]);

  if (error) {
    return (
      <StatusCard body={error} isError title="Could not accept invitation" />
    );
  }

  if (success) {
    return (
      <StatusCard
        body={orgSlug ? `Redirecting to ${orgSlug}...` : "Redirecting..."}
        isSuccess
        title="Invitation accepted!"
      />
    );
  }

  return (
    <StatusCard
      body="Processing OAuth callback..."
      title="Completing invitation..."
    />
  );
}

function StatusCard({
  title,
  body,
  isError = false,
  isSuccess = false,
}: {
  title: string;
  body: string;
  isError?: boolean;
  isSuccess?: boolean;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow">
        <h2
          className={`font-semibold text-lg ${
            isError
              ? "text-red-600"
              : isSuccess
                ? "text-green-600"
                : "text-gray-900"
          }`}
        >
          {title}
        </h2>
        <p className="mt-2 text-gray-600">{body}</p>
        {isSuccess && (
          <div className="mt-4 flex items-center text-gray-500 text-sm">
            <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
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
            Redirecting...
          </div>
        )}
      </div>
    </div>
  );
}
