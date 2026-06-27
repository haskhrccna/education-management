export interface AyahDTO {
  id: number;
  number: number;
  surahId: number;
  page: number;
  juz: number;
  audioUrl?: string;
  text?: string;
}

export interface MushafPageDTO {
  page: number;
  juz: number;
  ayahs: AyahDTO[];
}

export interface SurahWithAyahsDTO {
  id: number;
  number: number;
  nameAr: string;
  nameEn: string;
  ayahCount: number;
  juz: number;
  pages: number[];
  ayahs: AyahDTO[];
}
