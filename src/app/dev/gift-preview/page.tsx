import { notFound } from 'next/navigation';
import DevGiftPreviewLab from '@/components/social/gifts/DevGiftPreviewLab';

export const dynamic = 'force-dynamic';

export default function DevGiftPreviewPage() {
  // Strictly unavailable in production
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <DevGiftPreviewLab />;
}
