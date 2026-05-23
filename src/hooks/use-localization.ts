"use client";

import { useState, useEffect } from 'react';
import { getLocalization } from '@/ai/flows/get-localization-flow';
import englishTranslations from '@/lib/translations.json';

// Define the type for our translations based on the English JSON file keys
export type TranslationKey = keyof typeof englishTranslations;
type Translations = Record<TranslationKey, string>;

export function useLocalization() {
  const [translations, setTranslations] = useState<Translations>(englishTranslations);
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    async function fetchTranslations() {
      // Get browser language, default to 'en'
      const browserLang = navigator.language.split('-')[0] || 'en';
      setLanguage(browserLang);

      // If it's English, we don't need to do anything.
      if (browserLang === 'en') {
        setTranslations(englishTranslations);
        setIsLoading(false);
        return;
      }
      
      // For other languages, fetch translations from our AI flow.
      try {
        setIsLoading(true);
        const translatedContent = await getLocalization({
          jsonContent: englishTranslations,
          languageCode: browserLang,
        });
        
        // Ensure all keys from the original englishTranslations are present
        const finalTranslations = { ...englishTranslations, ...translatedContent };

        setTranslations(finalTranslations as Translations);
      } catch (error) {
        console.error("Failed to fetch translations, falling back to English.", error);
        setTranslations(englishTranslations); // Fallback on error
      } finally {
        setIsLoading(false);
      }
    }

    fetchTranslations();
  }, []);

  // A function to get a specific translation string
  const t = (key: TranslationKey): string => {
    return translations[key] || englishTranslations[key];
  };

  return { t, isLoading, language };
}
