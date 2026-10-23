import { supabase } from './supabase';

export interface ScreeningAnalysis {
  thesis: string;
  whyOwn: string;
  whyNow: string;
  exitStory: string;
  missingData: string[];
  nextSteps: string[];
  score: number;
  rawAnalysis: string;
}

export async function extractTextFromPDF(file: File): Promise<string> {
  // For now, we'll use a simple approach - you can enhance this with pdf-parse or similar
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // This is a simplified approach - in production you'd use proper PDF parsing
      const text = reader.result as string;
      resolve(text);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export async function parseScreeningWithClaude(text: string): Promise<ScreeningAnalysis> {
  try {
    // Call Claude API to parse the screening document
    const response = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error('Failed to parse screening');
    }

    return await response.json();
  } catch (error) {
    console.error('Error parsing screening:', error);
    throw error;
  }
}

export function calculateDealScore(analysis: Partial<ScreeningAnalysis>): number {
  let score = 50; // Base score

  // Combine all thesis content for analysis
  const allThesisContent = [
    analysis.thesis || '',
    analysis.whyOwn || '',
    analysis.whyNow || '',
    analysis.exitStory || ''
  ].join(' ').toLowerCase();

  const positiveKeywords = ['strong', 'growing', 'market leader', 'scalable', 'profitable', 'recurring', 'differentiated', 'competitive advantage', 'network effects', 'barriers to entry'];
  const negativeKeywords = ['declining', 'competitive pressure', 'risk', 'challenge', 'uncertainty', 'weak'];

  // Positive indicators (+2 each, max 20)
  positiveKeywords.forEach(keyword => {
    if (allThesisContent.includes(keyword)) {
      score += 2;
    }
  });

  // Negative indicators (-3 each, max -15)
  negativeKeywords.forEach(keyword => {
    if (allThesisContent.includes(keyword)) {
      score -= 3;
    }
  });

  // Thesis completeness bonus - all three subsections present
  const hasWhyOwn = (analysis.whyOwn || '').length > 50;
  const hasWhyNow = (analysis.whyNow || '').length > 50;
  const hasExitStory = (analysis.exitStory || '').length > 50;
  
  if (hasWhyOwn) score += 5;
  if (hasWhyNow) score += 5;
  if (hasExitStory) score += 5;

  // Data completeness (fewer missing items = higher score)
  const missingCount = analysis.missingData?.length || 0;
  score -= missingCount * 2; // -2 points per missing critical item

  // Next steps clarity (having clear next steps is positive)
  const nextStepsCount = analysis.nextSteps?.length || 0;
  if (nextStepsCount > 0) {
    score += Math.min(nextStepsCount * 3, 15); // +3 per step, max 15
  }

  // Ensure score stays within bounds
  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function uploadScreeningPDF(dealId: string, file: File): Promise<string> {
  const fileName = `${dealId}/screening-${Date.now()}.pdf`;
  
  const { error } = await supabase.storage
    .from('screening-docs')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('screening-docs')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

export async function updateDealWithScreening(
  dealId: string, 
  analysis: ScreeningAnalysis, 
  pdfUrl: string
): Promise<void> {
  const { error } = await supabase
    .from('deals')
    .update({
      screening_pdf_url: pdfUrl,
      screening_score: analysis.score,
      screening_thesis: analysis.thesis,
      screening_why_own: analysis.whyOwn,
      screening_why_now: analysis.whyNow,
      screening_exit_story: analysis.exitStory,
      screening_missing_data: analysis.missingData,
      screening_next_steps: analysis.nextSteps,
      screening_raw_analysis: analysis.rawAnalysis,
      screening_updated_at: new Date().toISOString()
    })
    .eq('id', dealId);

  if (error) {
    throw new Error(`Failed to update deal: ${error.message}`);
  }
}