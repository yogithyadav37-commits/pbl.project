import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { LogOut, Shield, UserCheck, X } from 'lucide-react';
import { FIELD_LIMITS, UserProfile } from '../types/reclaim';
import { GoogleSignInButton } from './GoogleSignInButton';

interface ProfileModalProps {
  open: boolean;
  firebaseUser: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  authLoading: boolean;
  onClose: () => void;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSaveProfile: (input: {
    displayName: string;
    studentId: string;
    department: string;
  }) => Promise<void>;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  open,
  firebaseUser,
  profile,
  isAdmin,
  authLoading,
  onClose,
  onSignInGoogle,
  onSignOut,
  onSaveProfile,
}) => {
  const [displayName, setDisplayName] = useState(
    profile?.displayName || firebaseUser?.displayName || ''
  );
  const [studentId, setStudentId] = useState(profile?.studentId || '');
  const [department, setDepartment] = useState(profile?.department || 'Computer Science');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setDisplayName(profile?.displayName || firebaseUser?.displayName || '');
    setStudentId(profile?.studentId || '');
    setDepartment(profile?.department || 'Computer Science');
    setError(null);
    setMessage(null);
  }, [profile, firebaseUser, open]);

  if (!open) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (displayName.trim().length < 2) {
      setError('Please enter your full student or faculty name.');
      return;
    }
    if (!FIELD_LIMITS.studentId.pattern.test(studentId.trim()) || studentId.trim().length < 2) {
      setError('Student ID must use 2–32 letters, numbers, hyphens, or underscores.');
      return;
    }
    if (department.trim().length < 2) {
      setError('Please enter your campus department.');
      return;
    }

    setSaving(true);
    try {
      await onSaveProfile({
        displayName: displayName.trim(),
        studentId: studentId.trim(),
        department: department.trim(),
      });
      setMessage('Campus profile saved to Firestore.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 id="profile-modal-title" className="text-lg font-bold text-slate-900">
              {firebaseUser ? 'Campus Account & Profile' : 'Sign in to ReClaim'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {firebaseUser
                ? firebaseUser.email
                : 'Authenticate with Google via Firebase Auth to sync reports and claims.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account modal"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {!firebaseUser ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm leading-relaxed text-slate-600">
              Sign in with your verified Google college account to report lost or found items,
              submit private ownership claims, and receive match alerts.
            </p>
            <div className="flex justify-center pt-1">
              <GoogleSignInButton
                onClick={async () => {
                  setError(null);
                  try {
                    await onSignInGoogle();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Sign-in cancelled or failed.');
                  }
                }}
                disabled={authLoading}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                {isAdmin ? (
                  <Shield className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                ) : (
                  <UserCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                )}
                Role: {isAdmin ? 'Campus Administrator' : profile?.role || 'Student'}
              </span>
              <span className="font-mono text-[11px] text-slate-500">Verified session</span>
            </div>

            <div>
              <label htmlFor="profile-name" className="block text-xs font-semibold text-slate-700">
                Student / Faculty Name *
              </label>
              <input
                id="profile-name"
                type="text"
                required
                maxLength={FIELD_LIMITS.displayName.max}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="profile-student-id"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Student / Staff ID *
                </label>
                <input
                  id="profile-student-id"
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.studentId.max}
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g., CS2026-042"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-department"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Department *
                </label>
                <input
                  id="profile-department"
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.department.max}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g., Computer Science"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                {message}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={async () => {
                  await onSignOut();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Campus Profile'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
