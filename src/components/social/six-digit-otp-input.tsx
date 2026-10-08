'use client';

import React, { useRef, useState, useEffect } from 'react';

interface SixDigitOtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function SixDigitOtpInput({
  value = '',
  onChange,
  disabled = false,
  autoFocus = true,
}: SixDigitOtpInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sync internal digits state with value prop
  useEffect(() => {
    const valDigits = (value || '').replace(/\D/g, '').slice(0, 6).split('');
    const newDigits = Array(6).fill('');
    valDigits.forEach((d, i) => {
      newDigits[i] = d;
    });
    setDigits(newDigits);
  }, [value]);

  // Focus first input on mount if autoFocus is set
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus]);

  const updateParent = (newDigits: string[]) => {
    setDigits(newDigits);
    onChange(newDigits.join(''));
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const numericChar = val.replace(/\D/g, '').slice(-1);

    const newDigits = [...digits];
    newDigits[index] = numericChar;
    updateParent(newDigits);

    // Auto-advance to next box if char entered
    if (numericChar && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Current input is empty, focus previous and clear it
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        updateParent(newDigits);
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        updateParent(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      const pastedDigits = pastedData.split('');
      const newDigits = Array(6).fill('');
      pastedDigits.forEach((d, i) => {
        newDigits[i] = d;
      });
      updateParent(newDigits);

      // Focus the input corresponding to the end of pasted string
      const focusIndex = Math.min(pastedDigits.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  return (
    <div className="flex justify-center items-center gap-2 sm:gap-3 my-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[index] || ''}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          autoComplete="off"
          className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/40 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all duration-150 disabled:opacity-50"
        />
      ))}
    </div>
  );
}
