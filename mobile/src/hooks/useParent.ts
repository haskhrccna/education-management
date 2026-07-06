import { useCallback, useEffect, useState } from 'react';
import { parentsApi, ParentLink, ChildSummary, ChildDashboard, StudentSearchResult } from '../api/parents';

export function useParent() {
  const [links, setLinks] = useState<ParentLink[]>([]);
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [dashboard, setDashboard] = useState<ChildDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      const data = await parentsApi.listLinks();
      setLinks(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load links');
    }
  }, []);

  const fetchChildren = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await parentsApi.listChildren();
      setChildren(data);
      if (data.length === 1) {
        const dash = await parentsApi.getChildDashboard(data[0].student.id);
        setDashboard(dash);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load children');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestLink = useCallback(async (studentId: string, reason?: string) => {
    const link = await parentsApi.requestLink(studentId, reason);
    setLinks((prev) => [link, ...prev]);
    return link;
  }, []);

  const searchStudent = useCallback(async (email: string): Promise<StudentSearchResult | null> => {
    try {
      return await parentsApi.searchStudent(email);
    } catch {
      return null;
    }
  }, []);

  const toggleDigest = useCallback(async (linkId: string, digestOptOut: boolean) => {
    // Optimistic — the toggle should feel instant; roll back on failure.
    setChildren((prev) => prev.map((c) => (c.linkId === linkId ? { ...c, digestOptOut } : c)));
    try {
      await parentsApi.setDigestPreference(linkId, digestOptOut);
    } catch (err: any) {
      setChildren((prev) => prev.map((c) => (c.linkId === linkId ? { ...c, digestOptOut: !digestOptOut } : c)));
      setError(err?.message ?? 'Failed to update digest preference');
    }
  }, []);

  const selectChild = useCallback(async (studentId: string) => {
    setIsLoading(true);
    try {
      const dash = await parentsApi.getChildDashboard(studentId);
      setDashboard(dash);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  return {
    links,
    children,
    dashboard,
    isLoading,
    error,
    fetchLinks,
    fetchChildren,
    requestLink,
    searchStudent,
    selectChild,
    toggleDigest,
  };
}
