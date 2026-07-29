import { useCallback, useEffect, useState } from 'react';
import { parentsApi, ParentLink, ChildSummary, ChildDashboard, StudentSearchResult } from '../api/parents';

export type { GuardianConsentStatus } from '../api/parents';

export function useParent() {
  const [links, setLinks] = useState<ParentLink[]>([]);
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [dashboards, setDashboards] = useState<Record<string, ChildDashboard>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardsLoading, setDashboardsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      const data = await parentsApi.listLinks();
      setLinks(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load links');
    }
  }, []);

  // Every card needs its own header data (today's session, last grade,
  // streak) visible without a tap, so every linked child's dashboard is
  // fetched in parallel up front — not lazily per-selection as before.
  const fetchDashboards = useCallback(async (childList: ChildSummary[]) => {
    if (childList.length === 0) {
      setDashboards({});
      return;
    }
    setDashboardsLoading(true);
    try {
      const results = await Promise.allSettled(childList.map((c) => parentsApi.getChildDashboard(c.student.id)));
      const next: Record<string, ChildDashboard> = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next[childList[i].student.id] = r.value;
      });
      setDashboards(next);
    } finally {
      setDashboardsLoading(false);
    }
  }, []);

  const fetchChildren = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await parentsApi.listChildren();
      setChildren(data);
      await fetchDashboards(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load children');
    } finally {
      setIsLoading(false);
    }
  }, [fetchDashboards]);

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

  const decideConsent = useCallback(async (linkId: string, granted: boolean) => {
    const result = await parentsApi.decideConsent(linkId, granted);
    setChildren((prev) =>
      prev.map((c) => (c.linkId === linkId ? { ...c, guardianConsentStatus: result.guardianConsentStatus } : c))
    );
    return result;
  }, []);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  return {
    links,
    children,
    dashboards,
    dashboardsLoading,
    isLoading,
    error,
    fetchLinks,
    fetchChildren,
    requestLink,
    searchStudent,
    toggleDigest,
    decideConsent,
  };
}
