// src/components/setup/useAdminAuth.ts

import { useState } from 'react';
import { isAdminAuthenticated, verifyAdminPassword, clearAdminAuth } from '../../utils/adminAuth';
import { teacherLogin, getTeacherAccount, type TeacherAccount } from '../../utils/teacherAuth';

export interface UseAdminAuthResult {
  isAdminUnlocked: boolean;
  showAdminPrompt: boolean;
  setShowAdminPrompt: (show: boolean) => void;
  adminPassword: string;
  setAdminPassword: (password: string) => void;
  adminError: string;
  setAdminError: (error: string) => void;
  adminVerifying: boolean;
  loginUsername: string;
  setLoginUsername: (username: string) => void;
  teacherAccount: TeacherAccount | null;
  setTeacherAccount: (account: TeacherAccount | null) => void;
  /**
   * Combined login (Phase 3c). A username present → teacher account login;
   * a blank username → the admin master password (today's behavior).
   */
  handleLogin: () => Promise<void>;
  handleLock: () => void;
}

export function useAdminAuth(): UseAdminAuthResult {
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => isAdminAuthenticated());
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminVerifying, setAdminVerifying] = useState(false);
  // Combined login (Phase 3c): a username makes it a teacher login; blank
  // username = the admin master password (today's behavior).
  const [loginUsername, setLoginUsername] = useState('');
  const [teacherAccount, setTeacherAccount] = useState<TeacherAccount | null>(() => getTeacherAccount());

  const handleLogin = async () => {
    if (!adminPassword.trim()) return;
    setAdminVerifying(true);
    setAdminError('');
    try {
      if (loginUsername.trim()) {
        const account = await teacherLogin(loginUsername.trim(), adminPassword);
        if (account) {
          setTeacherAccount(account);
          setShowAdminPrompt(false);
          setAdminPassword('');
          setLoginUsername('');
        } else {
          setAdminError('Incorrect username or password');
        }
      } else {
        const success = await verifyAdminPassword(adminPassword);
        if (success) {
          setIsAdminUnlocked(true);
          setShowAdminPrompt(false);
          setAdminPassword('');
        } else {
          setAdminError('Incorrect password');
        }
      }
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Could not reach the server.');
    } finally {
      setAdminVerifying(false);
    }
  };

  const handleLock = () => {
    clearAdminAuth();
    setIsAdminUnlocked(false);
  };

  return {
    isAdminUnlocked,
    showAdminPrompt,
    setShowAdminPrompt,
    adminPassword,
    setAdminPassword,
    adminError,
    setAdminError,
    adminVerifying,
    loginUsername,
    setLoginUsername,
    teacherAccount,
    setTeacherAccount,
    handleLogin,
    handleLock,
  };
}
