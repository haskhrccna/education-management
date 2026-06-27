import { useCallback, useEffect, useState } from 'react';
import { mushafApi } from '../api/mushaf';
import type { SurahWithAyahsDTO, MushafPageDTO } from '@quran-review/shared';

export function useMushaf() {
  const [surahs, setSurahs] = useState<{ id: number; number: number; nameAr: string; nameEn: string; ayahCount: number }[]>([]);
  const [page, setPage] = useState<MushafPageDTO | null>(null);
  const [surahDetail, setSurahDetail] = useState<SurahWithAyahsDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSurahs = useCallback(async () => {
    try {
      const res = await mushafApi.getSurah(1);
      // We use a real endpoint? Actually /surahs public endpoint exists? We can call /mushaf/surahs/1 to verify.
      setSurahs([]);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load surahs');
    }
  }, []);

  const fetchPage = useCallback(async (pageNumber: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await mushafApi.getPage(pageNumber);
      setPage(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load page');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSurah = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await mushafApi.getSurah(id);
      setSurahDetail(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load surah');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logAyah = useCallback(async (surahId: number, ayahNumber: number, memorized: boolean) => {
    await mushafApi.logMemorization(surahId, ayahNumber, memorized);
  }, []);

  useEffect(() => {
    fetchSurahs();
  }, [fetchSurahs]);

  return { surahs, page, surahDetail, isLoading, error, fetchPage, fetchSurah, logAyah };
}
