export function humanizeError(error: unknown): string {
  // Network-like issues
  if (isNetworkError(error)) {
    return 'Problème réseau. Réessayez.';
  }

  // Supabase AuthError (v2) shape: { message, status, name, cause, error, __isAuthError, ...; error_description?; code? }
  const authCode = extractAuthCode(error);
  if (authCode === 'invalid_credentials') {
    return 'Email ou mot de passe invalide.';
  }
  if (authCode === 'user_not_found') {
    return "Aucun compte avec cet email.";
  }

  // PostgREST unique violation on profiles.username
  if (isProfilesUsernameUniqueViolation(error)) {
    return "Nom d'utilisateur déjà utilisé.";
  }

  return 'Une erreur est survenue. Réessayez.';
}

function isNetworkError(error: unknown): boolean {
  // FetchType errors often are TypeError with message containing 'NetworkError' or 'Failed to fetch'
  // Also handle cases where error is instance of DOMException with network-related names
  const msg = getMessage(error);
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m.includes('networkerror') ||
    m.includes('failed to fetch') ||
    m.includes('load failed') ||
    m.includes('network request failed') ||
    m.includes('net::err') ||
    m.includes('timeout')
  );
}

function extractAuthCode(error: unknown): string | null {
  const anyErr = error as any;
  const code: unknown = anyErr?.code ?? anyErr?.error; // supabase sometimes exposes code or error
  if (typeof code === 'string') return code;
  // Some errors embed code in details or message
  const details: string = String(anyErr?.error_description || anyErr?.details || '');
  if (/invalid_credentials/i.test(details)) return 'invalid_credentials';
  if (/user_not_found/i.test(details)) return 'user_not_found';
  const msg = getMessage(error) || '';
  if (/invalid_credentials/i.test(msg)) return 'invalid_credentials';
  if (/user_not_found/i.test(msg)) return 'user_not_found';
  return null;
}

function isProfilesUsernameUniqueViolation(error: unknown): boolean {
  const details = collectText(error);
  const hasDuplicate = /duplicate key/i.test(details) || /unique constraint/i.test(details);
  const hasConstraint = /profiles_username_key/i.test(details);
  return hasDuplicate && hasConstraint;
}

function getMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'string') return error;
  const anyErr = error as any;
  if (typeof anyErr?.message === 'string') return anyErr.message;
  return null;
}

function collectText(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  const anyErr = error as any;
  return [anyErr?.message, anyErr?.details, anyErr?.hint, anyErr?.error_description]
    .filter((v) => typeof v === 'string')
    .join(' | ');
}

export default humanizeError;


