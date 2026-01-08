import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getInvitation,
  type Invitation,
  initOAuth,
  type OAuthProvider,
} from "../api";
import {
  generateChallenge,
  generateVerifier,
  storeInvitationToken,
  storeVerifier,
} from "../pkce";

export default function InvitationPage() {
  const { token = "" } = useParams();
  const [data, setData] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getInvitation(token)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setLoading(true);
    try {
      const verifier = generateVerifier();
      const challenge = await generateChallenge(verifier);

      storeVerifier(verifier);
      storeInvitationToken(token);

      const appBase =
        import.meta.env.VITE_APP_BASE_URL || window.location.origin;
      const returnTo = `${appBase}/invitations/${token}/complete`;

      const result = await initOAuth(provider, returnTo, challenge);
      window.location.assign(result.authorize_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "OAuth init failed");
      setLoading(false);
    }
  };

  if (error) {
    return <ErrorCard body={error} title="Invalid or expired invitation" />;
  }

  if (!data) {
    return <LoadingCard text="Loading invitation..." />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow">
        <div>
          <h1 className="font-bold text-2xl text-gray-900">
            You've been invited
          </h1>
          <p className="mt-1 text-gray-600">
            Join <span className="font-semibold">{data.organization_name}</span>
          </p>
        </div>

        <div className="space-y-2 border-gray-200 border-t pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Role:</span>
            <span className="font-medium text-gray-900">{data.role}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Expires:</span>
            <span className="font-medium text-gray-900">
              {new Date(data.expires_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="space-y-3 border-gray-200 border-t pt-4">
          <p className="text-gray-600 text-sm">
            Choose a provider to continue:
          </p>
          <OAuthButton
            disabled={loading}
            label="Continue with GitHub"
            onClick={() => handleOAuthLogin("github")}
          />
          <OAuthButton
            disabled={loading}
            label="Continue with Google"
            onClick={() => handleOAuthLogin("google")}
          />
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

function ErrorCard({ title, body }: { title: string; body?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow">
        <h2 className="font-semibold text-lg text-red-600">{title}</h2>
        {body && <p className="mt-2 text-gray-600">{body}</p>}
      </div>
    </div>
  );
}
