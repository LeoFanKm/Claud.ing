import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { redeemOAuth } from "../api";
import { storeTokens } from "../auth";
import { clearVerifier, retrieveVerifier } from "../pkce";

export default function AccountCompletePage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const qp = useMemo(() => new URLSearchParams(search), [search]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handoffId = qp.get("handoff_id");
  const appCode = qp.get("app_code");
  const oauthError = qp.get("error");

  useEffect(() => {
    const completeLogin = async () => {
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

        const { access_token, refresh_token } = await redeemOAuth(
          handoffId,
          appCode,
          verifier
        );

        storeTokens(access_token, refresh_token);
        clearVerifier();

        setSuccess(true);

        // Redirect to account page after brief delay
        setTimeout(() => {
          navigate("/account", { replace: true });
        }, 1000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to complete login");
        clearVerifier();
      }
    };

    completeLogin();
  }, [handoffId, appCode, oauthError, navigate]);

  if (error) {
    return (
      <StatusCard
        body={error}
        isError
        onRetry={() => navigate("/account", { replace: true })}
        showRetry
        title="Login failed"
      />
    );
  }

  if (success) {
    return (
      <StatusCard
        body="Redirecting to your account..."
        isSuccess
        title="Login successful!"
      />
    );
  }

  return (
    <StatusCard
      body="Processing OAuth callback..."
      title="Completing login..."
    />
  );
}

function StatusCard({
  title,
  body,
  isError = false,
  isSuccess = false,
  showRetry = false,
  onRetry,
}: {
  title: string;
  body: string;
  isError?: boolean;
  isSuccess?: boolean;
  showRetry?: boolean;
  onRetry?: () => void;
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
        {showRetry && onRetry && (
          <button
            className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-800"
            onClick={onRetry}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
