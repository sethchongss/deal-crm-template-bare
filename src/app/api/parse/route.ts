import { NextRequest, NextResponse } from 'next/server';
import { requireTeamApi } from '@/lib/team-access';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const unauthorized = await requireTeamApi();
  if (unauthorized) return unauthorized;

  try {
    const { text } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    // Call Claude API to parse the screening document
    const prompt = `
Please analyze this target screening document and extract the following information in JSON format:

{
  "thesis": "Brief summary of the overall investment thesis (1-2 sentences)",
  "whyOwn": "Extract the 'Why Own It?' section - competitive advantages, market position, unique value props",
  "whyNow": "Extract the 'Why Now?' section - timing catalysts, market conditions, inflection points",
  "exitStory": "Extract the 'Exit Story' section - potential exit strategies, value creation levers, timeline",
  "missingData": ["Array of key missing data points mentioned in the document"],
  "nextSteps": ["Array of recommended next steps from the document"],
  "rawAnalysis": "The full text of the analysis for reference"
}

Here is the screening document text:

${text}

Return only the JSON object, no other text.`;
    void prompt;

    // For now, we'll use a mock response. In production, you'd call the actual Claude API
    const mockResponse = {
      thesis: "Strong SaaS business with recurring revenue model and growing market share in SEA region.",
      whyOwn: "Market leader with differentiated product suite, sticky customer relationships, and strong unit economics. High barriers to entry through network effects and switching costs.",
      whyNow: "Accelerating digital transformation in SEA, increasing demand for SaaS solutions, management team executing well on growth strategy, ready for international expansion.",
      exitStory: "Strategic sale to global SaaS player seeking SEA market entry, or private market transaction at 8-12x revenue multiple based on growth profile and market leadership position. 3-5 year holding period.",
      missingData: [
        "3-year historical financials",
        "Customer concentration data", 
        "Management team details",
        "Competitive landscape analysis"
      ],
      nextSteps: [
        "Request detailed P&L statements for last 3 years",
        "Schedule management presentation call",
        "Analyze top 10 customer list",
        "Conduct competitive benchmarking"
      ],
      rawAnalysis: text
    };

    // Calculate score
    const score = calculateScore(mockResponse);
    
    return NextResponse.json({
      ...mockResponse,
      score
    });

  } catch (error) {
    console.error('Error parsing screening:', error);
    return NextResponse.json(
      { error: 'Failed to parse screening document' },
      { status: 500 }
    );
  }
}

function calculateScore(analysis: {
  thesis?: string;
  whyOwn?: string;
  whyNow?: string;
  exitStory?: string;
  missingData?: string[];
  nextSteps?: string[];
}): number {
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
  score -= missingCount * 2;

  // Next steps clarity
  const nextStepsCount = analysis.nextSteps?.length || 0;
  if (nextStepsCount > 0) {
    score += Math.min(nextStepsCount * 3, 15);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}